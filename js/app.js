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

  // Aktif görsel motor: 3D (scene3d.js) varsa o, yoksa 2D (canvas.js).
  // WebGL yoksa veya three.js yüklenemezse otomatik olarak 2D'ye düşülür;
  // böylece hiçbir koşulda boş ekran oluşmaz.
  let Engine = null;

  const els = {};
  let state = null;
  let accumulators = { steps: 0 };
  let saveTimer = null;
  let contextTimer = null;
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
    Engine.setMilestones([]);
    Engine.setBaseSpeed(BASE_SPEED * state.settings.walkSpeed);
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
        Engine.unlockMilestone(m.step);
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
    Engine.notifyInteraction();
  }

  function setHolding(value) {
    Engine.setHolding(value);
  }

  function toggleCruise() {
    const next = !Engine.isCruise();
    Engine.setCruise(next);
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
    // Durdurma düğmesi görünür olsun: kullanıcı her an çıkabilmeli
    if (els.btnBreathStop) els.btnBreathStop.hidden = false;
    showToast('İçe çekiş başladı. Rahatsızlık duyarsan durdur ve doğal nefesine dön.');
    if (els.statSteps) updateHud();
  }

  // İçe çekiş protokolü tamamlandığında bağlamsal mesaj tetiklenir
  function onSighComplete() {
    if (typeof CalmContext !== 'undefined' && CalmContext) {
      CalmContext.onBreathEvent('sigh-complete');
    }
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
    Engine.setTheme(theme);
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
    Engine.setBaseSpeed(BASE_SPEED * v);
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

    Engine.setBaseSpeed(BASE_SPEED * s.walkSpeed);

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
    Engine.stepForward(stepPx);
    state.steps += Math.round(stepPx * STEPS_PER_PIXEL);
    if (checkMilestones()) saveState();
    updateHud();
    if (CalmAudio.isRunning()) CalmAudio.footstep();
  }

  /* ---------- Motor yükseltmesi (2D → 3D) ---------- */

  // scene3d.js ES modülü kendini async yükler ve başarılıysa
  // window.__scene3dReady / window.CalmScene3D tanımlar.
  // WebGL yoksa veya three.js gelmezse 2D motor çalışmaya devam eder.
  function setupEngineUpgrade() {
    if (!els.canvas || !els.canvas3d) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 60;   // ~6 sn
    const poll = setInterval(function () {
      attempts++;
      if (window.CalmScene3D && window.__scene3dReady) {
        clearInterval(poll);
        promoteTo3D();
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(poll);
        // 3D gelmedi: 2D motor sessizce devam eder, kullanıcı fark etmez
      }
    }, 100);
  }

  function promoteTo3D() {
    const previous = Engine;

    // 2D motoru durdur ve görünürlüğünü kapat
    try { previous.pause(); } catch (err) { /* yoksay */ }
    if (els.canvas) els.canvas.hidden = true;

    // 3B motoru aynı görünüm tuvalinde başlat
    const started = window.CalmScene3D.init(els.canvas3d, {
      reducedMotion: reducedMotion,
      baseSpeed: BASE_SPEED * state.settings.walkSpeed,
      theme: state.settings.theme,
      onAdvance: function (px) { accumulate(px); }
    });

    if (!started) {
      // 3D başlatılamadı (WebGL bağlamı yok): 2D'ye geri dön
      if (els.canvas) els.canvas.hidden = false;
      window.__scene3dReady = false;
      try { previous.start(); } catch (err) { /* yoksay */ }
      return;
    }

    Engine = started;
    els.canvas3d.hidden = false;
    Engine.attachGlobalListeners();
    Engine.setMilestones(state.milestones);
    Engine.setReducedMotion(reducedMotion);
    // Kullanıcı 2D'de bir miktar yürümüşse ilerlemeyi taşı
    Engine.notifyInteraction();
    showToast('Derinlik açıldı: W/S ile yürü, A/D ile dön.');
  }

  /* ---------- Bölge (zone) algılama ---------- */

  // Konuma göre bağlamsal mesaj tetikler. 3D'de gerçek yön kullanılır.
  let lastZone = null;
  let dwellSeconds = 0;

  function detectZone() {
    const m = Engine.getMetrics ? Engine.getMetrics() : null;
    if (!m) return null;

    const theme = state.settings.theme;
    // Sağa/sola dönüşle dere veya deniz tarafına bakmak bölgeyi belirler
    const yaw = m.yaw || 0;
    const forward = Engine.getCamera();

    if (theme === 'island') {
      // Deniz her yönde; kıyıya yakınlık ilerlemeyle değişir
      if (Math.abs(yaw) > 0.5) return 'shore';
      if (forward > 400) return 'hill';
      return 'forest';
    }

    // Orman: sola bakınca dere, sağa bakınca tepe
    if (yaw > 0.35) return 'creek';
    if (yaw < -0.35) return 'hill';
    if (forward > 900) return 'hill';
    return 'forest';
  }

  function checkZone() {
    const zone = detectZone();
    if (!zone) return;

    if (zone !== lastZone) {
      lastZone = zone;
      if (typeof CalmContext !== 'undefined' && CalmContext) {
        CalmContext.onZone(zone);
      }
    }
  }

  /* ---------- Bağlamsal mesaj yerleşimi ---------- */

  // Bağlamsal mesaj gösterilirken normal rotasyon duraklatılır,
  // böylece iki metin birbirine karışmaz.
  let contextActive = false;

  function setContextMessage(text) {
    contextActive = true;
    if (typeof CalmMessages !== 'undefined' && CalmMessages) CalmMessages.stop();
    if (els.messageText) els.messageText.textContent = text;
    if (els.messageCard) els.messageCard.style.opacity = '1';
  }

  function clearContextMessage() {
    contextActive = false;
    if (typeof CalmMessages !== 'undefined' && CalmMessages) CalmMessages.start();
  }

  // discovery.js bize görünen adı verir; context.js kimlik bekler
  const DISCOVERY_IDS = {
    'Kayan Yıldız': 'shooting_star',
    'Balıkçıl': 'heron',
    'Kelebek': 'butterfly',
    'Ateş Böceği': 'firefly'
  };

  function discoveryIdFor(name) {
    return DISCOVERY_IDS[name] || null;
  }

  /* ---------- Saniyelik bağlam kontrolü ---------- */

  // Bölge, dwell ve nefes olaylarını düzenli aralıkla değerlendirir.
  // Ana çizim döngüsüne yük bindirmemek için ayrı ve seyrek çalışır.
  function contextTick() {
    if (entering) return;
    if (typeof CalmContext === 'undefined' || !CalmContext) return;

    CalmContext.update(1);
    checkZone();

    // Uzun süre yürüme: toplam adım ilerlemesine göre
    if (Engine.isIdle && Engine.isIdle()) {
      dwellSeconds += 1;
      CalmContext.onDwell(dwellSeconds);
    } else {
      dwellSeconds = 0;
    }

    // Ada temasında kıyıda deniz kabuğu bulunabilir.
    // Yeterince kabuk birikince sal kendiliğinden hazır olur: kaynak
    // harcanmaz, hiçbir şey eksilmez.
    maybeFindShell();
    maybeBuildRaft();
  }

  // Sal: ada temasında 8 kabuk birikince hazır olur (kabuklar eksilmez)
  function maybeBuildRaft() {
    if (state.settings.theme !== 'island') return;
    if (CalmSanctuary.hasRaft()) return;
    if (CalmSanctuary.totalShells() < 8) return;
    if (CalmSanctuary.buildRaft()) {
      updateSanctuarySummary();
      showToast('Topladığın kabuklardan bir sal yaptın. Hiçbiri eksilmedi.');
    }
  }

  /* ---------- Sığınak: bahçe, kabuklar, anı defteri ---------- */

  function renderGarden() {
    if (!els.gardenGrid) return;
    const plots = CalmSanctuary.getGarden();
    const byPos = Object.create(null);
    plots.forEach(function (p) { byPos[p.x + ',' + p.y] = p; });

    els.gardenGrid.innerHTML = '';
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 6; x++) {
        const plot = document.createElement('div');
        plot.className = 'garden-plot';
        const f = byPos[x + ',' + y];
        if (f) {
          plot.classList.add('is-planted');
          plot.title = f.name + (f.bloomed ? ' (açtı)' : ' (büyüyor)');
          const el = document.createElement('div');
          el.className = 'garden-flower';
          el.style.background = f.color;
          // Büyüme: küçükten olgun boyuta yumuşak geçiş, sonra sabit
          const scale = 0.35 + f.growth * 0.65;
          el.style.transform = 'scale(' + scale.toFixed(3) + ')';
          el.style.opacity = String(0.45 + f.growth * 0.55);
          plot.appendChild(el);
        }
        els.gardenGrid.appendChild(plot);
      }
    }
    updateSanctuarySummary();
  }

  function renderSeeds() {
    if (!els.seedRow) return;
    els.seedRow.innerHTML = '';
    CalmSanctuary.FLOWER_KINDS.forEach(function (k) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seed-btn';
      b.setAttribute('aria-label', k.name + ' dik');
      const sw = document.createElement('span');
      sw.className = 'seed-swatch';
      sw.style.background = k.color;
      b.appendChild(sw);
      const t = document.createElement('span');
      t.textContent = k.name;
      b.appendChild(t);
      b.addEventListener('click', function () {
        const planted = CalmSanctuary.plant(k.id);
        if (planted) {
          renderGarden();
          showToast(k.name + ' diktin. Büyüyecek ve hep orada kalacak.');
        } else {
          showToast('Bahçen doldu. Hiçbir çiçek kaybolmadı, hepsi yerinde.');
        }
      });
      els.seedRow.appendChild(b);
    });
  }

  function renderJournal() {
    if (!els.journalList) return;
    const entries = CalmSanctuary.getJournal();
    els.journalList.innerHTML = '';
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'journal-empty';
      li.textContent = 'Henüz bir anı yok. İstediğinde bir şey yazabilirsin.';
      els.journalList.appendChild(li);
      return;
    }
    entries.forEach(function (e) {
      const li = document.createElement('li');
      li.textContent = e.text;
      const d = document.createElement('span');
      d.className = 'journal-date';
      try {
        d.textContent = new Date(e.at).toLocaleString('tr-TR');
      } catch (err) {
        d.textContent = '';
      }
      li.appendChild(d);
      els.journalList.appendChild(li);
    });
  }

  function updateSanctuarySummary() {
    if (!els.sanctuarySummary) return;
    const flowers = CalmSanctuary.getGarden().length;
    const shells = CalmSanctuary.totalShells();
    const parts = [];
    parts.push(flowers ? flowers + ' çiçek' : 'Bahçen boş');
    if (shells) parts.push(shells + ' deniz kabuğu');
    if (CalmSanctuary.hasRaft()) parts.push('salın hazır');
    els.sanctuarySummary.textContent = parts.join(' · ') + '.';
  }

  function togglePanel(which, force) {
    const el = which === 'garden' ? els.gardenPanel : els.journalPanel;
    if (!el) return;
    const open = typeof force === 'boolean' ? force : el.hidden;
    el.hidden = !open;

    // Aynı anda yalnızca bir panel açık kalsın
    if (open) {
      const other = which === 'garden' ? els.journalPanel : els.gardenPanel;
      if (other) other.hidden = true;
      if (which === 'garden') { renderGarden(); renderSeeds(); }
      else renderJournal();
    }
  }

  // Ada temasında kıyıda kabuk bulunur; toplamak kayıp değildir.
  let lastShellCheck = 0;
  function maybeFindShell() {
    if (state.settings.theme !== 'island') return;
    if (!CalmSanctuary) return;
    const now = Date.now();
    if (now - lastShellCheck < 60000) return;   // dakikada en fazla bir deneme
    lastShellCheck = now;

    // Kıyıya yakınken ve nadiren
    const zone = detectZone();
    if (zone !== 'shore' && zone !== 'forest') return;
    if (Math.random() > 0.25) return;

    const kind = CalmSanctuary.findShell();
    updateSanctuarySummary();
    if (els.shellToast) {
      els.shellToast.textContent = kind.name + ' buldun. Koleksiyonunda, kaybolmayacak.';
      els.shellToast.hidden = false;
      clearTimeout(shellToastTimer);
      shellToastTimer = setTimeout(function () { els.shellToast.hidden = true; }, 5200);
    }
  }

  let shellToastTimer = null;

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

    // NOT: `gesturestart` üzerinde preventDefault çağrılmaz.
    // Bu olay iOS Safari'de iki parmakla sayfa yakınlaştırmasını engeller ve
    // az gören kullanıcılar için erişilebilirliği bozar. Sahne, dokunmayı
    // sayfa yakınlaştırmasını kısıtlamadan da yönetebilir.

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

    // Sığınak: bahçe ve anı defteri
    if (els.btnGarden) els.btnGarden.addEventListener('click', function () { togglePanel('garden'); });
    if (els.btnJournal) els.btnJournal.addEventListener('click', function () { togglePanel('journal'); });
    if (els.btnGardenClose) els.btnGardenClose.addEventListener('click', function () { togglePanel('garden', false); });
    if (els.btnJournalClose) els.btnJournalClose.addEventListener('click', function () { togglePanel('journal', false); });

    if (els.journalForm) {
      els.journalForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!els.journalInput) return;
        const entry = CalmSanctuary.addJournal(els.journalInput.value);
        if (entry) {
          els.journalInput.value = '';
          renderJournal();
          showToast('Notun yalnızca bu cihazda saklanıyor.');
        }
      });
    }

    if (els.btnJournalClear) {
      els.btnJournalClear.addEventListener('click', function () {
        CalmSanctuary.clearJournal();
        renderJournal();
        showToast('Anı defteri temizlendi.');
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
      els.btnEnter.addEventListener('click', function () { enterHaven(false); });
    }
    if (els.btnEnterSilent) {
      els.btnEnterSilent.addEventListener('click', function () { enterHaven(true); });
    }
    if (els.btnBreathStop) {
      els.btnBreathStop.addEventListener('click', stopBreathing);
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
      if (entering) { enterHaven(false); return; }
      setHolding(true);
      return;
    }

    // 3B sahnede yön kontrolü: W/S yürü, A/D dön
    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      if (entering) return;
      setHolding(true);
      return;
    }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      // Geri gitme yok: nefes ritmini bozmasın, sadece yavaşlat
      return;
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      if (Engine.setTurnInput) Engine.setTurnInput(-1);
      return;
    }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      if (Engine.setTurnInput) Engine.setTurnInput(1);
      return;
    }

    const key = e.key ? e.key.toLowerCase() : '';

    if (key === 'p' || e.code === 'KeyP') {
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
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') setHolding(false);
    if (e.code === 'KeyA' || e.code === 'ArrowLeft' ||
        e.code === 'KeyD' || e.code === 'ArrowRight') {
      if (Engine.setTurnInput) Engine.setTurnInput(0);
    }
  }

  // silent=true: kullanıcı sesi kapalı başlatmayı seçti
  function enterHaven(silent) {
    if (!entering) return;
    entering = false;

    if (silent) {
      state.settings.audioEnabled = false;
      CalmAudio.setEnabled(false);
      saveState();
      syncAudioButton();
    } else {
      CalmAudio.unlock();
    }

    if (els.veil) {
      els.veil.classList.add('is-hidden');
      setTimeout(function () {
        if (els.veil) els.veil.hidden = true;
      }, 950);
    }

    CalmBreathing.resume();
    interact();
    showToast(silent
      ? 'Hoş geldin. Ses kapalı; istediğinde açabilirsin.'
      : 'Hoş geldin. Acele etmen gereken hiçbir şey yok.');
  }

  // Nefes rehberini durdur ve doğal nefese dön.
  // Cezalandırıcı değildir: rehber duraklar, sahne sakin kalır.
  function stopBreathing() {
    CalmBreathing.stop();
    CalmWorld.onBreathIdle();
    setBreathText('Kendi nefesinle kal...');
    if (els.breathCounter) els.breathCounter.textContent = '';
    if (els.btnBreathStop) els.btnBreathStop.hidden = true;
    showToast('Nefes rehberi durdu. Doğal nefesinle kalabilirsin.');
  }

  function setBreathText(text) {
    if (els.breathText) els.breathText.textContent = text;
  }

  function applyReducedMotion(value) {
    reducedMotion = !!value;
    Engine.setReducedMotion(reducedMotion);
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
    els.canvas3d = document.getElementById('scene-canvas');
    els.veil = document.getElementById('veil');
    els.btnEnter = document.getElementById('btn-enter');
    els.btnEnterSilent = document.getElementById('btn-enter-silent');
    els.btnBreathStop = document.getElementById('btn-breath-stop');
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

    // Sığınak öğeleri
    els.gardenPanel = document.getElementById('garden-panel');
    els.journalPanel = document.getElementById('journal-panel');
    els.gardenGrid = document.getElementById('garden-grid');
    els.seedRow = document.getElementById('seed-row');
    els.journalList = document.getElementById('journal-list');
    els.journalForm = document.getElementById('journal-form');
    els.journalInput = document.getElementById('journal-input');
    els.btnGarden = document.getElementById('btn-garden');
    els.btnJournal = document.getElementById('btn-journal');
    els.btnGardenClose = document.getElementById('btn-garden-close');
    els.btnJournalClose = document.getElementById('btn-journal-close');
    els.btnJournalClear = document.getElementById('btn-journal-clear');
    els.sanctuarySummary = document.getElementById('sanctuary-summary');
    els.shellToast = document.getElementById('shell-toast');

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

    // Görsel motor seçimi: 3D varsa onu kullan, yoksa 2D'ye düş.
    // scene3d.js bir ES modülüdür ve kendini async yükler; hazır olana kadar
    // 2D motorla başlarız, 3D hazır olunca sessizce devralır.
    Engine = CalmForest;
    Engine.init(els.canvas, {
      reducedMotion: reducedMotion,
      baseSpeed: BASE_SPEED * state.settings.walkSpeed,
      theme: state.settings.theme,
      onAdvance: function (px) { accumulate(px); }
    });
    Engine.attachGlobalListeners();
    Engine.setMilestones(state.milestones);

    setupEngineUpgrade();

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
    CalmBreathing.onSighComplete(onSighComplete);
    CalmBreathing.pause(); // Perde kalkınca başlar

    await CalmMessages.init(
      { card: els.messageCard, text: els.messageText },
      { reducedMotion: reducedMotion, intervalMs: 15000 }
    );

    await CalmDiscovery.init({
      reducedMotion: reducedMotion,
      onDiscover: function (name, message) {
        // Keşif yalnızca bir an'dır: kullanıcıdan hiçbir şey istenmez.
        // Bağlamsal mesaj varsa o öne geçer.
        let handled = false;
        if (typeof CalmContext !== 'undefined' && CalmContext) {
          handled = !!CalmContext.onDiscovery(discoveryIdFor(name));
        }
        if (!handled) showToast(message);
      }
    });

    await CalmContext.init({
      onShow: function (text) {
        // Bağlamsal mesaj öne geçer; rotasyon sonra normale döner
        setContextMessage(text);
      },
      onRestore: function () {
        clearContextMessage();
      }
    });

    CalmSanctuary.init({
      onGardenChange: function () { renderGarden(); },
      onShellFound: function () { updateSanctuarySummary(); }
    });
    renderSeeds();
    updateSanctuarySummary();

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

    // Bağlamsal mesajlar için saniyelik değerlendirme
    contextTimer = setInterval(contextTick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
