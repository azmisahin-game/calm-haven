/* =========================================================
   Calm Haven / Sakin Sığınak — app.js
   Durum yönetimi, LocalStorage, klavye/dokunma, kilometre taşları.
   ========================================================= */

(function () {
  'use strict';

  const SAVE_KEY = 'calm_haven_data_v1';
  const STEPS_PER_PIXEL = 1 / 10;      // her 10 pikselde 1 adım
  const SAVE_INTERVAL = 5000;          // ms

  const BASE_SPEED = 22;               // px/s (hız ayarı bunu ölçekler)

  const MILESTONES = [
    { step: 50, text: 'Kulübenin verandasında sıcak bir fener yandı.' },
    { step: 150, text: 'Bacadan minik dumanlar tütmeye başladı.' },
    { step: 300, text: 'Verandaya kıvrılıp uyuyan bir kedi geldi.' },
    { step: 500, text: 'Ağaçların arasında ateş böcekleri uçuşuyor.' }
  ];

  const DEFAULT_SAVE = {
    steps: 0,
    totalTime: 0,
    milestones: [],
    lastVisit: null,
    settings: {
      audioEnabled: true,
      audioLevel: 0.45,
      walkSpeed: 0.45,
      breathMode: 'resonance',
      theme: 'forest',
      breathWalk: false
    }
  };

  const els = {};
  let state = null;
  let accumulators = { steps: 0 };
  let saveTimer = null;
  let sessionStart = Date.now();
  let settingsOpen = false;
  let reducedMotion = false;
  let entering = true;

  // Ses olaylarının seyrekliği: ayak sesi çok sık olmasın
  let lastStepSound = 0;
  let lastRustle = 0;
  let nextChirpAt = 0;

  /* ---------- Yardımcılar ---------- */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function deepMerge(target, source) {
    const out = Object.assign({}, target);
    Object.keys(source || {}).forEach(function (key) {
      const sv = source[key];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        out[key] = deepMerge(target[key] || {}, sv);
      } else if (sv !== undefined) {
        out[key] = sv;
      }
    });
    return out;
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    if (mins < 60) return mins + ' dk';
    const hours = Math.floor(mins / 60);
    return hours + ' sa ' + (mins % 60) + ' dk';
  }

  /* ---------- Kalıcılık ---------- */

  function saveState() {
    try {
      state.lastVisit = new Date().toISOString();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (err) {
      // Gizli sekme / kota: sessizce devam et, deneyim bozulmasın
    }
    updateHud();
  }

  function loadState() {
    let parsed = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch (err) {
      parsed = null;
    }
    state = parsed ? deepMerge(DEFAULT_SAVE, parsed) : JSON.parse(JSON.stringify(DEFAULT_SAVE));
    if (!Array.isArray(state.milestones)) state.milestones = [];
    state.steps = Math.max(0, Number(state.steps) || 0);
    state.totalTime = Math.max(0, Number(state.totalTime) || 0);
    return state;
  }

  function resetState() {
    state = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    accumulators = { steps: 0 };
    sessionStart = Date.now();
    CalmForest.setMilestones([]);
    CalmForest.setBaseSpeed(BASE_SPEED * state.settings.walkSpeed);
    applySettingsToUI();
    saveState();
    showToast('İlerleme sıfırlandı. Ada seni yeniden bekliyor.');
  }

  /* ---------- HUD & bildirimler ---------- */

  function updateHud() {
    if (els.statSteps) els.statSteps.textContent = String(Math.floor(state.steps));
    if (els.statTime) els.statTime.textContent = formatTime(elapsedSeconds());

    const next = MILESTONES.find(function (m) { return state.steps < m.step; });
    if (els.statNext) {
      els.statNext.textContent = next ? next.step + ' adım' : 'tamamlandı 🌿';
    }
  }

  function elapsedSeconds() {
    return Math.floor(state.totalTime + (Date.now() - sessionStart) / 1000);
  }

  let toastTimer = null;
  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    // Animasyonu yeniden başlat
    els.toast.style.animation = 'none';
    void els.toast.offsetWidth;
    els.toast.style.animation = '';
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastTimer = null;
      els.toast.hidden = true;
    }, 5200);
  }

  function flashMilestone() {
    if (reducedMotion) return;
    const flash = document.createElement('div');
    flash.className = 'milestone-flash';
    document.body.appendChild(flash);
    setTimeout(function () {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, 2300);
  }

  /* ---------- Kilometre taşları ---------- */

  function checkMilestones() {
    let unlocked = false;
    MILESTONES.forEach(function (m) {
      if (state.steps >= m.step && state.milestones.indexOf(m.step) === -1) {
        state.milestones.push(m.step);
        CalmForest.unlockMilestone(m.step);
        showToast(m.text);
        flashMilestone();
        unlocked = true;
      }
    });
    return unlocked;
  }

  /* ---------- Adım birikimi ---------- */

  // px: bu karede kat edilen mesafe (idle modda canvas tarafından ölçeklenmiş gelir).
  // Idle modda ~2 adım/dk birikir: 22 px/s * 0.25 hız * 0.06 ölçek = ~33 px/dk → ~2 adım.
  function accumulate(px) {
    if (!(px > 0)) return;

    accumulators.steps += px * STEPS_PER_PIXEL;

    const whole = Math.floor(accumulators.steps);
    if (whole <= 0) {
      emitWalkSounds(px);
      return;
    }

    accumulators.steps -= whole;
    state.steps += whole;
    if (checkMilestones()) saveState();
    updateHud();
    emitWalkSounds(px);
  }

  // Yürürken çok hafif işitsel geri bildirim: ayak sesi + yaprak hışırtısı.
  // Seviyeler düşüktür ve seyrek çalar; amaç dikkat çekmek değil, temas hissi.
  function emitWalkSounds(px) {
    if (!CalmAudio.isRunning()) return;

    const now = performance.now();

    // Kat edilen mesafeye göre ayak sesi sıklığı (yaklaşık her 34 px)
    if (px >= 2 && now - lastStepSound > 170) {
      lastStepSound = now;
      CalmAudio.footstep();
    }

    if (now - lastRustle > 900 && Math.random() < 0.5) {
      lastRustle = now;
      CalmAudio.rustle();
    }

    // Nadir kuş cıvıltısı: ortalama 45-90 saniyede bir
    if (nextChirpAt === 0) nextChirpAt = now + randRange(45000, 90000);
    if (now > nextChirpAt) {
      CalmAudio.chirp();
      nextChirpAt = now + randRange(45000, 90000);
    }
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  /* ---------- Etkileşim ---------- */

  function interact() {
    CalmForest.notifyInteraction();
  }

  function setHolding(value) {
    CalmForest.setHolding(value);
  }

  function toggleCruise() {
    const next = !CalmForest.isCruise();
    CalmForest.setCruise(next);
    if (els.btnCruise) {
      els.btnCruise.setAttribute('aria-pressed', String(next));
      const label = els.btnCruise.querySelector('.ctrl-label');
      if (label) label.textContent = next ? 'Akışta' : 'Kendi Akışına Bırak';
    }
    if (next) showToast('Kendi akışına bırakıldı. Ada seni yavaşça taşıyor.');
  }

  function toggleAudio() {
    const nowEnabled = CalmAudio.toggle();
    state.settings.audioEnabled = nowEnabled;
    syncAudioButton();
    saveState();
  }

  function syncAudioButton() {
    if (!els.btnAudio) return;
    const on = CalmAudio.isEnabled();
    els.btnAudio.setAttribute('aria-pressed', String(on));
    const icon = els.btnAudio.querySelector('.ctrl-icon');
    if (icon) icon.textContent = on ? '🔊' : '🔇';
    const label = els.btnAudio.querySelector('.ctrl-label');
    if (label) label.textContent = on ? 'Ses' : 'Sessiz';
    if (els.volumeRange) els.volumeRange.value = String(Math.round(CalmAudio.getLevel() * 100));
  }

  function calmDown() {
    CalmAudio.unlock();
    CalmBreathing.startSigh();
    showToast('Fizyolojik içe çekiş başladı: 3 tur boyunca nefesini takip et.');
    if (els.statSteps) updateHud();
  }

  function toggleSettings(force) {
    settingsOpen = typeof force === 'boolean' ? force : !settingsOpen;
    if (els.settingsPanel) els.settingsPanel.hidden = !settingsOpen;
    if (els.btnSettings) els.btnSettings.setAttribute('aria-expanded', String(settingsOpen));
  }

  function setBreathMode(mode) {
    state.settings.breathMode = mode;
    CalmBreathing.setMode(mode);
    if (els.segBtns) {
      els.segBtns.forEach(function (btn) {
        btn.setAttribute('aria-checked', String(btn.dataset.mode === mode));
      });
    }
    saveState();
  }

  function setTheme(theme) {
    if (theme !== 'forest' && theme !== 'island') return;
    state.settings.theme = theme;
    CalmWorld.setTheme(theme);
    CalmForest.setTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (els.themeBtns) {
      els.themeBtns.forEach(function (btn) {
        btn.setAttribute('aria-checked', String(btn.dataset.theme === theme));
      });
    }
    saveState();
    showToast(theme === 'island'
      ? 'Issız ada: gün batımı, kum ve dalgalar.'
      : 'Orman: gece mavisi, çam kokusu ve dere.');
  }

  function applyWalkSpeed(value) {
    const v = clamp(Number(value) / 100, 0.1, 1);
    state.settings.walkSpeed = v;
    CalmForest.setBaseSpeed(BASE_SPEED * v);
  }

  function applySettingsToUI() {
    const s = state.settings;

    CalmAudio.setEnabled(s.audioEnabled);
    CalmAudio.setLevel(s.audioLevel);
    syncAudioButton();

    if (els.volumeRange) els.volumeRange.value = String(Math.round(s.audioLevel * 100));
    if (els.speedRange) els.speedRange.value = String(Math.round(s.walkSpeed * 100));

    if (els.segBtns) {
      els.segBtns.forEach(function (btn) {
        btn.setAttribute('aria-checked', String(btn.dataset.mode === s.breathMode));
      });
    }
    if (els.themeBtns) {
      els.themeBtns.forEach(function (btn) {
        btn.setAttribute('aria-checked', String(btn.dataset.theme === s.theme));
      });
    }

    CalmForest.setBaseSpeed(BASE_SPEED * s.walkSpeed);

    if (s.breathMode === 'sigh') CalmBreathing.setMode('sigh');
    else CalmBreathing.setMode('resonance');

    syncBreathWalkButton();
  }

  /* ---------- Nefesle yürü (ritüel modu) ---------- */

  // Açıkken her nefes verişinde bir adım atılır; kullanıcı tuşa basmak zorunda kalmaz.
  function setBreathWalk(value) {
    state.settings.breathWalk = !!value;
    syncBreathWalkButton();
    saveState();
    showToast(state.settings.breathWalk
      ? 'Nefesle yürü açık: her verişte bir adım atacaksın. Tuşa basman gerekmiyor.'
      : 'Nefesle yürü kapalı.');
  }

  function syncBreathWalkButton() {
    if (!els.btnBreathWalk) return;
    const on = !!state.settings.breathWalk;
    els.btnBreathWalk.setAttribute('aria-pressed', String(on));
    const label = els.btnBreathWalk.querySelector('.ctrl-label');
    if (label) label.textContent = on ? 'Nefesle Yürü: Açık' : 'Nefesle Yürü';
  }

  // Nefes motoru her veriş sonunda çağırır
  function onExhaleStep() {
    if (!state.settings.breathWalk) return;
    // Bir "adım" doğrudan kamerayı ilerletir ve adım sayacına eklenir.
    const stepPx = 26;
    CalmForest.stepForward(stepPx);
    state.steps += Math.round(stepPx * STEPS_PER_PIXEL);
    if (checkMilestones()) saveState();
    updateHud();
    if (CalmAudio.isRunning()) CalmAudio.footstep();
  }

  /* ---------- Ayrılmış bölgeler ---------- */

  // Sabit üst bar ve HUD, dar ekranlarda satır atlayıp büyüyebilir.
  // Sahnenin bu alanlarla çakışmaması için gerçek yükseklikleri ölçüp
  // CSS değişkenlerine yazarız; tahmine dayalı sabit değer kullanmayız.
  function syncReservedZones() {
    const root = document.documentElement;
    const topBar = document.querySelector('.top-bar');
    const hud = document.querySelector('.hud');
    if (topBar) {
      root.style.setProperty('--header-h', Math.ceil(topBar.getBoundingClientRect().height) + 'px');
    }
    if (hud) {
      root.style.setProperty('--hud-h', Math.ceil(hud.getBoundingClientRect().height) + 'px');
    }
  }

  // Buton etiketleri gizlenince veya yazı tipi yüklenince yükseklikler değişir.
  let zoneObserver = null;
  function watchReservedZones() {
    syncReservedZones();

    if (typeof ResizeObserver === 'function') {
      zoneObserver = new ResizeObserver(syncReservedZones);
      const topBar = document.querySelector('.top-bar');
      const hud = document.querySelector('.hud');
      if (topBar) zoneObserver.observe(topBar);
      if (hud) zoneObserver.observe(hud);
    }

    window.addEventListener('resize', syncReservedZones);
    window.addEventListener('orientationchange', syncReservedZones);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncReservedZones).catch(function () { /* yoksay */ });
    }
  }

  /* ---------- Olay bağlama ---------- */

  function bindEvents() {
    // Tıklama ile yürüme: basılı tutma tekrar zorlanması yaratmasın
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', function () { setHolding(false); });

    // Space ile basılı tutma
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    window.addEventListener('touchstart', function () {
      interact();
    }, { passive: true });

    // Mobil/iOS: sayfa kaydırma ve çift dokunma yakınlaştırmayı engelle
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    // Görünürlük: arka planda zaman birikimini doğru say
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        state.totalTime = elapsedSeconds();
        sessionStart = Date.now();
        CalmBreathing.pause();
        saveState();
      } else {
        sessionStart = Date.now();
        CalmBreathing.resume();
      }
    });

    window.addEventListener('beforeunload', function () {
      state.totalTime = elapsedSeconds();
      saveState();
    });

    // Butonlar
    if (els.btnCruise) els.btnCruise.addEventListener('click', function () { interact(); toggleCruise(); });
    if (els.btnCalm) els.btnCalm.addEventListener('click', calmDown);
    if (els.btnAudio) els.btnAudio.addEventListener('click', toggleAudio);
    if (els.btnSettings) els.btnSettings.addEventListener('click', function () { toggleSettings(); });
    if (els.btnReset) els.btnReset.addEventListener('click', resetState);

    if (els.volumeRange) {
      els.volumeRange.addEventListener('input', function () {
        const v = Number(els.volumeRange.value) / 100;
        state.settings.audioLevel = v;
        CalmAudio.setLevel(v);
        if (v > 0 && !CalmAudio.isEnabled()) {
          CalmAudio.setEnabled(true);
          state.settings.audioEnabled = true;
          syncAudioButton();
        }
      });
      els.volumeRange.addEventListener('change', saveState);
    }

    if (els.speedRange) {
      els.speedRange.addEventListener('input', function () {
        applyWalkSpeed(els.speedRange.value);
      });
      els.speedRange.addEventListener('change', saveState);
    }

    if (els.segBtns) {
      els.segBtns.forEach(function (btn) {
        btn.addEventListener('click', function () { setBreathMode(btn.dataset.mode); });
      });
    }

    if (els.themeBtns) {
      els.themeBtns.forEach(function (btn) {
        btn.addEventListener('click', function () { setTheme(btn.dataset.theme); });
      });
    }

    if (els.btnBreathWalk) {
      els.btnBreathWalk.addEventListener('click', function () {
        setBreathWalk(!state.settings.breathWalk);
      });
    }

    // Ayarlar paneli dışına tıklayınca kapan
    document.addEventListener('pointerdown', function (e) {
      if (!settingsOpen) return;
      if (els.settingsPanel && els.settingsPanel.contains(e.target)) return;
      if (els.btnSettings && els.btnSettings.contains(e.target)) return;
      toggleSettings(false);
    });

    // İlk giriş perdesi
    if (els.btnEnter) {
      els.btnEnter.addEventListener('click', enterHaven);
    }

    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handler = function (e) { applyReducedMotion(e.matches); };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }
  }

  function onPointerDown(e) {
    if (entering) return;
    if (e.target && e.target.closest && e.target.closest('button, input, .settings-panel, .veil')) return;
    setHolding(true);
  }

  function onPointerUp() {
    setHolding(false);
  }

  function onKeyDown(e) {
    if (e.repeat) {
      if (e.code === 'Space') e.preventDefault();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (entering) { enterHaven(); return; }
      setHolding(true);
      return;
    }

    const key = e.key ? e.key.toLowerCase() : '';

    if (key === 'p' || key === 'P' || e.code === 'KeyP') {
      calmDown();
    } else if (key === 'm' || e.code === 'KeyM') {
      toggleAudio();
    } else if (e.key === 'Escape' || e.code === 'Escape') {
      toggleSettings();
    } else if (key === 'c' || e.code === 'KeyC') {
      toggleCruise();
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space') setHolding(false);
  }

  function enterHaven() {
    if (!entering) return;
    entering = false;

    CalmAudio.unlock();

    if (els.veil) {
      els.veil.classList.add('is-hidden');
      setTimeout(function () {
        if (els.veil) els.veil.hidden = true;
      }, 950);
    }

    CalmBreathing.resume();
    interact();
    showToast('Hoş geldin. Acele etmen gereken hiçbir şey yok.');
  }

  function applyReducedMotion(value) {
    reducedMotion = !!value;
    CalmForest.setReducedMotion(reducedMotion);
    CalmBreathing.setReducedMotion(reducedMotion);
    CalmMessages.setReducedMotion(reducedMotion);
    CalmWorld.setReducedMotion(reducedMotion);
    if (typeof CalmDiscovery !== 'undefined' && CalmDiscovery) {
      CalmDiscovery.setReducedMotion(reducedMotion);
    }
  }

  /* ---------- Başlatma ---------- */

  async function boot() {
    els.canvas = document.getElementById('forest-canvas');
    els.veil = document.getElementById('veil');
    els.btnEnter = document.getElementById('btn-enter');
    els.breathRing = document.getElementById('breath-ring');
    els.breathText = document.getElementById('breath-text');
    els.breathCounter = document.getElementById('breath-counter');
    els.messageCard = document.getElementById('message-card');
    els.messageText = document.getElementById('message-text');
    els.btnCruise = document.getElementById('btn-cruise');
    els.btnCalm = document.getElementById('btn-calm');
    els.btnAudio = document.getElementById('btn-audio');
    els.btnSettings = document.getElementById('btn-settings');
    els.settingsPanel = document.getElementById('settings-panel');
    els.volumeRange = document.getElementById('volume-range');
    els.speedRange = document.getElementById('speed-range');
    els.btnReset = document.getElementById('btn-reset');
    els.statSteps = document.getElementById('stat-steps');
    els.statTime = document.getElementById('stat-time');
    els.statNext = document.getElementById('stat-next');
    els.toast = document.getElementById('toast');
    els.segBtns = Array.prototype.slice.call(document.querySelectorAll('.seg-btn'));
    els.themeBtns = Array.prototype.slice.call(document.querySelectorAll('.theme-btn'));
    els.btnBreathWalk = document.getElementById('btn-breath-walk');

    reducedMotion = prefersReducedMotion();

    loadState();

    CalmAudio.init({
      enabled: state.settings.audioEnabled,
      level: state.settings.audioLevel
    });

    CalmWorld.init({
      theme: state.settings.theme,
      reducedMotion: reducedMotion
    });
    document.documentElement.setAttribute('data-theme', state.settings.theme);

    CalmForest.init(els.canvas, {
      reducedMotion: reducedMotion,
      baseSpeed: BASE_SPEED * state.settings.walkSpeed,
      theme: state.settings.theme,
      onAdvance: function (px) { accumulate(px); }
    });
    CalmForest.attachGlobalListeners();
    CalmForest.setMilestones(state.milestones);

    // Nefes motoru → dünya senkronizasyonu ve ritüel adım
    CalmBreathing.init({
      ring: els.breathRing,
      text: els.breathText,
      counter: els.breathCounter
    }, {
      mode: state.settings.breathMode,
      reducedMotion: reducedMotion,
      onProgress: function (phase, progress) { CalmWorld.onBreath(phase, progress); },
      onSighStep: function (stepIndex) { CalmWorld.onSighStep(stepIndex); }
    });
    CalmBreathing.onExhaleEnd(onExhaleStep);
    CalmBreathing.pause(); // Perde kalkınca başlar

    await CalmMessages.init(
      { card: els.messageCard, text: els.messageText },
      { reducedMotion: reducedMotion, intervalMs: 15000 }
    );

    await CalmDiscovery.init({
      reducedMotion: reducedMotion,
      onDiscover: function (name, message) {
        // Keşif yalnızca bir an'dır: kullanıcıdan hiçbir şey istenmez
        showToast(message);
      }
    });

    applySettingsToUI();
    updateHud();
    bindEvents();
    watchReservedZones();

    // Perde görünürken herhangi bir etkileşim sesi hazırlar
    window.addEventListener('pointerdown', function once() {
      CalmAudio.unlock();
      window.removeEventListener('pointerdown', once);
    }, { passive: true });

    saveTimer = setInterval(function () {
      state.totalTime = elapsedSeconds();
      sessionStart = Date.now();
      saveState();
    }, SAVE_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
