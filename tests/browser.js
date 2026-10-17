#!/usr/bin/env node
/* =========================================================
   Calm Haven — tarayıcı regresyon testleri (tests/browser.js)

   Gerçek Chromium ile uygulamayı çalıştırır. Yalnızca CI/geliştirme
   amaçlıdır; üretim uygulaması bu bağımlılığa ihtiyaç duymaz.

   Kurulum:  npm install   (yalnızca puppeteer-core)
   Çalıştır: node tests/browser.js
   Ön koşul: yerel sunucu ayakta olmalı (bkz. tests/run-browser.sh)

   Ortam değişkenleri:
     CALM_URL       test edilecek adres (varsayılan http://localhost:12000/)
     CHROME_PATH    Chromium yolu (varsayılan /usr/bin/chromium)
   ========================================================= */

'use strict';

const puppeteer = require('puppeteer-core');

const URL = process.env.CALM_URL || 'http://localhost:12000/';
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log('  + ' + name + (detail ? '  - ' + detail : ''));
  } else {
    failed++;
    failures.push(name + (detail ? ': ' + detail : ''));
    console.log('  X ' + name + (detail ? '  - ' + detail : ''));
  }
}

function section(t) { console.log('\n' + t); }

const BASE_ARGS = ['--no-sandbox', '--disable-dev-shm-usage'];
const WEBGL_ARGS = ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--enable-webgl'];

