/* =========================================================
   Calm Haven / Sakin Sığınak — context.js  (3.0)
   Bağlamsal mesaj sistemi.

   Mesajlar rastgele değil; konuma, süreye, keşfe ve nefese göre seçilir.
   Sıradan mesaj rotasyonu (messages.js) arka planda yumuşakça devam eder;
   bağlamsal bir mesaj tetiklendiğinde öne geçer ve sonra normale döner.

   Kural: hiçbir mesaj bir şey talep etmez, suçlamaz veya acele ettirmez.
   ========================================================= */

const CalmContext = (function () {
  'use strict';

  const ENDPOINT = './data/context-messages.json';
  const SHOW_MS = 9000;        // bağlamsal mesajın ekranda kalma süresi
  const PROXIMITY_COOLDOWN = 45; // s — aynı bölge mesajı tekrar etmesin

  // Yedek: dosya erişilemezse (file://) bağlamsal mesajlar yine çalışsın
  const FALLBACK = [
    { id: 'creek', zone: 'creek', trigger: 'proximity', priority: 3, text: 'Su sesi... Burada biraz dur.' },
    { id: 'hill', zone: 'hill', trigger: 'proximity', priority: 3, text: 'Uzaklara bak. Gözlerini dinlendir.' },
    { id: 'cabin_arrive', zone: 'cabin', trigger: 'proximity', priority: 2, text: 'Kulübene geldin. Burada kimse senden bir şey istemiyor.' },
    { id: 'shore', zone: 'shore', trigger: 'proximity', priority: 3, text: 'Dalgalar bir ritimle geliyor. Nefesin de öyle.' },
    { id: 'bird_arrives', zone: 'any', trigger: 'discovery', discovery: 'heron', priority: 4, text: 'Bir kuş geldi. Onu izle.' },
    { id: 'star_seen', zone: 'any', trigger: 'discovery', discovery: 'shooting_star', priority: 4, text: 'Bir kayan yıldız geçti. Bu an sadece senin.' },
    { id: 'sigh_done', zone: 'any', trigger: 'breath', priority: 2, text: 'İçe çekişi tamamladın. Bedenin bunu hatırlayacak.' },
    { id: 'long_walk', zone: 'any', trigger: 'dwell', dwellSeconds: 180, priority: 2, text: 'Uzun süredir yürüyorsun. Durmak da bir seçenek.' }
  ];

  let defs = FALLBACK.slice();
  let onShow = null;
  let onRestore = null;
  let lastByZone = Object.create(null);
  let elapsed = 0;
  let suppressUntil = 0;
  let visibleId = null;
  let restoreTimer = null;

  function normalize(data) {
    if (!Array.isArray(data)) return null;
    const cleaned = data.filter(function (d) {
      return d && typeof d.text === 'string' && typeof d.trigger === 'string';
    }).map(function (d) {
      return {
        id: typeof d.id === 'string' ? d.id : d.text.slice(0, 12),
        zone: typeof d.zone === 'string' ? d.zone : 'any',
        trigger: d.trigger,
        discovery: typeof d.discovery === 'string' ? d.discovery : null,
        dwellSeconds: typeof d.dwellSeconds === 'number' ? d.dwellSeconds : null,
        priority: typeof d.priority === 'number' ? d.priority : 1,
        text: d.text
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

  /* ---------- Gösterim ---------- */

  function show(def) {
    if (!onShow) return;
    visibleId = def.id;
    lastByZone[def.zone] = elapsed;
    suppressUntil = elapsed + SHOW_MS / 1000;

    onShow(def.text, def);

    if (restoreTimer !== null) clearTimeout(restoreTimer);
    restoreTimer = setTimeout(function () {
      restoreTimer = null;
      visibleId = null;
      if (onRestore) onRestore();
    }, SHOW_MS);
  }

  function suppressed() {
    return elapsed < suppressUntil;
  }

  /* ---------- Tetikleyiciler ---------- */

  function byId(id) {
    for (let i = 0; i < defs.length; i++) if (defs[i].id === id) return defs[i];
    return null;
  }

  // Konuma göre: aynı bölge için bekleme süresi dolmadan tekrar gösterme
  function onZone(zone) {
    if (!zone || suppressed()) return null;
    const last = lastByZone[zone];
    if (last !== undefined && elapsed - last < PROXIMITY_COOLDOWN) return null;

    let best = null;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (d.trigger !== 'proximity' || d.zone !== zone) continue;
      if (!best || d.priority > best.priority) best = d;
    }
    if (best) show(best);
    return best;
  }

  // Keşif gerçekleştiğinde
  function onDiscovery(discoveryId) {
    if (suppressed()) return null;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (d.trigger === 'discovery' && d.discovery === discoveryId) {
        show(d);
        return d;
      }
    }
    return null;
  }

  // Nefes protokolü tamamlandığında
  function onBreathEvent(kind) {
    if (kind !== 'sigh-complete') return null;
    if (suppressed()) return null;
    const d = byId('sigh_done');
    if (d) { show(d); return d; }
    return null;
  }

  // Uzun süre yürüyünce (dwell)
  function onDwell(seconds) {
    if (suppressed()) return null;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (d.trigger !== 'dwell' || !d.dwellSeconds) continue;
      if (seconds >= d.dwellSeconds && lastByZone[d.id] === undefined) {
        show(d);
        return d;
      }
    }
    return null;
  }

  function update(dt) {
    elapsed += dt;
  }

  async function init(options) {
    options = options || {};
    onShow = options.onShow || null;
    onRestore = options.onRestore || null;
    return load();
  }

  const api = {
    init: init,
    update: update,
    onZone: onZone,
    onDiscovery: onDiscovery,
    onBreathEvent: onBreathEvent,
    onDwell: onDwell,
    getVisibleId: function () { return visibleId; },
    isSuppressed: suppressed,
    getDefs: function () { return defs.slice(); },
    FALLBACK: FALLBACK
  };

  return api;
})();
