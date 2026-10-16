/* =========================================================
   Calm Haven / Sakin Sığınak — discovery.js  (2.0)
   Keşif motoru: nadir, cezasız sürpriz anlar.

   Kurallar:
   - Yakalama yok, tıklama zorunluluğu yok, FOMO yok.
   - Kaçırmak diye bir şey yok: görülmezse sadece kaybolur ve
     başka bir zamanda yeniden belirir.
   - Öğeler sahneye bildirilir; çizim canvas.js içinde yapılır.
   ========================================================= */

const CalmDiscovery = (function () {
  'use strict';

  const ENDPOINT = './data/discoveries.json';

  // Yedek tanımlar: dosya erişilemezse (file://) keşifler yine çalışsın
  const FALLBACK = [
    { id: 'shooting_star', name: 'Kayan Yıldız', chance: 0.02, cooldown: 240, duration: 1.6,
      message: 'Bir kayan yıldız geçti. Bu an sadece senin.' },
    { id: 'heron', name: 'Balıkçıl', chance: 0.015, cooldown: 420, duration: 16,
      message: 'Suda bir balıkçıl duruyor. Hiçbir yere gitmesi gerekmiyor.' },
    { id: 'butterfly', name: 'Kelebek', chance: 0.03, cooldown: 100, duration: 9,
      message: 'Bir kelebek yoldan geçti. Onu tutman gerekmiyor.' },
    { id: 'firefly', name: 'Ateş Böceği', chance: 0.04, cooldown: 70, duration: 7,
      message: 'Ağaçların arasında bir ateş böceği parlıyor.' }
  ];

  const TICK = 1.0;         // s — her saniye bir olasılık denemesi
  const GRACE = 45;         // s — ilk keşif için bekleme: hemen fırlatmasın

  let defs = FALLBACK.slice();
  let active = [];
  const lastSeen = Object.create(null);

  let onDiscover = null;
  let reducedMotion = false;
  let running = false;
  let timerId = null;
  let elapsed = 0;

  function normalize(data) {
    if (!Array.isArray(data)) return null;
    const cleaned = data.filter(function (d) {
      return d && typeof d.id === 'string' && typeof d.chance === 'number';
    }).map(function (d) {
      return {
        id: d.id,
        name: typeof d.name === 'string' ? d.name : d.id,
        chance: Math.max(0, Math.min(1, d.chance)),
        cooldown: typeof d.cooldown === 'number' ? d.cooldown : 120,
        duration: typeof d.duration === 'number' ? d.duration : 8,
        message: typeof d.message === 'string' ? d.message : ''
      };
    });
    return cleaned.length ? cleaned : null;
  }

  async function load() {
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const cleaned = normalize(await res.json());
      if (cleaned) {
        defs = cleaned;
        return { source: 'json', count: defs.length };
      }
    } catch (err) {
      // Yedek tanımlar zaten yüklü
    }
    defs = FALLBACK.slice();
    return { source: 'fallback', count: defs.length };
  }

  function tick() {
    if (!running) return;
    elapsed += TICK;

    // İlk saniyelerde sahne otursun, ardından keşifler başlasın
    if (elapsed < GRACE) return;

    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const last = lastSeen[d.id] || 0;
      if (elapsed - last < d.cooldown) continue;
      if (Math.random() < d.chance) trigger(d);
    }
  }

  function trigger(def) {
    lastSeen[def.id] = elapsed;

    const item = {
      id: def.id,
      name: def.name,
      visible: true,
      progress: 0,
      duration: def.duration,
      startedAt: elapsed
    };
    active.push(item);

    if (onDiscover && def.message) onDiscover(def.name, def.message);
  }

  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      a.progress += dt / a.duration;
      if (a.progress >= 1) {
        active.splice(i, 1);
      }
    }
  }

  function getActive() {
    return active;
  }

  function start() {
    if (running) return;
    if (reducedMotion) return;
    running = true;
    timerId = setInterval(tick, TICK * 1000);
  }

  function stop() {
    running = false;
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  async function init(options) {
    options = options || {};
    reducedMotion = !!options.reducedMotion;
    onDiscover = options.onDiscover || null;

    const info = await load();

    if (!reducedMotion) start();
    return info;
  }

  function setReducedMotion(value) {
    reducedMotion = !!value;
    if (reducedMotion) {
      stop();
      active = [];
    } else {
      start();
    }
  }

  // Test / hata ayıklama için elle tetikleme
  function forceTrigger(id) {
    const def = defs.filter(function (d) { return d.id === id; })[0];
    if (def) trigger(def);
    return !!def;
  }

  const api = {
    init: init,
    start: start,
    stop: stop,
    update: update,
    getActive: getActive,
    setReducedMotion: setReducedMotion,
    forceTrigger: forceTrigger,
    getDefs: function () { return defs.slice(); },
    FALLBACK: FALLBACK
  };

  return api;
})();
