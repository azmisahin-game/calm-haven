/* =========================================================
   Calm Haven / Sakin Sığınak — audio.js
   Web Audio API ile dış dosyasız prosedürel ses.
   Kahverengi gürültü (1/f^2) + pembe gürültü tabanlı yağmur katmanı.
   ========================================================= */

const CalmAudio = (function () {
  'use strict';

  const FADE_IN = 2.0;   // s — ani ses başlangıcı irkilmesini önler
  const FADE_OUT = 1.4;  // s

  let ctx = null;
  let master = null;
  let brownNodes = null;
  let rainNodes = null;
  let lfo = null;
  let analyser = null;

  let enabled = true;
  let started = false;
  let level = 0.45;
  let activeLevel = 0;

  /* ---------- Gürültü tamponları ---------- */

  function createBrownNoise(duration) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise: beyaz gürültünün entegrasyonu → 1/f^2 spektral yoğunluk
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Genlik telafisi
      }
    }
    return buffer;
  }

  // Voss-McCartney algoritması ile pembe gürültü (1/f)
  function createPinkNoise(duration) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const rows = 8;

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const values = new Array(rows).fill(0);
      let running = 0;

      for (let i = 0; i < bufferSize; i++) {
        // Her örnekte düşük bitleri sıfır olan sayaç: oktav başına bir satır güncellenir
        const lastIndex = i ? (i & -i) : 0;
        const rowIndex = Math.log2(lastIndex || 1) | 0;
        if (rowIndex < rows) {
          running -= values[rowIndex];
          values[rowIndex] = Math.random() * 2 - 1;
          running += values[rowIndex];
        }
        data[i] = (running / rows) * 0.8;
      }
    }
    return buffer;
  }

  /* ---------- Grafikler ---------- */

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    master.connect(analyser);
    analyser.connect(ctx.destination);

    // --- Kahverengi gürültü: derin uğultu, ofis gürültüsünü maskeler ---
    const brownSource = ctx.createBufferSource();
    brownSource.buffer = createBrownNoise(4);
    brownSource.loop = true;

    const brownLowpass = ctx.createBiquadFilter();
    brownLowpass.type = 'lowpass';
    brownLowpass.frequency.value = 400;
    brownLowpass.Q.value = 0.7;

    const brownGain = ctx.createGain();
    brownGain.gain.value = 0.85;

    brownSource.connect(brownLowpass);
    brownLowpass.connect(brownGain);
    brownGain.connect(master);

    // Yavaş genlik salınımı: şelale/rüzgar hissi, statik döngü hissini kırar
    lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.12;
    lfo.connect(lfoDepth);
    lfoDepth.connect(brownGain.gain);

    brownNodes = { source: brownSource, lowpass: brownLowpass, gain: brownGain, lfoDepth: lfoDepth };
    brownSource.start(0);
    lfo.start(0);

    // --- Yağmur/dalga katmanı: pembe gürültü, bandpass + hafif stereo ---
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = createPinkNoise(4);
    rainSource.loop = true;

    const rainBand = ctx.createBiquadFilter();
    rainBand.type = 'bandpass';
    rainBand.frequency.value = 800;
    rainBand.Q.value = 0.55;

    const rainHigh = ctx.createBiquadFilter();
    rainHigh.type = 'highpass';
    rainHigh.frequency.value = 320;
    rainHigh.Q.value = 0.5;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.22;

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = 0.12;

    rainSource.connect(rainBand);
    rainBand.connect(rainHigh);
    rainHigh.connect(rainGain);
    if (panner) {
      rainGain.connect(panner);
      panner.connect(master);
    } else {
      rainGain.connect(master);
    }

    rainNodes = { source: rainSource, band: rainBand, high: rainHigh, gain: rainGain, panner: panner };
    rainSource.start(0);
  }

  /* ---------- Yaşam döngüsü ---------- */

  function supported() {
    return typeof window !== 'undefined' &&
      !!(window.AudioContext || window.webkitAudioContext);
  }

  function ensureContext() {
    if (ctx) return true;
    if (!supported()) return false;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    try {
      ctx = new Ctor();
    } catch (err) {
      ctx = null;
      return false;
    }
    buildGraph();
    return true;
  }

  function fadeTo(target, duration, onDone) {
    if (!master) return;
    const now = ctx.currentTime;
    const from = activeLevel;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(from, now);
    master.gain.linearRampToValueAtTime(target, now + duration);
    activeLevel = target;
    if (onDone) {
      const id = setTimeout(onDone, duration * 1000 + 60);
      // Basit yaşam döngüsü: tek seferlik zamanlayıcı, referans tutulmaz
      if (id) { /* no-op */ }
    }
  }

  // İlk kullanıcı etkileşiminde çağrılır: autoplay politikasını karşılar
  async function unlock() {
    if (!ensureContext()) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        return false;
      }
    }

    started = true;

    if (enabled) {
      fadeTo(level, FADE_IN);
    }
    return ctx.state === 'running';
  }

  function setEnabled(value) {
    enabled = !!value;
    if (!ctx || !started) return enabled;

    if (enabled) {
      if (ctx.state === 'suspended') ctx.resume();
      fadeTo(level, FADE_IN);
    } else {
      fadeTo(0, FADE_OUT);
    }
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function setLevel(value) {
    const v = Math.max(0, Math.min(1, Number(value)));
    level = v;
    if (ctx && started && enabled) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(v, now, 0.25);
      activeLevel = v;
    }
  }

  function getLevel() {
    return level;
  }

  function isEnabled() {
    return enabled;
  }

  function isRunning() {
    return !!(ctx && ctx.state === 'running' && started && enabled);
  }

  // Nefes halkasıyla senkronize edilebilecek hafif genlik verisi (0..1)
  function getEnergy() {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum / (data.length * 255);
  }

  function init(options) {
    options = options || {};
    if (typeof options.enabled === 'boolean') enabled = options.enabled;
    if (typeof options.level === 'number') level = Math.max(0, Math.min(1, options.level));
    return api;
  }

  const api = {
    init: init,
    unlock: unlock,
    setEnabled: setEnabled,
    toggle: toggle,
    setLevel: setLevel,
    getLevel: getLevel,
    isEnabled: isEnabled,
    isRunning: isRunning,
    getEnergy: getEnergy,
    supported: supported
  };

  return api;
})();
