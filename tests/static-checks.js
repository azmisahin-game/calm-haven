#!/usr/bin/env node
/* =========================================================
   Calm Haven — statik denetimler (tests/static-checks.js)

   Derleme adımı gerektirmez ve yalnızca Node.js'in kendi modüllerini
   kullanır (bağımlılık yok). Üretim uygulaması bu dosyaya bağlı değildir.

   Denetlenenler:
   1. Tüm JS dosyalarının sözdizimi (ES modülleri dahil)
   2. Tüm JSON dosyalarının geçerliliği ve beklenen şekli
   3. index.html içindeki yerel bağlantıların gerçekten var olması
   4. Göreceli yol kuralı (baştaki '/' yasak)
   5. Tema paletlerinin üç yerde tutarlı olması
   6. Yedek (FALLBACK) havuzlarının JSON dosyalarıyla uyumlu olması
   7. Metin kodlaması (UTF-8) ve bozuk karakter kontrolü
   8. Gizlilik/güvenlik izleri (analitik, CDN, innerHTML)
   9. Vendor lisans bilgisi

   Kullanım: node tests/static-checks.js
   Çıkış kodu 0 = tümü geçti, 1 = en az bir denetim başarısız.
   ========================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, detail) {
  passed++;
  console.log('  + ' + name + (detail ? '  - ' + detail : ''));
}

function fail(name, detail) {
  failed++;
  failures.push(name + (detail ? ': ' + detail : ''));
  console.log('  X ' + name + (detail ? '  - ' + detail : ''));
}

function section(title) {
  console.log('\n' + title);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function listJs() {
  return fs.readdirSync(path.join(ROOT, 'js'))
    .filter((f) => f.endsWith('.js'))
    .sort();
}

/* ---------- 1. JS sozdizimi ---------- */

section('1. JavaScript sozdizimi');

for (const f of listJs()) {
  const rel = 'js/' + f;
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
    ok(rel);
  } catch (err) {
    fail(rel, 'sozdizimi hatasi');
  }
}

// ES modulu: uzanti .mjs ile ayrica dogrulanir
const tmpMjs = path.join(ROOT, '.tmp-check.mjs');
try {
  fs.copyFileSync(path.join(ROOT, 'js/scene3d.js'), tmpMjs);
  execFileSync(process.execPath, ['--check', tmpMjs], { stdio: 'pipe' });
  ok('js/scene3d.js (ES modulu)');
} catch (err) {
  fail('js/scene3d.js (ES modulu)', 'modul sozdizimi hatasi');
} finally {
  try { fs.unlinkSync(tmpMjs); } catch (e) { /* yoksay */ }
}

/* ---------- 2. JSON gecerliligi ve sekli ---------- */

section('2. JSON dosyalari');

function checkJson(rel, validate) {
  if (!exists(rel)) { fail(rel, 'dosya yok'); return null; }
  let data;
  try {
    data = JSON.parse(read(rel));
  } catch (err) {
    fail(rel, 'gecersiz JSON: ' + err.message);
    return null;
  }
  if (validate) {
    const problem = validate(data);
    if (problem) { fail(rel, problem); return null; }
  }
  ok(rel, Array.isArray(data) ? data.length + ' kayit' : 'nesne');
  return data;
}

const messages = checkJson('data/messages.json', (d) => {
  if (!Array.isArray(d)) return 'dizi bekleniyordu';
  if (d.length < 10) return 'en az 10 mesaj bekleniyordu, ' + d.length + ' bulundu';
  const bad = d.find((m) => typeof m !== 'string' || !m.trim());
  if (bad !== undefined) return 'bos veya metin olmayan kayit var';
  return null;
});

checkJson('data/discoveries.json', (d) => {
  if (!Array.isArray(d)) return 'dizi bekleniyordu';
  for (const item of d) {
    if (!item.id) return 'id alani eksik';
    if (typeof item.chance !== 'number') return item.id + ': chance sayi olmali';
    if (typeof item.duration !== 'number') return item.id + ': duration sayi olmali';
  }
  return null;
});

const contextMsgs = checkJson('data/context-messages.json', (d) => {
  if (!Array.isArray(d)) return 'dizi bekleniyordu';
  const triggers = new Set(['proximity', 'discovery', 'breath', 'dwell']);
  for (const item of d) {
    if (!item.id) return 'id alani eksik';
    if (!item.text) return item.id + ': text alani eksik';
    if (!triggers.has(item.trigger)) return item.id + ': bilinmeyen tetikleyici "' + item.trigger + '"';
    if (item.trigger === 'discovery' && !item.discovery) return item.id + ': discovery alani eksik';
  }
  return null;
});

/* ---------- 3. index.html yerel baglantilari ---------- */

