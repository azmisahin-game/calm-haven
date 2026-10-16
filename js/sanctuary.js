/* =========================================================
   Calm Haven / Sakin Sığınak — sanctuary.js  (3.0)
   Kişisel sığınak: bahçe, deniz kabukları, sal ve anı defteri.

   Değişmez kurallar:
   - Hiçbir şey solmaz, bozulmaz, kaybolmaz. Çiçekler büyür ve öyle kalır.
   - Toplamak "tüketmek" değildir: kabuklar koleksiyona eklenir, eksilmez.
   - Anı defteri tamamen cihazda kalır (localStorage). Sunucuya gitmez,
     hiçbir analitik veya paylaşım yoktur.
   ========================================================= */

const CalmSanctuary = (function () {
  'use strict';

  const SAVE_KEY = 'calm_haven_sanctuary_v1';

  // Bahçe: her çiçek ekildiği andan itibaren yavaşça büyür, sonra sabit kalır.
  const FLOWER_KINDS = [
    { id: 'lavanta', name: 'Lavanta', color: '#8b7fd4', grow: 90 },
    { id: 'papatya', name: 'Papatya', color: '#f2f0e4', grow: 60 },
    { id: 'gelincik', name: 'Gelincik', color: '#e05a4f', grow: 75 },
    { id: 'mine', name: 'Mine', color: '#6fb3d9', grow: 70 },
    { id: 'kadife', name: 'Kadife', color: '#e8a13c', grow: 85 },
    { id: 'yildiz', name: 'Yıldız Çiçeği', color: '#d97fb0', grow: 100 }
  ];

  const SHELL_KINDS = [
    { id: 'midye', name: 'Midye Kabuğu', color: '#e8dcc8' },
    { id: 'deniz-kabugu', name: 'Deniz Kabuğu', color: '#f0d8c0' },
    { id: 'yildiz-kabuk', name: 'Deniz Yıldızı', color: '#e0895f' },
    { id: 'salyan', name: 'Salyangoz Kabuğu', color: '#d8c4a8' },
    { id: 'inci', name: 'İnci', color: '#eef2f4' }
  ];

  const DEFAULT = {
    garden: [],            // { kind, plantedAt (epoch ms), x, y }
    shells: {},            // kindId -> adet
    raftBuilt: false,
    journal: [],           // { text, at }  — yalnızca cihazda
    lastShellAt: null
  };

  let data = null;
  let onGardenChange = null;
  let onShellFound = null;
  let onRaftBuilt = null;

  /* ---------- Kalıcılık ---------- */

  function load() {
    let parsed = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch (err) {
      parsed = null;
    }
    data = Object.assign({}, DEFAULT, parsed || {});
    if (!Array.isArray(data.garden)) data.garden = [];
    if (!data.shells || typeof data.shells !== 'object') data.shells = {};
    if (!Array.isArray(data.journal)) data.journal = [];
    return data;
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (err) {
      // Gizli sekme / kota: sessizce devam et
    }
  }

  /* ---------- Bahçe ---------- */

  // Büyüme 0..1 arası: ekildiği andan itibaren yavaşça olgunlaşır,
  // olgunlaştıktan sonra sabit kalır. Asla geri gitmez, asla solmaz.
  function growthOf(entry, now) {
    const kind = FLOWER_KINDS.filter(function (k) { return k.id === entry.kind; })[0];
    if (!kind) return 1;
    const elapsed = Math.max(0, now - entry.plantedAt) / 1000;
    return Math.min(1, elapsed / kind.grow);
  }

  function plant(kindId) {
    const kind = FLOWER_KINDS.filter(function (k) { return k.id === kindId; })[0];
    if (!kind) return null;

    // Bahçe ızgarasında boş bir yer bul (6x4 = 24 saksı)
    const cols = 6;
    const rows = 4;
    const taken = Object.create(null);
    data.garden.forEach(function (g) { taken[g.x + ',' + g.y] = true; });

    let spot = null;
    for (let y = 0; y < rows && !spot; y++) {
      for (let x = 0; x < cols; x++) {
        if (!taken[x + ',' + y]) { spot = { x: x, y: y }; break; }
      }
    }
    if (!spot) return null; // bahçe dolu — ceza değil, sadece yer yok

    const entry = {
      kind: kind.id,
      plantedAt: Date.now(),
      x: spot.x,
      y: spot.y
    };
    data.garden.push(entry);
    save();
    if (onGardenChange) onGardenChange(getGarden());
    return entry;
  }

  function getGarden() {
    const now = Date.now();
    return data.garden.map(function (g) {
      const kind = FLOWER_KINDS.filter(function (k) { return k.id === g.kind; })[0] || FLOWER_KINDS[0];
      return {
        kind: kind.id,
        name: kind.name,
        color: kind.color,
        x: g.x,
        y: g.y,
        growth: growthOf(g, now),
        bloomed: growthOf(g, now) >= 1
      };
    });
  }

  /* ---------- Deniz kabukları ---------- */

  // Toplamak kayıp değildir: koleksiyon büyür, hiçbir şey eksilmez.
  function findShell() {
    const kind = SHELL_KINDS[Math.floor(Math.random() * SHELL_KINDS.length)];
    data.shells[kind.id] = (data.shells[kind.id] || 0) + 1;
    data.lastShellAt = Date.now();
    save();
    if (onShellFound) onShellFound(kind.name);
    return kind;
  }

  function getShells() {
    return SHELL_KINDS.map(function (k) {
      return { id: k.id, name: k.name, color: k.color, count: data.shells[k.id] || 0 };
    });
  }

  function totalShells() {
    let sum = 0;
    Object.keys(data.shells).forEach(function (k) { sum += data.shells[k]; });
    return sum;
  }

  /* ---------- Sal ---------- */

  function buildRaft() {
    if (data.raftBuilt) return false;
    // Sal yapmak kaynak tüketmez: sadece bir niyet ve zaman ister
    data.raftBuilt = true;
    save();
    if (onRaftBuilt) onRaftBuilt();
    return true;
  }

  function hasRaft() {
    return !!data.raftBuilt;
  }

  /* ---------- Anı defteri ---------- */

  function addJournal(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const entry = { text: t.slice(0, 500), at: Date.now() };
    data.journal.push(entry);
    if (data.journal.length > 200) data.journal = data.journal.slice(-200);
    save();
    return entry;
  }

  function getJournal() {
    return data.journal.slice().reverse();
  }

  function clearJournal() {
    data.journal = [];
    save();
  }

  /* ---------- Genel arayüz ---------- */

  function init(options) {
    options = options || {};
    onGardenChange = options.onGardenChange || null;
    onShellFound = options.onShellFound || null;
    onRaftBuilt = options.onRaftBuilt || null;
    load();
    return {
      flowers: data.garden.length,
      shells: totalShells(),
      raft: data.raftBuilt,
      journal: data.journal.length
    };
  }

  function reset() {
    data = JSON.parse(JSON.stringify(DEFAULT));
    save();
    if (onGardenChange) onGardenChange(getGarden());
  }

  const api = {
    init: init,
    reset: reset,
    FLOWER_KINDS: FLOWER_KINDS,
    SHELL_KINDS: SHELL_KINDS,
    plant: plant,
    getGarden: getGarden,
    findShell: findShell,
    getShells: getShells,
    totalShells: totalShells,
    buildRaft: buildRaft,
    hasRaft: hasRaft,
    addJournal: addJournal,
    getJournal: getJournal,
    clearJournal: clearJournal
  };

  return api;
})();
