/* =========================================================
   Calm Haven / Sakin Sığınak — world.js
   Dünya durumu ve nefes senkronizasyonu.

   Nefes motorundan gelen faz sinyalleri dünya parametrelerine çevrilir:
   alış → dünya canlanır (sis dağılır, ay parlar, su parıldar)
   veriş → dünya rahatlar (sis döner, ışık yumuşar, su sakinleşir)

   Bu modül sadece durum tutar ve yumuşatır; çizim yapmaz.
   canvas.js her karede güncel değerleri okur.
   ========================================================= */

const CalmWorld = (function () {
  'use strict';

  // Nefes fazlarının hedef değerleri
  const TARGETS = {
    inhale: { fog: 0.14, moon: 0.92, shimmer: 0.85, leaf: 0.34, mist: 0.22 },
    exhale: { fog: 0.42, moon: 0.52, shimmer: 0.28, leaf: 0.16, mist: 0.52 }
  };

  // Fizyolojik içe çekiş adımlarının hedefleri: dünya "nefes alır gibi" genişler
  const SIGH_TARGETS = [
    { fog: 0.26, moon: 0.74, shimmer: 0.55, leaf: 0.26, mist: 0.40 }, // ilk nefes
    { fog: 0.08, moon: 1.00, shimmer: 1.00, leaf: 0.40, mist: 0.14 }, // tepe: tam doluluk
    { fog: 0.48, moon: 0.46, shimmer: 0.22, leaf: 0.14, mist: 0.58 }  // bırakış
  ];

  // Tema başına atmosferik karakter
  const THEME_MOD = {
    forest: { fogBias: 1.0, shimmerBias: 0.9, moonBias: 1.0, mistBias: 1.0 },
    island: { fogBias: 0.55, shimmerBias: 1.45, moonBias: 1.12, mistBias: 0.7 }
  };

  const SMOOTHING = 1.6; // değer/sn yaklaşma katsayısı

  const current = { fog: 0.3, moon: 0.7, shimmer: 0.5, leaf: 0.2, mist: 0.35 };
  const target = { fog: 0.3, moon: 0.7, shimmer: 0.5, leaf: 0.2, mist: 0.35 };

  let theme = 'forest';
  let reducedMotion = false;
  let lastPhase = 'inhale';
  let lastProgress = 0;
  let breathActive = false;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function applyThemeMod(targets) {
    const mod = THEME_MOD[theme] || THEME_MOD.forest;
    return {
      fog: Math.min(1, targets.fog * mod.fogBias),
      moon: Math.min(1, targets.moon * mod.moonBias),
      shimmer: Math.min(1, targets.shimmer * mod.shimmerBias),
      leaf: targets.leaf,
      mist: Math.min(1, targets.mist * mod.mistBias)
    };
  }

  function setTargets(next) {
    const mod = applyThemeMod(next);
    target.fog = mod.fog;
    target.moon = mod.moon;
    target.shimmer = mod.shimmer;
    target.leaf = mod.leaf;
    target.mist = mod.mist;
  }

  // Hareket azaltma tercihinde dünya nefesle değişmez: sabit ve sakin kalır.
  const NEUTRAL = { fog: 0.30, moon: 0.70, shimmer: 0.50, leaf: 0.22, mist: 0.36 };

  /* ---------- Nefes sinyali ---------- */

  // breathing.js her faz değişiminde ve her karede progress ile çağırır.
  // progress 0→1 arası faz ilerlemesidir; hedefler bu oranda kaydırılır.
  function onBreath(phase, progress) {
    lastPhase = phase;
    lastProgress = typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : 0;
    breathActive = true;

    // Hareket azaltma: hedefler sabit kalır, dünya dalgalanmaz
    if (reducedMotion) return;

    if (phase === 'sigh') {
      // İçe çekiş: adım indeksi ayrıca bildirilir
      return;
    }

    const from = TARGETS.inhale;
    const to = TARGETS.exhale;
    const t = lastProgress;

    setTargets({
      fog: lerp(from.fog, to.fog, t),
      moon: lerp(from.moon, to.moon, t),
      shimmer: lerp(from.shimmer, to.shimmer, t),
      leaf: lerp(from.leaf, to.leaf, t),
      mist: lerp(from.mist, to.mist, t)
    });
  }

  // Fizyolojik içe çekiş adımı (0, 1, 2)
  function onSighStep(stepIndex) {
    breathActive = true;
    lastPhase = 'sigh';
    if (reducedMotion) return;
    const t = SIGH_TARGETS[Math.max(0, Math.min(SIGH_TARGETS.length - 1, stepIndex))];
    setTargets(t);
  }

  // Nefes rehberi durduğunda dünya kendi ritmine döner
  function onBreathIdle() {
    breathActive = false;
    setTargets(NEUTRAL);
  }

  /* ---------- Güncelleme ---------- */

  function update(dt) {
    const k = reducedMotion ? 1 : Math.min(1, dt * SMOOTHING);
    current.fog = lerp(current.fog, target.fog, k);
    current.moon = lerp(current.moon, target.moon, k);
    current.shimmer = lerp(current.shimmer, target.shimmer, k);
    current.leaf = lerp(current.leaf, target.leaf, k);
    current.mist = lerp(current.mist, target.mist, k);
  }

  /* ---------- Genel arayüz ---------- */

  function setTheme(next) {
    if (next !== 'forest' && next !== 'island') return theme;
    theme = next;
    return theme;
  }

  function setReducedMotion(value) {
    reducedMotion = !!value;
    if (reducedMotion) {
      // Sabit ve sakin bir dünya: hedefleri nötrle ve anında uygula
      setTargets(NEUTRAL);
      current.fog = target.fog;
      current.moon = target.moon;
      current.shimmer = target.shimmer;
      current.leaf = target.leaf;
      current.mist = target.mist;
    }
  }

  function init(options) {
    options = options || {};
    if (options.theme) setTheme(options.theme);
    reducedMotion = !!options.reducedMotion;
    setTargets({ fog: 0.30, moon: 0.70, shimmer: 0.50, leaf: 0.22, mist: 0.36 });
    current.fog = target.fog;
    current.moon = target.moon;
    current.shimmer = target.shimmer;
    current.leaf = target.leaf;
    current.mist = target.mist;
    return api;
  }

  function get() {
    return current;
  }

  const api = {
    init: init,
    update: update,
    get: get,
    setTheme: setTheme,
    getTheme: function () { return theme; },
    setReducedMotion: setReducedMotion,
    onBreath: onBreath,
    onSighStep: onSighStep,
    onBreathIdle: onBreathIdle,
    isBreathActive: function () { return breathActive; }
  };

  return api;
})();