section('3. index.html yerel baglantilari');

const html = read('index.html');
const refs = [];
const re = /(?:href|src)="([^"]+)"/g;
let m;
while ((m = re.exec(html)) !== null) refs.push(m[1]);

for (const ref of refs) {
  if (ref.startsWith('data:') || ref.startsWith('#')) continue;
  if (/^https?:\/\//.test(ref)) {
    fail('index.html', 'harici baglanti bulundu: ' + ref);
    continue;
  }
  const clean = ref.replace(/^\.\//, '').split('?')[0];
  if (exists(clean)) ok(clean);
  else fail(clean, 'index.html basvuruyor ama dosya yok');
}

/* ---------- 4. Goreceli yol kurali ---------- */

section('4. Goreceli yol kurali');

const pathViolations = [];
for (const f of listJs()) {
  const src = read('js/' + f);
  const bad = src.match(/(?:fetch|import)\s*\(?\s*['"]\/(?!\/)[^'"]*['"]/g);
  if (bad) pathViolations.push('js/' + f + ' -> ' + bad.join(', '));
}
if (pathViolations.length) {
  fail('Goreceli yollar', pathViolations.join(' | '));
} else {
  ok('Tum fetch/import yollari goreceli');
}

/* ---------- 5. Tema tutarliligi ---------- */

section('5. Tema tutarliligi (3B / 2B / CSS)');

function themeKeysFromJs(rel) {
  const src = read(rel);
  const idx = src.indexOf('const THEMES = {');
  if (idx === -1) return null;
  const slice = src.slice(idx, idx + 4000);
  return Array.from(slice.matchAll(/^\s{4}(\w+):\s*\{/gm)).map((x) => x[1]);
}

const js3dThemes = themeKeysFromJs('js/scene3d.js');
const js2dThemes = themeKeysFromJs('js/canvas.js');

if (!js3dThemes || !js2dThemes) {
  fail('Tema anahtarlari', 'THEMES nesnesi okunamadi');
} else {
  const a = js3dThemes.slice().sort().join(',');
  const b = js2dThemes.slice().sort().join(',');
  if (a === b) ok('3B ve 2B tema anahtarlari ayni', js3dThemes.join(', '));
  else fail('Tema anahtarlari uyusmuyor', '3B=[' + a + '] 2B=[' + b + ']');

  const css = read('css/style.css');
  for (const theme of js3dThemes) {
    if (theme === 'forest') {
      ok('CSS: forest (varsayilan :root)');
      continue;
    }
    if (css.includes('data-theme="' + theme + '"')) ok('CSS: ' + theme + ' kurali var');
    else fail('CSS', theme + ' icin data-theme kurali yok');
  }
}

/* ---------- 6. Yedek havuz uyumu ---------- */

section('6. JSON ve gomulu yedek (FALLBACK) uyumu');

function fallbackIds(rel) {
  const src = read(rel);
  const idx = src.indexOf('const FALLBACK');
  if (idx === -1) return null;
  const slice = src.slice(idx, idx + 5000);
  return Array.from(slice.matchAll(/id:\s*'([^']+)'/g)).map((x) => x[1]);
}

if (messages) ok('messages.json gecerli');

const discFallback = fallbackIds('js/discovery.js');
if (discFallback) {
  const jsonIds = JSON.parse(read('data/discoveries.json')).map((d) => d.id);
  const missing = jsonIds.filter((id) => !discFallback.includes(id));
  if (missing.length) fail('discovery yedek havuzu eksik', missing.join(', '));
  else ok('discovery yedek havuzu tam', jsonIds.length + ' kimlik');
} else {
  fail('discovery.js', 'FALLBACK havuzu bulunamadi');
}

const ctxFallback = fallbackIds('js/context.js');
if (ctxFallback && contextMsgs) {
  const jsonIds = contextMsgs.map((d) => d.id);
  const missing = jsonIds.filter((id) => !ctxFallback.includes(id));
  if (missing.length) fail('context yedek havuzu eksik', missing.join(', '));
  else ok('context yedek havuzu tam', jsonIds.length + ' kimlik');
} else {
  fail('context.js', 'FALLBACK havuzu bulunamadi');
}

/* ---------- 7. Kodlama ---------- */

section('7. Kodlama kontrolu');

const textFiles = ['index.html', 'README.md', 'AGENTS.md', 'css/style.css', 'css/animations.css']
  .concat(listJs().map((f) => 'js/' + f))
  .concat(['data/messages.json', 'data/discoveries.json', 'data/context-messages.json']);

let encodingProblems = 0;
for (const rel of textFiles) {
  if (!exists(rel)) continue;
  const text = fs.readFileSync(path.join(ROOT, rel)).toString('utf8');
  if (text.includes('\uFFFD')) {
    fail(rel, 'bozuk UTF-8 karakteri (U+FFFD)');
    encodingProblems++;
  }
}
if (encodingProblems === 0) ok('Tum metin dosyalari gecerli UTF-8');

/* ---------- 8. Gizlilik ve guvenlik ---------- */

section('8. Gizlilik ve guvenlik kontrolleri');

const allJs = listJs().map((f) => read('js/' + f)).join('\n');

if (/document\.write\s*\(/.test(allJs)) fail('document.write kullanimi bulundu');
else ok('document.write kullanimi yok');

if (/\.innerHTML\s*=\s*[^'";]*\b(text|value|input|entry)\b/.test(allJs)) {
  fail('Kullanici metni innerHTML ile yaziliyor olabilir');
} else {
  ok('Kullanici metni icin innerHTML kullanimi yok');
}

const externalRefs = allJs.match(/https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+/gi) || [];
const cdnRefs = externalRefs.filter((u) => !/github\.com|contributor-covenant|pmc\.ncbi|localhost/.test(u));
if (cdnRefs.length) fail('Olasi harici bagimlilik', Array.from(new Set(cdnRefs)).join(', '));
else ok('Calisma aninda harici CDN bagimliligi yok');

const trackers = ['google-analytics', 'googletagmanager', 'gtag(', 'mixpanel', 'sentry', 'hotjar'];
const found = trackers.filter((t) => allJs.toLowerCase().includes(t));
if (found.length) fail('Analitik izi bulundu', found.join(', '));
else ok('Analitik veya izleme kodu yok');

/* ---------- 9. Vendor lisansi ---------- */

section('9. Vendor kutuphanesi');

const vendor = 'vendor/three.module.min.js';
if (exists(vendor)) {
  const head = read(vendor).slice(0, 400);
  if (/Three\.js Authors/.test(head) && /MIT/.test(head)) ok('Three.js lisans basligi korunuyor');
  else fail('Three.js', 'lisans basligi bulunamadi');
  const sizeKb = Math.round(fs.statSync(path.join(ROOT, vendor)).size / 1024);
  ok('Three.js boyutu', sizeKb + ' KB');
} else {
  fail(vendor, 'dosya yok');
}

/* ---------- 10. Doküman bağlantıları ---------- */

section('10. README ve doküman bağlantıları');

// README'deki göreceli bağlantılar gerçekten var olmalı. Aksi halde canlı
// sitede veya depoda 404 verir. (Bir kez oldu: README docs/ dosyalarına
// bağlanıyordu ama dağıtım paketi docs/ içermiyordu.)
{
  const readme = read('README.md');
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
  const missing = [];
  let lm;
  while ((lm = linkRe.exec(readme)) !== null) {
    const target = lm[1];
    if (/^https?:\/\//.test(target) || target.startsWith('#')) continue;
    const clean = target.split('#')[0];
    if (!clean) continue;
    if (!exists(clean)) missing.push(clean);
  }
  if (missing.length) fail('README bağlantıları', 'eksik dosya: ' + missing.join(', '));
  else ok('README göreceli bağlantıları geçerli');

  // docs/ içindeki belgelerin kendi aralarındaki bağlantıları
  if (exists('docs')) {
    const docMissing = [];
    for (const f of fs.readdirSync(path.join(ROOT, 'docs'))) {
      if (!f.endsWith('.md')) continue;
      const src = read('docs/' + f);
      let dm;
      const dre = /\[[^\]]+\]\(([^)]+)\)/g;
      while ((dm = dre.exec(src)) !== null) {
        const t = dm[1];
        if (/^https?:\/\//.test(t) || t.startsWith('#')) continue;
        const clean = t.split('#')[0];
        if (!clean) continue;
        if (!exists('docs/' + clean) && !exists(clean)) {
          docMissing.push('docs/' + f + ' -> ' + clean);
        }
      }
    }
    if (docMissing.length) fail('Doküman bağlantıları', docMissing.join(', '));
    else ok('Dokümanlar arası bağlantılar geçerli');
  }

  // Dağıtım paketinde hangi dizinlerin olması gerektiğini belgele
  const workflow = read('.github/workflows/deploy.yml');
  const needed = ['index.html', 'css', 'js', 'data', 'vendor'];
  const notShipped = needed.filter((n) => !workflow.includes(n));
  if (notShipped.length) fail('Dağıtım paketi', 'eksik: ' + notShipped.join(', '));
  else ok('Dağıtım paketi gerekli dizinleri içeriyor');

  // README'nin bağlandığı dizinler pakette olmalı
  const readmeDirs = ['docs'];
  const missingDirs = readmeDirs.filter((d) => exists(d) && !workflow.includes(d));
  if (missingDirs.length) {
    fail('Dağıtım paketi', 'README bağlantılı ama pakette yok: ' + missingDirs.join(', '));
  } else {
    ok('README bağlantılı dizinler pakette');
  }
}

/* ---------- 11. Ses ve hareket kuralları ---------- */

section('11. Ses ve hareket kuralları');

{
  const audio = read('js/audio.js');

  // Tek seferlik ses fonksiyonları canPlay() ile korunmalı: ses kapalıyken
  // çalmamalı, autoplay kuralına uyulmalı.
  const oneShot = ['footstep', 'rustle', 'chirp', 'flutter', 'glowPulse', 'wingbeat', 'swoosh'];
  const unguarded = [];
  for (const fn of oneShot) {
    const idx = audio.indexOf('function ' + fn + '(');
    if (idx === -1) { unguarded.push(fn + ' (yok)'); continue; }
    // Fonksiyon gövdesinin ilk 200 karakterinde canPlay() aranır
    const body = audio.slice(idx, idx + 200);
    if (!body.includes('canPlay()')) unguarded.push(fn);
  }
  if (unguarded.length) fail('Ses fonksiyonları canPlay() ile korunuyor', unguarded.join(', '));
  else ok('Tek seferlik sesler canPlay() ile korunuyor', oneShot.length + ' fonksiyon');

  // Keşif sesleri level ile ölçeklenmeli (ani/yüksek ses yok)
  const scaled = ['flutter', 'glowPulse', 'wingbeat', 'swoosh'].every((fn) => {
    const idx = audio.indexOf('function ' + fn + '(');
    return idx !== -1 && audio.slice(idx, idx + 400).includes('* level');
  });
  if (scaled) ok('Keşif sesleri ses düzeyiyle ölçekleniyor');
  else fail('Keşif sesleri', 'level ile ölçeklenmiyor');

  // Harici ses dosyası eklenmemeli (zero-asset)
  const mediaRefs = audio.match(/\.(mp3|wav|ogg|m4a)/gi) || [];
  if (mediaRefs.length) fail('Ses dosyası başvurusu', mediaRefs.join(', '));
  else ok('Harici ses dosyası yok');

  // Boşta kayma varsayılan KAPALI olmalı (kullanıcı habersiz hareket istemez)
  const app = read('js/app.js');
  if (/idleDrift:\s*false/.test(app)) ok('Boşta kayma varsayılan kapalı');
  else fail('Boşta kayma', 'DEFAULT_SAVE içinde idleDrift: false bulunamadı');

  // Her iki motorda da boşta kayma bayrağa bağlı olmalı
  const c2 = read('js/canvas.js');
  const c3 = read('js/scene3d.js');
  if (/idle && idleDrift && !reducedMotion/.test(c2) && /idle && idleDrift && !reducedMotion/.test(c3)) {
    ok('Boşta kayma her iki motorda bayrağa bağlı');
  } else {
    fail('Boşta kayma', 'motorlardan birinde idleDrift denetimi eksik');
  }

  // Nefesle Yürü adımı yumuşak tamponla tüketilmeli (anlık sıçrama yok)
  const glide2d = /glideRemaining/.test(c2) && /consumeGlide/.test(c2);
  const glide3d = /glideRemaining/.test(c3) && /consumeGlide/.test(c3);
  if (glide2d && glide3d) ok('Nefesle Yürü adımı yumuşak tamponla tüketiliyor');
  else fail('Nefesle Yürü', 'glide tamponu motorlardan birinde yok');

  // Paneller ortalanmış modal değil, kenar çekmecesi olmalı
  const css = read('css/style.css');
  const panelBlock = css.slice(css.indexOf('.panel {'), css.indexOf('.panel {') + 600);
  if (/right:\s*0/.test(panelBlock) && /backdrop-filter/.test(panelBlock)) {
    ok('Paneller kenar çekmecesi ve yarı saydam');
  } else {
    fail('Panel düzeni', 'çekmece konumu veya saydamlık bulunamadı');
  }

  // Bahçe okuma fonksiyonları init öncesi güvenli olmalı
  const sanctuary = read('js/sanctuary.js');
  if (/function ensureLoaded\(\)/.test(sanctuary)) ok('Sanctuary init öncesi güvenli okuma');
  else fail('Sanctuary', 'ensureLoaded() koruması yok');
}

/* ---------- Ozet ---------- */

console.log('\n' + '-'.repeat(58));
console.log('Gecen: ' + passed + '   Basarisiz: ' + failed);
if (failed > 0) {
  console.log('\nBasarisiz denetimler:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('Tum statik denetimler gecti.');
process.exit(0);
