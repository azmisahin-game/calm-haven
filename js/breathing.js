/* =========================================================
   Calm Haven / Sakin Sığınak — breathing.js
   Sinir sistemi senkronizatörü.
   Mod 1: Rezonans (4 sn al / 6 sn ver)
   Mod 2: Fizyolojik İçe Çekiş (2.5 + 1.0 + 6.0 sn, 3 tur)
   ========================================================= */

const CalmBreathing = (function () {
  'use strict';

  const BREATH_MODES = {
    resonance: {
      inhale: 4.0,
      exhale: 6.0,
      scale: { inhale: 1.35, exhale: 0.85 },
      label: { inhale: 'Nefes al...', exhale: 'Bırak...' }
    },
    sigh: {
      steps: [
        { duration: 2.5, text: 'Burnundan derin bir nefes al...', scale: 1.15, hold: true },
        { duration: 1.0, text: 'Üzerine küçük bir nefes daha ekle...', scale: 1.35, hold: true },
        { duration: 6.0, text: 'Tüm yükü ağzından uzunca bırak...', scale: 0.82, hold: false }
      ],
      cycles: 3
    }
  };

  const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

  let ringEl = null;
  let textEl = null;
  let counterEl = null;

  let mode = 'resonance';
  let reducedMotion = false;
  let running = false;

  let timerId = null;
  let remaining = 0;
  let deadline = 0;

  let resonancePhase = 'inhale';
  let sighCycle = 1;
  let sighStep = 0;

  let onChange = null;

  /* ---------- Görsel yardımcılar ---------- */

  function applyRing(scale, duration) {
    if (!ringEl) return;
    const ms = reducedMotion ? '0.01ms' : duration + 's';
    ringEl.style.transition = 'transform ' + ms + ' ' + EASE;
    ringEl.style.transform = 'scale(' + scale + ')';
  }

  function applyHold(isHolding) {
    if (!ringEl) return;
    if (isHolding) ringEl.classList.add('is-holding');
    else ringEl.classList.remove('is-holding');
  }

  function applyText(text) {
    if (textEl) textEl.textContent = text;
  }

  function applyCounter(text) {
    if (!counterEl) return;
    if (counterEl.textContent !== text) counterEl.textContent = text;
  }

  /* ---------- Zamanlayıcı ---------- */

  function clearTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function schedule(duration) {
    remaining = duration;
    deadline = performance.now() + duration * 1000;
    clearTimer();
    timerId = setTimeout(tick, duration * 1000);
  }

  /* ---------- Rezonans akışı ---------- */

  function runResonancePhase() {
    const cfg = BREATH_MODES.resonance;
    const isInhale = resonancePhase === 'inhale';
    const duration = isInhale ? cfg.inhale : cfg.exhale;

    applyRing(isInhale ? cfg.scale.inhale : cfg.scale.exhale, duration);
    applyHold(false);
    applyText(isInhale ? cfg.label.inhale : cfg.label.exhale);
    applyCounter(cfg.inhale + ' sn al / ' + cfg.exhale + ' sn ver');

    onPhaseChange();

    schedule(duration);
  }

  /* ---------- Fizyolojik içe çekiş akışı ---------- */

  function runSighStep() {
    const cfg = BREATH_MODES.sigh;
    const step = cfg.steps[sighStep];

    applyRing(step.scale, step.duration);
    applyHold(!!step.hold);
    applyText(step.text);
    applyCounter('İçe çekiş ' + sighCycle + ' / ' + cfg.cycles);

    onPhaseChange();

    schedule(step.duration);
  }

  function advanceSigh() {
    const cfg = BREATH_MODES.sigh;
    sighStep += 1;

    if (sighStep < cfg.steps.length) {
      runSighStep();
      return;
    }

    sighStep = 0;
    sighCycle += 1;

    if (sighCycle > cfg.cycles) {
      // Protokol tamamlandı: varsayılan rezonans ritmine dön
      setMode('resonance', { active: true });
      return;
    }

    runSighStep();
  }

  /* ---------- Durum makinesi ---------- */

  // Süreleri yöneten tek nokta: her faz bitiminde buraya dönülür.
  function tick() {
    timerId = null;
    if (!running) return;

    if (mode === 'sigh') {
      advanceSigh();
      return;
    }

    resonancePhase = resonancePhase === 'inhale' ? 'exhale' : 'inhale';
    runResonancePhase();
  }

  function onPhaseChange() {
    if (onChange) onChange({ mode: mode, phase: mode === 'sigh' ? 'step' + sighStep : resonancePhase });
  }

  /* ---------- Genel arayüz ---------- */

  function setMode(next, opts) {
    if (next !== 'resonance' && next !== 'sigh') return;
    opts = opts || {};
    clearTimer();

    mode = next;

    if (mode === 'sigh') {
      sighCycle = 1;
      sighStep = 0;
      running = true;
      runSighStep();
      return;
    }

    resonancePhase = 'inhale';
    running = true;
    runResonancePhase();

    if (opts.active && onChange) {
      onChange({ mode: mode, phase: resonancePhase, auto: true });
    }
  }

  function startSigh() {
    setMode('sigh');
  }

  function pause() {
    if (!running) return;
    if (timerId !== null) {
      remaining = Math.max(0, (deadline - performance.now()) / 1000);
      clearTimer();
    }
    running = false;
  }

  function resume() {
    if (running) return;
    running = true;
    // Kaldığı fazı kalan süre ile yeniden kur
    if (mode === 'sigh') {
      const cfg = BREATH_MODES.sigh;
      const step = cfg.steps[sighStep];
      applyRing(step.scale, remaining || step.duration);
      schedule(remaining || step.duration);
    } else {
      const cfg = BREATH_MODES.resonance;
      const isInhale = resonancePhase === 'inhale';
      const duration = isInhale ? cfg.inhale : cfg.exhale;
      applyRing(isInhale ? cfg.scale.inhale : cfg.scale.exhale, remaining || duration);
      schedule(remaining || duration);
    }
  }

  function setReducedMotion(value) {
    reducedMotion = !!value;
  }

  function init(els, options) {
    els = els || {};
    ringEl = els.ring || null;
    textEl = els.text || null;
    counterEl = els.counter || null;
    options = options || {};
    reducedMotion = !!options.reducedMotion;
    onChange = options.onChange || null;

    setMode(options.mode === 'sigh' ? 'sigh' : 'resonance');
    return api;
  }

  function getMode() {
    return mode;
  }

  const api = {
    init: init,
    setMode: setMode,
    startSigh: startSigh,
    pause: pause,
    resume: resume,
    setReducedMotion: setReducedMotion,
    getMode: getMode,
    MODES: BREATH_MODES
  };

  return api;
})();
