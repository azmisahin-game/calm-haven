/* =========================================================
   Calm Haven / Sakin Sığınak — messages.js
   Şefkatli mesaj ve somatik farkındalık havuzu.
   ./data/messages.json yüklenir; erişilemezse gömülü havuz kullanılır
   (file:// ile açıldığında da çalışır — sıfır asset hatası).
   ========================================================= */

const CalmMessages = (function () {
  'use strict';

  const ENDPOINT = './data/messages.json';
  const MIN_INTERVAL = 12000;
  const DEFAULT_INTERVAL = 15000;

  // Yedek havuz: ağ/dosya erişimi başarısız olursa sessizlik olmasın
  const FALLBACK = [
    'Şu an omuzlarını aşağı düşür, boynundaki yükü serbest bırak.',
    'Dişlerini sıkmayı bırak, çeneni ve dilini rahatlat.',
    'Bütün departmanın yükünü tek başına sırtlanmak senin görevin değil.',
    'O telefonlar ve e-postalar sen derin bir nefes alırken de bekleyebilir.',
    'Burada yapılacak acil hiçbir iş yok. Burası sadece senin güvenli alanın.',
    'Yalnız kaldığında zihnindeki fısıltılara değil, ciğerlerine dolan serin havaya odaklan.',
    'Gözlerini ekrandan 20 saniye ayır ve uzaklara yumuşakça bak.',
    'Her şeye yetişmek zorunda değilsin; bugün yeterince çabaladın.',
    'Nefesin yetmediğinde dur. O an hiçbir şey senden daha önemli değil.',
    'Boynun eğrildiğinde, sırtını yasla ve çeneyi hafifçe yukarı kaldır.',
    'Bu ada senin. Burada kimse senden bir şey istemiyor.'
  ];

  let pool = FALLBACK.slice();
  let index = 0;
  let cardEl = null;
  let textEl = null;
  let intervalMs = DEFAULT_INTERVAL;
  let intervalId = null;
  let fadeTimer = null;
  let reducedMotion = false;
  let running = false;

  function normalize(data) {
    if (!Array.isArray(data)) return null;
    const cleaned = data
      .filter(function (m) { return typeof m === 'string' && m.trim().length > 0; })
      .map(function (m) { return m.trim(); });
    return cleaned.length ? cleaned : null;
  }

  function shuffle(items) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  async function load() {
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const cleaned = normalize(data);
      if (cleaned) {
        // Havuz tekrarını azaltmak için karıştırılmış sırayla gezilir
        pool = shuffle(cleaned);
        return { source: 'json', count: pool.length };
      }
    } catch (err) {
      // Yedek havuz zaten yüklü: kullanıcıya hata gösterilmez
    }
    pool = shuffle(FALLBACK);
    return { source: 'fallback', count: pool.length };
  }

  function paint(text) {
    if (textEl) textEl.textContent = text;
  }

  function showNext() {
    if (!cardEl) return;

    if (reducedMotion) {
      paint(pool[index]);
      index = (index + 1) % pool.length;
      return;
    }

    cardEl.style.opacity = '0';
    if (fadeTimer !== null) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(function () {
      fadeTimer = null;
      paint(pool[index]);
      index = (index + 1) % pool.length;
      cardEl.style.opacity = '1';
    }, 600);
  }

  function startRotation() {
    if (running) return;
    running = true;
    showNext();
    intervalId = setInterval(showNext, intervalMs);
  }

  function stopRotation() {
    running = false;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (fadeTimer !== null) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }
  }

  async function init(els, options) {
    els = els || {};
    options = options || {};
    cardEl = els.card || null;
    textEl = els.text || cardEl;
    reducedMotion = !!options.reducedMotion;
    intervalMs = Math.max(MIN_INTERVAL, options.intervalMs || DEFAULT_INTERVAL);

    const info = await load();
    startRotation();
    return info;
  }

  function setReducedMotion(value) {
    reducedMotion = !!value;
  }

  function getPool() {
    return pool.slice();
  }

  function next() {
    const msg = pool[index];
    index = (index + 1) % pool.length;
    return msg;
  }

  const api = {
    init: init,
    start: startRotation,
    stop: stopRotation,
    next: next,
    getPool: getPool,
    setReducedMotion: setReducedMotion,
    FALLBACK: FALLBACK
  };

  return api;
})();