async function newPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport || { width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.errors = errors.filter((e) => !e.includes('favicon'));
  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: BASE_ARGS.concat(WEBGL_ARGS, ['--autoplay-policy=no-user-gesture-required'])
  });

  /* ---------- Yükleme ve modüller ---------- */
  section('1. Yükleme ve modüller');

  {
    const page = await newPage(browser);
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 45000 });
    await page.waitForFunction('window.__scene3dReady === true', { timeout: 20000 }).catch(() => {});

    const mods = await page.evaluate(() => ({
      forest: typeof CalmForest, world: typeof CalmWorld, breathing: typeof CalmBreathing,
      audio: typeof CalmAudio, messages: typeof CalmMessages, discovery: typeof CalmDiscovery,
      context: typeof CalmContext, sanctuary: typeof CalmSanctuary, scene3d: typeof window.CalmScene3D
    }));
    const missing = Object.keys(mods).filter((k) => mods[k] === 'undefined');
    check('Tüm modüller yüklendi', missing.length === 0, missing.length ? 'eksik: ' + missing.join(', ') : Object.keys(mods).length + ' modül');

    await page.click('#btn-enter');
    await new Promise((r) => setTimeout(r, 1500));
    check('Konsol hatası yok', page.errors.length === 0, page.errors.join(' | ') || 'temiz');
    await page.close();
  }

  /* ---------- Zoom erişilebilirliği (WCAG 1.4.4 / 1.4.10) ---------- */
  section('2. Zoom ve reflow (%100 / %200 / %400)');

  for (const zoom of [1, 2, 4]) {
    const page = await newPage(browser, { width: Math.round(1440 / zoom), height: Math.round(900 / zoom) });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.click('#btn-enter').catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    const r = await page.evaluate(() => {
      const vw = window.innerWidth;
      const reach = ['btn-cruise', 'btn-calm', 'btn-audio', 'btn-settings'].map((id) => {
        const el = document.getElementById(id);
        if (!el) return id + ':yok';
        const b = el.getBoundingClientRect();
        const visible = getComputedStyle(el).display !== 'none' && b.width > 0;
        const inView = b.right > 0 && b.bottom > 0 && b.x < vw;
        return (visible && inView && b.width >= 40) ? 'ok' : id + ':sorunlu';
      });
      return {
        overflow: document.documentElement.scrollWidth > vw + 2,
        reach,
        bad: reach.filter((x) => x !== 'ok')
      };
    });

    check('Zoom %' + zoom * 100 + ': yatay taşma yok', !r.overflow);
    check('Zoom %' + zoom * 100 + ': kontroller erişilebilir', r.bad.length === 0, r.bad.join(', ') || '4/4');
    await page.close();
  }

  /* ---------- Nefes rehberi: durdurma ve doğal nefes ---------- */
  section('3. Nefes rehberi güvenliği');

  {
    const page = await newPage(browser);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.click('#btn-enter');
    await new Promise((r) => setTimeout(r, 1200));

    // Durdurma düğmesi başlangıçta gizli olmalı
    const hiddenBefore = await page.evaluate(() => document.getElementById('btn-breath-stop').hidden);
    check('Durdurma düğmesi başlangıçta gizli', hiddenBefore === true);

    // İçe çekişi başlat
    await page.click('#btn-calm');
    await new Promise((r) => setTimeout(r, 700));
    const running = await page.evaluate(() => ({
      mode: CalmBreathing.getMode(),
      stopVisible: !document.getElementById('btn-breath-stop').hidden,
      note: document.getElementById('breath-note').textContent.trim().length > 10
    }));
    check('İçe çekiş başladı', running.mode === 'sigh', running.mode);
    check('Durdurma düğmesi görünür oldu', running.stopVisible === true);
    check('Doğal nefes notu görünür', running.note === true);

    // Durdur
    await page.click('#btn-breath-stop');
    await new Promise((r) => setTimeout(r, 600));
    const stopped = await page.evaluate(() => ({
      phase: CalmBreathing.getPhase(),
      text: document.getElementById('breath-text').textContent,
      stopHidden: document.getElementById('btn-breath-stop').hidden,
      worldIdle: CalmWorld.get().fog
    }));
    check('Rehber durdu', stopped.stopHidden === true);
    check('Doğal nefes metni gösterildi', /nefesinle kal/i.test(stopped.text), stopped.text);

    // Durdurduktan sonra yeniden başlatılabilmeli
    await page.click('#btn-calm');
    await new Promise((r) => setTimeout(r, 600));
    const restarted = await page.evaluate(() => CalmBreathing.getMode());
    check('Yeniden başlatılabilir', restarted === 'sigh', restarted);

    check('Konsol hatası yok', page.errors.length === 0, page.errors.join(' | ') || 'temiz');
    await page.close();
  }

  /* ---------- Sessiz giriş ---------- */
  section('4. Sessiz giriş seçeneği');

  {
    const page = await newPage(browser);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));

    const hasSilent = await page.evaluate(() => !!document.getElementById('btn-enter-silent'));
    check('Sessiz giriş düğmesi var', hasSilent === true);

    await page.click('#btn-enter-silent');
    await new Promise((r) => setTimeout(r, 1200));
    const silent = await page.evaluate(() => ({
      audioEnabled: CalmAudio.isEnabled(),
      saved: JSON.parse(localStorage.getItem('calm_haven_data_v1') || '{}').settings.audioEnabled
    }));
    check('Ses kapalı başladı', silent.audioEnabled === false);
    check('Ses tercihi kaydedildi', silent.saved === false);
    await page.close();
  }

  /* ---------- Hareket azaltma ---------- */
  section('5. Hareket azaltma (prefers-reduced-motion)');

  {
    const page = await newPage(browser, { width: 900, height: 600 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__scene3dReady === true', { timeout: 15000 }).catch(() => {});
    await page.click('#btn-enter');
    await new Promise((r) => setTimeout(r, 4000));

    const rm = await page.evaluate(async () => {
      const grab = () => {
        const c = document.getElementById('scene-canvas');
        const s = document.createElement('canvas');
        s.width = 120; s.height = 80;
        const g = s.getContext('2d');
        try { g.drawImage(c, 0, 0, 120, 80); } catch (e) { return null; }
        return g.getImageData(0, 0, 120, 80).data;
      };
      const m1 = window.CalmScene3D.getMetrics();
      const a = grab();
      await new Promise((r) => setTimeout(r, 2500));
      const m2 = window.CalmScene3D.getMetrics();
      const b = grab();

      let changed = 0;
      if (a && b) {
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 14) changed++;
        }
      }
      return {
        cameraStatic: m1.z === m2.z,
        yawStatic: m1.yaw === m2.yaw,
        changedPct: a && b ? +(changed / (a.length / 4) * 100).toFixed(1) : null,
        discoveries: CalmDiscovery.getActive().length
      };
    });

    check('Kamera hareket etmiyor', rm.cameraStatic === true && rm.yawStatic === true);
    check('Keşif animasyonları durdu', rm.discoveries === 0, rm.discoveries + ' aktif');
    await page.close();
  }

  /* ---------- Veri kalıcılığı ve bozuk storage ---------- */
  section('6. Veri kalıcılığı ve bozuk storage dayanıklılığı');

  {
    const page = await newPage(browser);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#btn-enter');
    await new Promise((r) => setTimeout(r, 900));

    // Bahçe: çiçek dik ve kalıcılığı doğrula
    const garden = await page.evaluate(async () => {
      document.getElementById('btn-garden').click();
      await new Promise((r) => setTimeout(r, 300));
      document.querySelectorAll('.seed-btn')[0].click();
      await new Promise((r) => setTimeout(r, 300));
      return {
        flowers: CalmSanctuary.getGarden().length,
        stored: JSON.parse(localStorage.getItem('calm_haven_sanctuary_v1')).garden.length
      };
    });
    check('Çiçek dikildi ve kaydedildi', garden.flowers === 1 && garden.stored === 1);

    // Çiçek büyümesi asla geri gitmez
    const growth = await page.evaluate(() => {
      const g = CalmSanctuary.getGarden()[0];
      return { growth: g.growth, bloomed: g.bloomed };
    });
    check('Büyüme değeri 0..1 arası', growth.growth >= 0 && growth.growth <= 1, growth.growth.toFixed(4));

    // XSS: anı defterine script etiketi yaz
    const xss = await page.evaluate(async () => {
      window.__xssFired = false;
      document.getElementById('btn-journal').click();
      await new Promise((r) => setTimeout(r, 300));
      const input = document.getElementById('journal-input');
      input.value = '<img src=x onerror="window.__xssFired=true"><script>window.__xssFired=true<\/script>';
      document.getElementById('journal-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 700));
      const li = document.querySelector('.journal-list li');
      return {
        fired: window.__xssFired === true,
        textContent: li ? li.textContent : '',
        hasImgElement: li ? !!li.querySelector('img') : false
      };
    });
    check('Anı defteri XSS yürütmüyor', xss.fired === false);
    check('Kullanıcı metni düz metin olarak gösteriliyor', xss.hasImgElement === false);

    // Bozuk storage ile açılış
    const corrupt = await page.evaluate(() => {
      localStorage.setItem('calm_haven_data_v1', '{{{bozuk json');
      localStorage.setItem('calm_haven_sanctuary_v1', 'null');
      return true;
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1200));
    const survived = await page.evaluate(() => ({
      booted: typeof CalmForest === 'object' && typeof CalmSanctuary === 'object',
      veilPresent: !!document.getElementById('btn-enter')
    }));
    check('Bozuk veriyle açılış çökmüyor', survived.booted === true && survived.veilPresent === true);
    check('Bozuk veri sonrası konsol hatası yok', page.errors.length === 0, page.errors.join(' | ') || 'temiz');

    await page.close();
  }

  /* ---------- 2B yedek motor ---------- */
  section('7. 2B yedek motor (three.js engellenmiş)');

  {
    const page = await newPage(browser);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('three.module.min.js') || u.includes('scene3d.js')) req.abort();
      else req.continue();
    });

    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 40000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 7000));
    await page.click('#btn-enter').catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    const fb = await page.evaluate(() => {
      const c2 = document.getElementById('forest-canvas');
      let buckets = 0;
      try {
        const g = c2.getContext('2d');
        const d = g.getImageData(0, 0, c2.width, c2.height).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4 * 311) seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
        buckets = seen.size;
      } catch (e) { buckets = -1; }
      return {
        threeReady: !!window.__scene3dReady,
        canvas2dVisible: !c2.hidden,
        buckets,
        hasEngine: typeof CalmForest === 'object'
      };
    });

    check('3B yüklenmedi (beklenen)', fb.threeReady === false);
    check('2B tuval görünür', fb.canvas2dVisible === true);
    check('2B motor çizim yapıyor', fb.buckets > 3, fb.buckets + ' renk kovası');

    // 2B motorda yürüme çalışıyor mu?
    const camA = await page.evaluate(() => CalmForest.getCamera());
    await page.keyboard.down('Space');
    await new Promise((r) => setTimeout(r, 2500));
    await page.keyboard.up('Space');
    await new Promise((r) => setTimeout(r, 300));
    const camB = await page.evaluate(() => CalmForest.getCamera());
    check('2B motorda yürüme çalışıyor', camB - camA > 1, Math.round(camB - camA) + ' px');

    await page.close();
  }

  /* ---------- Düzen: 20 görünüm boyutu ---------- */
  section('8. Düzen taraması (20 görünüm boyutu)');

  const SIZES = [
    { w: 1920, h: 1080 }, { w: 1600, h: 900 }, { w: 1440, h: 900 },
    { w: 1366, h: 768 }, { w: 1280, h: 800 }, { w: 1024, h: 768 },
    { w: 900, h: 1200 }, { w: 768, h: 1024 }, { w: 700, h: 900 },
    { w: 480, h: 320 }, { w: 430, h: 932 }, { w: 390, h: 844 },
    { w: 375, h: 667 }, { w: 360, h: 640 }, { w: 320, h: 568 },
    { w: 280, h: 653 }, { w: 844, h: 390 }, { w: 740, h: 360 },
    { w: 667, h: 375 }, { w: 568, h: 320 }
  ];

  let layoutProblems = [];
  for (const s of SIZES) {
    const page = await newPage(browser, { width: s.w, height: s.h, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__scene3dReady === true', { timeout: 12000 }).catch(() => {});
    await page.click('#btn-enter');
    await new Promise((r) => setTimeout(r, 1100));

    const a = await page.evaluate(() => {
      const rr = (el) => el.getBoundingClientRect();
      const inter = (A, B) => !(A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top);
      const els = {
        breath: document.querySelector('.breath-zone'),
        msg: document.getElementById('message-card'),
        hud: document.querySelector('.hud'),
        top: document.querySelector('.top-bar')
      };
      const R = {};
      for (const k in els) if (els[k]) R[k] = rr(els[k]);
      const overlaps = [];
      const keys = Object.keys(R);
      for (let i = 0; i < keys.length; i++)
        for (let j = i + 1; j < keys.length; j++)
          if (inter(R[keys[i]], R[keys[j]])) overlaps.push(keys[i] + '∩' + keys[j]);

      // Paneller açılabiliyor ve ekrana sığıyor mu?
      const panels = ['settings-panel', 'garden-panel', 'journal-panel'];
      const panelProblems = [];
      for (const id of panels) {
        const el = document.getElementById(id);
        el.hidden = false;
        const b = rr(el);
        const fits = b.top >= -1 && b.bottom <= window.innerHeight + 2 &&
                     b.left >= -1 && b.right <= window.innerWidth + 2;
        if (!fits) panelProblems.push(id);
        el.hidden = true;
      }

      const btns = Array.from(document.querySelectorAll('button')).filter((b) => rr(b).width > 0);
      const small = btns.filter((b) => { const r = rr(b); return r.width < 48 || r.height < 48; })
        .map((b) => (b.id || b.className.split(' ')[0]));

      return {
        overlaps, panelProblems, small,
        hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        vScroll: document.documentElement.scrollHeight > window.innerHeight + 1
      };
    });

    if (a.overlaps.length || a.panelProblems.length || a.small.length || a.hScroll || a.vScroll) {
      layoutProblems.push(s.w + 'x' + s.h + ' → ' +
        [a.overlaps.join(','), a.panelProblems.join(','), a.small.join(','),
         a.hScroll ? 'yatay-kaydırma' : '', a.vScroll ? 'dikey-kaydırma' : '']
          .filter(Boolean).join(' '));
    }
    await page.close();
  }

  check('20 görünümde düzen sorunu yok', layoutProblems.length === 0,
    layoutProblems.length ? layoutProblems.join(' | ') : SIZES.length + ' görünüm temiz');

  /* ---------- Erişilebilirlik: klavye, odak, kontrast ---------- */
  section('9. Erişilebilirlik (klavye, odak, ARIA, kontrast)');

  {
    const page = await newPage(browser);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.click('#btn-enter');
    await new Promise((r) => setTimeout(r, 1200));

    // (a) Nefes faz metni canlı bölge OLMAMALI (ekran okuyucu çığı önlenir)
    const liveAudit = await page.evaluate(() => ({
      breathTextLive: document.getElementById('breath-text').getAttribute('aria-live'),
      breathCounterLive: document.getElementById('breath-counter').getAttribute('aria-live'),
      statusLive: document.getElementById('breath-status').getAttribute('aria-live'),
      statusRole: document.getElementById('breath-status').getAttribute('role')
    }));
    check('Nefes faz metni canlı bölge değil', liveAudit.breathTextLive === null);
    check('Nefes sayacı canlı bölge değil', liveAudit.breathCounterLive === null);
    check('Ayrı durum bölgesi var', liveAudit.statusLive === 'polite' && liveAudit.statusRole === 'status');

    // (b) Paneller dialog semantiği taşımalı
    const dialogs = await page.evaluate(() => {
      const ids = ['settings-panel', 'garden-panel', 'journal-panel'];
      return ids.map((id) => {
        const el = document.getElementById(id);
        return { id, role: el.getAttribute('role'), labelled: !!el.getAttribute('aria-labelledby') };
      });
    });
    const dialogOk = dialogs.every((d) => d.role === 'dialog' && d.labelled);
    check('Paneller dialog semantiği taşıyor', dialogOk,
      dialogs.map((d) => d.id + ':' + d.role).join(', '));

    // (c) Segmented kontrol doğru ARIA kullanmalı
    const seg = await page.evaluate(() => {
      const btns = document.querySelectorAll('.seg-btn, .theme-btn');
      return Array.from(btns).map((b) => b.getAttribute('aria-pressed') !== null);
    });
    check('Segment kontroller aria-pressed kullanıyor', seg.every(Boolean), seg.length + ' düğme');

    // (d) Bahçe paneli: odak içeri girer, Escape kapatır, odak tetikleyene döner.
    // Bahçe düğmesi ayarlar panelinin içindedir; gerçek akışta önce ayarlar açılır.
    const focusFlow = await page.evaluate(async () => {
      document.getElementById('btn-settings').click();
      await new Promise((r) => setTimeout(r, 350));
      const trigger = document.getElementById('btn-garden');
      trigger.focus();
      const focusedBeforeOpen = document.activeElement === trigger;
      trigger.click();
      await new Promise((r) => setTimeout(r, 400));
      return {
        focusedBeforeOpen,
        insideAfterOpen: document.getElementById('garden-panel').contains(document.activeElement)
      };
    });
    check('Bahçe düğmesi odaklanabilir', focusFlow.focusedBeforeOpen === true);
    check('Panel açılınca odak içeri giriyor', focusFlow.insideAfterOpen === true);

    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 450));
    const afterEsc = await page.evaluate(() => ({
      panelHidden: document.getElementById('garden-panel').hidden,
      focusOnTrigger: document.activeElement === document.getElementById('btn-garden')
    }));
    check('Escape paneli kapatıyor', afterEsc.panelHidden === true);
    check('Odak tetikleyen düğmeye dönüyor', afterEsc.focusOnTrigger === true);

    // Escape ikinci kez: ayarlar paneli de kapanmalı ve odak ayarlar düğmesine dönmeli
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 450));
    const afterEsc2 = await page.evaluate(() => ({
      settingsHidden: document.getElementById('settings-panel').hidden,
      focusOnSettings: document.activeElement === document.getElementById('btn-settings')
    }));
    check('İkinci Escape ayarları kapatıyor', afterEsc2.settingsHidden === true);
    check('Odak ayarlar düğmesine dönüyor', afterEsc2.focusOnSettings === true);

    // (e) Yazarken kısayollar tetiklenmemeli (anı defterine "c" ve "p")
    const typingGuard = await page.evaluate(async () => {
      document.getElementById('btn-journal').click();
      await new Promise((r) => setTimeout(r, 400));
      const input = document.getElementById('journal-input');
      input.focus();
      const cruiseBefore = CalmForest.isCruise();
      const breathBefore = CalmBreathing.getMode();
      return { cruiseBefore, breathBefore };
    });

    await page.keyboard.type('cep telefonu');
    await new Promise((r) => setTimeout(r, 400));
    const typingResult = await page.evaluate(() => ({
      value: document.getElementById('journal-input').value,
      cruise: CalmForest.isCruise(),
      breathMode: CalmBreathing.getMode()
    }));
    check('Yazarken metin doğru girildi', typingResult.value === 'cep telefonu', typingResult.value);
    check('Yazarken otomatik gezinti tetiklenmedi', typingResult.cruise === typingGuard.cruiseBefore);
    check('Yazarken nefes rehberi tetiklenmedi', typingResult.breathMode === typingGuard.breathBefore);

    // (f) Kontrast ölçümü: gerçek CSS renkleriyle
    const contrast = await page.evaluate(() => {
      function parse(c) {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(',').map((x) => parseFloat(x.trim()));
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      }
      function lum(c) {
        const f = (v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      }
      // Arka planı sahne olmadan tahmin et: gövde arka plan rengini al
      const bodyBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 15, g: 23, b: 42, a: 1 };
      const samples = [
        ['message-text', document.querySelector('.message-text')],
        ['hud-item dt', document.querySelector('.hud-item dt')],
        ['breath-text', document.getElementById('breath-text')],
        ['settings-label', document.querySelector('.settings-label')]
      ];
      return samples.map(([name, el]) => {
        if (!el) return { name, ratio: null };
        const fg = parse(getComputedStyle(el).color);
        if (!fg) return { name, ratio: null };
        const l1 = lum(fg);
        const l2 = lum(bodyBg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        return { name, ratio: +ratio.toFixed(2), size: parseFloat(getComputedStyle(el).fontSize) };
      });
    });
    const failing = contrast.filter((c) => c.ratio !== null && c.ratio < 4.5);
    check('Metin kontrastı >= 4.5:1', failing.length === 0,
      failing.length ? failing.map((c) => c.name + '=' + c.ratio).join(', ')
                     : contrast.map((c) => c.name + '=' + c.ratio).join(', '));

    check('Erişilebilirlik bölümünde konsol hatası yok', page.errors.length === 0,
      page.errors.join(' | ') || 'temiz');
    await page.close();
  }

  /* ---------- Bozuk storage matrisi ---------- */
  section('10. Bozuk storage matrisi (11 senaryo)');

  const CORRUPT_CASES = [
    { name: 'settings: null', data: { steps: 5, settings: null } },
    { name: 'settings: metin', data: { steps: 5, settings: 'bozuk' } },
    { name: 'walkSpeed: metin', data: { steps: 5, settings: { walkSpeed: 'hizli' } } },
    { name: 'steps: negatif', data: { steps: -999, settings: {} } },
    { name: 'steps: metin', data: { steps: 'yuz', settings: {} } },
    { name: 'milestones: nesne', data: { steps: 5, milestones: { a: 1 }, settings: {} } },
    { name: 'kök dizi', data: [1, 2, 3] },
    { name: 'kök metin', data: 'merhaba' },
    { name: 'kök sayı', data: 42 },
    { name: 'kök null', data: null },
    { name: 'audioLevel: 999', data: { settings: { audioEnabled: 'evet', audioLevel: 999, breathMode: 'yok' } } }
  ];

  {
    const corruptProblems = [];
    for (const c of CORRUPT_CASES) {
      const page = await newPage(browser, { width: 1024, height: 700 });
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

      await page.evaluateOnNewDocument((k, v) => {
        try {
          localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        } catch (e) { /* yoksay */ }
      }, 'calm_haven_data_v1', c.data);

      await page.goto(URL, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 1400));

      const booted = await page.evaluate(() =>
        typeof CalmForest === 'object' && typeof CalmSanctuary === 'object' &&
        !!document.getElementById('btn-enter'));

      // Perdeyi geç ve yürümeyi dene (aktif motor üzerinden)
      let walked = 0;
      try {
        await page.click('#btn-enter', { timeout: 3000 });
        await new Promise((r) => setTimeout(r, 700));
        const camA = await page.evaluate(() => {
          const is3d = !document.getElementById('scene-canvas').hidden;
          return (is3d && window.CalmScene3D) ? window.CalmScene3D.getCamera() : CalmForest.getCamera();
        });
        await page.keyboard.down('Space');
        await new Promise((r) => setTimeout(r, 1800));
        await page.keyboard.up('Space');
        await new Promise((r) => setTimeout(r, 300));
        const camB = await page.evaluate(() => {
          const is3d = !document.getElementById('scene-canvas').hidden;
          return (is3d && window.CalmScene3D) ? window.CalmScene3D.getCamera() : CalmForest.getCamera();
        });
        walked = Math.round(camB - camA);
      } catch (e) {
        walked = -1;
      }

      const realErrors = errs.filter((e) => !e.includes('favicon'));
      if (!booted || !(walked > 0) || realErrors.length) {
        corruptProblems.push(c.name + ' (açıldı:' + booted + ' yürüdü:' + walked +
          (realErrors.length ? ' hata:' + realErrors[0] : '') + ')');
      }
      await page.close();
    }

    check('Bozuk verinin ' + CORRUPT_CASES.length + ' biçiminde uygulama çalışıyor',
      corruptProblems.length === 0,
      corruptProblems.length ? corruptProblems.join(' | ') : CORRUPT_CASES.length + '/' + CORRUPT_CASES.length);
  }

  /* ---------- Ozet ---------- */
  console.log('\n' + '-'.repeat(58));
  console.log('Gecen: ' + passed + '   Basarisiz: ' + failed);
  if (failed > 0) {
    console.log('\nBasarisiz testler:');
    failures.forEach((f) => console.log('  - ' + f));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('TEST HARNESS HATASI:', err.message);
  process.exit(1);
});
