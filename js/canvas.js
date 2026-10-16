/* =========================================================
   Calm Haven / Sakin Sığınak — canvas.js  (2.0 "Yaşayan Dünya")
   Sonsuz orman & ada görsel alanı.

   Yeni: sahne asla tamamen durmaz. Bulutlar, düşen yapraklar, su
   parıltısı, sis ve ağaç salınımı sürekli hareket halindedir; sis,
   ay ışığı ve su parıltısı CalmWorld üzerinden nefesle senkronlanır.
   ========================================================= */

const CalmForest = (function () {
  'use strict';

  /* ---------- Temalar ---------- */

  const THEMES = {
    forest: {
      skyTop: '#16233f', skyMid: '#0f172a', skyLow: '#0a1526',
      ridge: 'rgba(8, 26, 38, 0.85)',
      farTree: '#0a2a30', nearTree: '#05231b', trunk: '#041a14',
      groundTop: '#062c22', groundMid: '#04211a', groundLow: '#031510',
      water: '#0d3b3a', waterLight: 'rgba(148, 226, 213, 0.30)',
      pathTint: 'rgba(16, 185, 129, 0.07)',
      island: '#10b981', amber: '#f59e0b',
      wood: '#123c30', woodDark: '#0a2b22', roof: '#0d3a2c',
      mist: 'rgba(212, 236, 231, 0.10)',
      fogColor: '200, 220, 240',
      cloudColor: '188, 214, 232',
      leafColor1: '#0d6b4f', leafColor2: '#f59e0b',
      treeStyle: 'pine',
      waterStyle: 'creek',
      groundStyle: 'grass'
    },
    island: {
      skyTop: '#2b1f3d', skyMid: '#5b3352', skyLow: '#8a4a48',
      ridge: 'rgba(58, 32, 56, 0.8)',
      farTree: '#2a2138', nearTree: '#1b2a2c', trunk: '#3b2b22',
      groundTop: '#c9a469', groundMid: '#a8845a', groundLow: '#6f5640',
      water: '#1c5a6b', waterLight: 'rgba(214, 240, 245, 0.42)',
      pathTint: 'rgba(245, 214, 140, 0.08)',
      island: '#2ec4a6', amber: '#ffb057',
      wood: '#7a5233', woodDark: '#553a24', roof: '#8e6440',
      mist: 'rgba(255, 214, 170, 0.10)',
      fogColor: '255, 206, 168',
      cloudColor: '255, 196, 150',
      leafColor1: '#2ec4a6', leafColor2: '#ffb057',
      treeStyle: 'palm',
      waterStyle: 'ocean',
      groundStyle: 'sand'
    }
  };

  const CABIN_SPACING = 800;
  const IDLE_DELAY = 10;
  const IDLE_SPEED_FACTOR = 0.25;
  const IDLE_STEP_FACTOR = 0.06;

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let W = 0;
  let H = 0;

  let horizonY = 0;
  let waterY = 0;
  let pathY = 0;

  let camera = 0;
  let baseSpeed = 22;
  let currentSpeed = 0;
  let lastInteraction = 0;
  let idle = false;
  let reducedMotion = false;

  let holding = false;
  let cruise = false;

  let time = 0;
  let running = false;
  let rafId = null;
  let lastTime = 0;

  let onAdvance = null;
  let onIdleChange = null;
  let C = THEMES.forest;

  const milestones = Object.create(null);

  // Dünya (nefes senkronu) — her karede okunur
  let world = { fog: 0.3, moon: 0.7, shimmer: 0.5, leaf: 0.2, mist: 0.35 };

  // Katmanlar
  let stars = [];
  let clouds = [];
  let ridgePoints = [];
  let farTrees = [];
  let nearTrees = [];
  let pathProps = [];
  let pebbles = [];
  let fireflies = [];
  let leaves = [];

  // Keşif öğeleri (discovery.js tarafından doldurulur)
  let discoveries = [];

  // Önbelleğe alınan gradyan ve görseller
  let skyGradient = null;
  let groundGradient = null;
  let waterGradient = null;
  let glowAmber = null;
  let glowGreen = null;
  let glowMist = null;
  let cloudSprites = [];

  /* ---------- Yardımcılar ---------- */

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function makeGlow(color, size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)'));
    grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function makeCloudSprite() {
    const w = 240;
    const h = 96;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const rgb = C.cloudColor;
    for (let i = 0; i < 7; i++) {
      const cx = 40 + Math.random() * (w - 80);
      const cy = 34 + Math.random() * (h - 58);
      const r = 18 + Math.random() * 26;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(' + rgb + ',0.5)');
      grad.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = grad;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    return c;
  }

  function drawGlow(sprite, x, y, size, alpha) {
    if (!sprite) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  /* ---------- Kurulum ---------- */

  function buildCache() {
    skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY + 2);
    skyGradient.addColorStop(0, C.skyTop);
    skyGradient.addColorStop(0.55, C.skyMid);
    skyGradient.addColorStop(1, C.skyLow);

    groundGradient = ctx.createLinearGradient(0, horizonY, 0, H);
    groundGradient.addColorStop(0, C.groundTop);
    groundGradient.addColorStop(0.45, C.groundMid);
    groundGradient.addColorStop(1, C.groundLow);

    waterGradient = ctx.createLinearGradient(0, waterY - 26, 0, waterY + 26);
    waterGradient.addColorStop(0, 'rgba(13, 59, 58, 0)');
    waterGradient.addColorStop(0.5, C.water);
    waterGradient.addColorStop(1, 'rgba(13, 59, 58, 0)');

    glowAmber = makeGlow('rgba(245, 158, 11, 0.9)', 96);
    glowGreen = makeGlow('rgba(16, 185, 129, 0.9)', 64);
    glowMist = makeGlow('rgba(212, 236, 231, 0.55)', 128);

    cloudSprites = [];
    for (let i = 0; i < 4; i++) cloudSprites.push(makeCloudSprite());
  }

  function makeFarTree() {
    return {
      wx: 0,
      baseY: horizonY + 6,
      parallax: 0.34,
      h: rand(26, 74),
      w: rand(0.42, 0.62),
      phase: rand(0, Math.PI * 2),
      freq: rand(0.6, 1.3),
      amp: reducedMotion ? 0 : rand(0.012, 0.032),
      layer: 'far'
    };
  }

  function makeNearTree() {
    const maxH = Math.min(300, H * 0.52);
    return {
      wx: 0,
      baseY: pathY - H * 0.06,
      parallax: 0.86,
      h: rand(90, maxH),
      w: rand(0.42, 0.62),
      phase: rand(0, Math.PI * 2),
      freq: rand(0.6, 1.3),
      amp: reducedMotion ? 0 : rand(0.012, 0.032),
      trunkH: rand(0.42, 0.62),
      fronds: Math.round(rand(6, 9)),
      layer: 'near'
    };
  }

  function makePathProp() {
    const roll = Math.random();
    let kind = roll < 0.42 ? 'fern' : roll < 0.72 ? 'grass' : roll < 0.92 ? 'flower' : 'shrub';
    if (C.groundStyle === 'sand' && kind === 'fern') kind = 'grass';
    return {
      wx: 0,
      parallax: 1,
      kind: kind,
      yOffset: rand(-pathY * 0.16, pathY * 0.08),
      scale: rand(0.6, 1.25),
      phase: rand(0, Math.PI * 2),
      freq: rand(0.5, 1.4),
      amp: reducedMotion ? 0 : rand(0.01, 0.05),
      hue: Math.random() < 0.3 ? C.amber : C.island
    };
  }

  function makePebble() {
    return { wx: 0, parallax: 1, y: rand(-14, 18), rx: rand(2.5, 7), ry: rand(1.6, 3.4), shade: rand(0.5, 0.9) };
  }

  function makeFirefly() {
    return {
      wx: 0,
      parallax: 0.9,
      y: rand(0.5, 0.82) * H,
      phase: rand(0, Math.PI * 2),
      freq: rand(0.35, 0.9),
      driftX: rand(28, 90),
      driftY: rand(10, 34),
      size: rand(16, 34)
    };
  }

  function makeCloud() {
    return {
      wx: 0,
      parallax: rand(0.08, 0.16),
      y: rand(0.05, 0.36) * horizonY,
      scale: rand(0.6, 1.8),
      alpha: rand(0.16, 0.4),
      sprite: Math.floor(Math.random() * 4)
    };
  }

  function makeFallingLeaf() {
    return {
      x: rand(0, W),
      y: rand(-H * 0.2, H * 0.5),
      vy: rand(14, 34),
      vx: rand(-26, -8),
      rot: rand(0, Math.PI * 2),
      vrot: rand(-1.6, 1.6),
      size: rand(3.5, 7.5),
      color: Math.random() < 0.7 ? C.leafColor1 : C.leafColor2,
      phase: rand(0, Math.PI * 2),
      amp: rand(6, 18)
    };
  }

  function buildLayers() {
    const spread = W + 400;

    stars = [];
    const starCount = Math.round(Math.min(200, (W * horizonY) / 9000));
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: rand(0, W), y: rand(0, horizonY * 0.94), r: rand(0.6, 1.7),
        phase: rand(0, Math.PI * 2), freq: rand(0.4, 1.8), base: rand(0.25, 0.85)
      });
    }

    clouds = [];
    const cloudCount = reducedMotion ? 2 : Math.max(3, Math.round(W / 320));
    for (let i = 0; i < cloudCount; i++) {
      const cl = makeCloud();
      cl.wx = -200 + (i / cloudCount) * spread + rand(-60, 60);
      clouds.push(cl);
    }

    ridgePoints = [];
    for (let x = -60; x <= W + 60; x += 26) {
      ridgePoints.push({ x: x, h: 26 + Math.sin(x * 0.004) * 22 + Math.sin(x * 0.011 + 1.7) * 12 });
    }

    farTrees = [];
    const farCount = Math.max(14, Math.round(W / 46));
    for (let i = 0; i < farCount; i++) {
      const t = makeFarTree();
      t.wx = -200 + (i / farCount) * spread + rand(-18, 18);
      farTrees.push(t);
    }

    nearTrees = [];
    const nearCount = Math.max(4, Math.round(W / 210));
    for (let i = 0; i < nearCount; i++) {
      const t = makeNearTree();
      t.wx = -200 + (i / nearCount) * spread + rand(-60, 60);
      nearTrees.push(t);
    }

    pathProps = [];
    const propCount = Math.max(18, Math.round(W / 26));
    for (let i = 0; i < propCount; i++) {
      const p = makePathProp();
      p.wx = -200 + (i / propCount) * spread + rand(-14, 14);
      pathProps.push(p);
    }

    pebbles = [];
    const pebbleCount = Math.max(10, Math.round(W / 52));
    for (let i = 0; i < pebbleCount; i++) {
      const p = makePebble();
      p.wx = -200 + (i / pebbleCount) * spread + rand(-20, 20);
      pebbles.push(p);
    }

    fireflies = [];
    const flyCount = reducedMotion ? 0 : Math.max(10, Math.round(W / 90));
    for (let i = 0; i < flyCount; i++) {
      const f = makeFirefly();
      f.wx = -200 + (i / flyCount) * spread + rand(-30, 30);
      fireflies.push(f);
    }

    leaves = [];
    if (!reducedMotion) {
      const leafCount = Math.max(8, Math.round(W / 130));
      for (let i = 0; i < leafCount; i++) leaves.push(makeFallingLeaf());
    }
  }

  function layout() {
    if (C.waterStyle === 'ocean') {
      horizonY = Math.round(H * 0.46);
      waterY = Math.round(H * 0.62);
      pathY = Math.round(H * 0.88);
    } else {
      horizonY = Math.round(H * 0.5);
      waterY = Math.round(H * 0.68);
      pathY = Math.round(H * 0.86);
    }
    buildLayers();
  }

  /* ---------- Döngüsel tampon ---------- */

  function recycle(layer, margin) {
    const span = W + margin * 2;
    for (let i = 0; i < layer.length; i++) {
      const it = layer[i];
      const px = typeof it.parallax === 'number' ? it.parallax : 1;
      if (it.wx - camera * px < -margin) it.wx += span;
    }
  }

  /* ---------- Çizim: gökyüzü ---------- */

  function drawSky() {
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, horizonY + 2);

    // Ay ışığı nefesle parlar: gökyüzünü hafifçe aydınlatır
    const moonLight = clamp(world.moon, 0, 1);
    if (moonLight > 0.05) {
      ctx.globalAlpha = moonLight * 0.18;
      ctx.fillStyle = '#cfe4f2';
      ctx.fillRect(0, 0, W, horizonY);
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = reducedMotion ? s.base : s.base + Math.sin(time * s.freq + s.phase) * 0.35;
      ctx.globalAlpha = Math.max(0.05, Math.min(1, tw)) * (0.5 + moonLight * 0.6);
      ctx.fillStyle = '#dfeee9';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    drawMoon();
    drawClouds();
  }

  function drawClouds() {
    if (reducedMotion) return;
    for (let i = 0; i < clouds.length; i++) {
      const cl = clouds[i];
      const sx = cl.wx - camera * cl.parallax;
      const sprite = cloudSprites[cl.sprite];
      if (!sprite) continue;
      const w = 240 * cl.scale;
      const h = 96 * cl.scale;
      ctx.globalAlpha = cl.alpha;
      ctx.drawImage(sprite, sx - w / 2, cl.y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon() {
    const mx = W * 0.78;
    const my = horizonY * 0.3;
    const r = Math.max(18, Math.min(30, W * 0.018));
    const b = clamp(world.moon, 0, 1);

    drawGlow(glowMist, mx, my, r * 5.2, 0.15 + b * 0.35);

    ctx.globalAlpha = 0.55 + b * 0.45;
    ctx.fillStyle = 'rgba(226, 240, 235, 0.94)';
    ctx.beginPath();
    ctx.arc(mx, my, r, Math.PI * 0.35, Math.PI * 1.65, false);
    ctx.arc(mx + r * 0.52, my, r * 0.94, Math.PI * 1.65, Math.PI * 0.35, true);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawRidge() {
    ctx.fillStyle = C.ridge;
    ctx.beginPath();
    ctx.moveTo(-60, horizonY + 8);
    for (let i = 0; i < ridgePoints.length; i++) {
      const p = ridgePoints[i];
      ctx.lineTo(p.x, horizonY - p.h);
    }
    ctx.lineTo(W + 60, horizonY + 8);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- Çizim: ağaçlar ---------- */

  function drawTree(tree) {
    // Rüzgar salınımı dünya parametresiyle güçlenir/zayıflar
    const gust = 1 + clamp(world.leaf, 0, 1) * 1.6;
    const sway = reducedMotion ? 0 : Math.sin(time * tree.freq + tree.phase) * tree.amp * gust;

    ctx.save();
    ctx.translate(tree.wx - camera * tree.parallax, tree.baseY);
    ctx.rotate(sway);

    if (tree.layer === 'near' && C.treeStyle === 'palm') drawPalm(tree);
    else drawPine(tree, tree.layer === 'far' ? C.farTree : C.nearTree);

    ctx.restore();
  }

  function drawPine(tree, shade) {
    const h = tree.h;
    const w = h * tree.w;

    ctx.fillStyle = C.trunk;
    ctx.fillRect(-Math.max(1.2, w * 0.045), -h * 0.24, Math.max(2.4, w * 0.09), h * 0.24);

    ctx.fillStyle = shade;
    const tiers = 3;
    for (let t = 0; t < tiers; t++) {
      const k = t / tiers;
      const tierH = h * (0.44 - k * 0.07);
      const tierY = -h * (0.2 + k * 0.26);
      const tierW = w * (1 - k * 0.24);
      ctx.beginPath();
      ctx.moveTo(0, tierY - tierH);
      ctx.lineTo(tierW / 2, tierY);
      ctx.lineTo(-tierW / 2, tierY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPalm(tree) {
    const h = tree.h;
    const trunkH = h * tree.trunkH;
    const topX = h * 0.02;

    // Kıvrımlı gövde
    ctx.strokeStyle = tree.layer === 'near' ? C.trunk : C.farTree;
    ctx.lineWidth = Math.max(2.5, h * 0.022);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(h * 0.06, -trunkH * 0.55, topX, -trunkH);
    ctx.stroke();

    // Palmiye yelpazesi
    ctx.strokeStyle = tree.layer === 'near' ? C.nearTree : C.farTree;
    ctx.lineWidth = Math.max(1.6, h * 0.014);
    const fronds = tree.fronds || 7;
    for (let i = 0; i < fronds; i++) {
      const t = fronds > 1 ? i / (fronds - 1) : 0.5;
      const angle = -Math.PI * 0.92 + t * Math.PI * 0.84;
      const len = h * (0.3 + Math.sin(t * Math.PI) * 0.16);
      ctx.beginPath();
      ctx.moveTo(topX, -trunkH);
      ctx.quadraticCurveTo(
        topX + Math.cos(angle) * len * 0.55,
        -trunkH + Math.sin(angle) * len * 0.55 - h * 0.04,
        topX + Math.cos(angle) * len,
        -trunkH + Math.sin(angle) * len * 0.72
      );
      ctx.stroke();
    }

    if (tree.layer === 'near') {
      ctx.fillStyle = C.amber;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(topX + (i - 1) * h * 0.022, -trunkH + h * 0.02, h * 0.016, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawTrees() {
    for (let i = 0; i < farTrees.length; i++) drawTree(farTrees[i]);
  }

  function drawNearTrees() {
    for (let i = 0; i < nearTrees.length; i++) drawTree(nearTrees[i]);
  }

  /* ---------- Çizim: zemin, su, yol ---------- */

  function drawGround() {
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // Ufuk pusu — nefesle yoğunlaşır
    ctx.globalAlpha = 0.5 + clamp(world.mist, 0, 1) * 0.5;
    ctx.fillStyle = C.mist;
    ctx.fillRect(0, horizonY, W, 26);
    ctx.globalAlpha = 1;
  }

  function drawWater() {
    if (C.waterStyle === 'ocean') drawOcean();
    else drawCreek();
  }

  function drawCreek() {
    const half = 18;
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, waterY - half, W, half * 2);

    ctx.strokeStyle = C.waterLight;
    ctx.lineWidth = 1;
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const y = waterY - half + (r + 1) * (half * 2 / (rows + 1));
      ctx.beginPath();
      const drift = reducedMotion ? 0 : time * (10 + r * 5);
      for (let x = -20; x <= W + 20; x += 14) {
        const yy = y + Math.sin((x + drift) * 0.045 + r) * 1.6;
        if (x === -20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.globalAlpha = 0.5 - r * 0.12;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      const sx = p.wx - camera * p.parallax;
      ctx.fillStyle = 'rgba(' + Math.round(120 * p.shade) + ',' +
        Math.round(150 * p.shade) + ',' + Math.round(142 * p.shade) + ',0.5)';
      ctx.beginPath();
      ctx.ellipse(sx, waterY + p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawOcean() {
    const half = 54;
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, waterY - half, W, half * 2 + 20);

    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const t = i / bands;
      const y = waterY - half + t * (half * 2);
      const drift = reducedMotion ? 0 : time * (16 + i * 7);
      ctx.strokeStyle = C.waterLight;
      ctx.globalAlpha = 0.42 - t * 0.22;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 16) {
        const yy = y + Math.sin((x + drift) * 0.03 + i * 1.3) * (2 + t * 2.5);
        if (x === -20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawWaterShimmer() {
    if (reducedMotion) return;
    const s = clamp(world.shimmer, 0, 1);
    if (s < 0.05) return;

    const count = Math.round(14 + s * 34);
    for (let i = 0; i < count; i++) {
      const seed = i * 61.7;
      const sway = Math.sin(time * 1.6 + seed) * 0.5 + 0.5;
      const x = ((seed * 37 + time * (6 + s * 12)) % (W + 40)) - 20;
      const y = waterY + Math.sin(time * 2.2 + seed) * (C.waterStyle === 'ocean' ? 12 : 5);
      ctx.globalAlpha = s * sway * 0.5;
      ctx.fillStyle = C.waterLight;
      ctx.fillRect(x, y, 3, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawPath() {
    const half = 20;
    const grad = ctx.createLinearGradient(0, pathY - half, 0, pathY + half);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
    grad.addColorStop(0.5, C.pathTint);
    grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, pathY - half, W, half * 2);
  }

  function drawPathProps() {
    for (let i = 0; i < pathProps.length; i++) {
      const p = pathProps[i];
      const sx = p.wx - camera * p.parallax;
      const gust = 1 + clamp(world.leaf, 0, 1) * 1.2;
      const sway = reducedMotion ? 0 : Math.sin(time * p.freq + p.phase) * p.amp * gust;
      const y = pathY + p.yOffset;

      ctx.save();
      ctx.translate(sx, y);
      ctx.rotate(sway);
      ctx.scale(p.scale, p.scale);

      if (p.kind === 'fern') {
        ctx.strokeStyle = C.island;
        ctx.globalAlpha = 0.62;
        ctx.lineWidth = 1.4;
        for (let a = -2; a <= 2; a++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(a * 7, -9, a * 13, -18);
          ctx.stroke();
        }
      } else if (p.kind === 'grass') {
        ctx.strokeStyle = C.groundStyle === 'sand' ? C.amber : C.island;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.2;
        for (let a = -1; a <= 1; a++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(a * 3, -8, a * 5, -15);
          ctx.stroke();
        }
      } else if (p.kind === 'flower') {
        ctx.strokeStyle = C.island;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -12);
        ctx.stroke();
        ctx.fillStyle = p.hue;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(0, -13, 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = C.nearTree;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.ellipse(0, -5, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Çizim: kulübe ---------- */

  function drawCabin(cabinX, scale) {
    const s = scale;
    const x = cabinX - camera;
    const baseY = pathY + 8 * s;

    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(s, s);

    const bodyW = 118;
    const bodyH = 74;

    ctx.fillStyle = 'rgba(10, 43, 34, 0.9)';
    ctx.fillRect(-bodyW / 2 - 16, -10, bodyW + 32, 10);

    ctx.fillStyle = C.wood;
    ctx.fillRect(-bodyW / 2, -bodyH, bodyW, bodyH);

    ctx.strokeStyle = 'rgba(4, 26, 20, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = -bodyH + (bodyH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(-bodyW / 2, y);
      ctx.lineTo(bodyW / 2, y);
      ctx.stroke();
    }

    // Çatı: ormanda sivri, adada geniş saz
    ctx.fillStyle = C.roof;
    ctx.beginPath();
    if (C.treeStyle === 'palm') {
      ctx.moveTo(-bodyW / 2 - 26, -bodyH);
      ctx.lineTo(0, -bodyH - 34);
      ctx.lineTo(bodyW / 2 + 26, -bodyH);
    } else {
      ctx.moveTo(-bodyW / 2 - 18, -bodyH);
      ctx.lineTo(0, -bodyH - 46);
      ctx.lineTo(bodyW / 2 + 18, -bodyH);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = C.woodDark;
    ctx.fillRect(-15, -46, 30, 46);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.beginPath();
    ctx.arc(9, -24, 2, 0, Math.PI * 2);
    ctx.fill();

    const windowLit = milestones[50];
    ctx.fillStyle = windowLit ? 'rgba(245, 158, 11, 0.85)' : 'rgba(212, 236, 231, 0.12)';
    ctx.fillRect(28, -60, 24, 22);
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, -60, 24, 22);
    ctx.beginPath();
    ctx.moveTo(40, -60); ctx.lineTo(40, -38);
    ctx.moveTo(28, -49); ctx.lineTo(52, -49);
    ctx.stroke();

    ctx.restore();

    if (milestones[50]) {
      const lampX = x - (bodyW / 2 + 10) * s;
      const lampY = baseY - 58 * s;
      const flicker = reducedMotion ? 0.85 : 0.78 + Math.sin(time * 3.1) * 0.1 + Math.sin(time * 7.7) * 0.05;
      drawGlow(glowAmber, lampX, lampY, 132 * s, Math.min(0.62, flicker * 0.7));
      ctx.fillStyle = C.amber;
      ctx.beginPath();
      ctx.arc(lampX, lampY, 3.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    if (milestones[150]) {
      const chimX = x + 34 * s;
      const chimY = baseY - (bodyH + 40) * s;
      const puffs = 5;
      const cycle = 4.2;
      for (let i = 0; i < puffs; i++) {
        // Hareket azaltmada duman donar: sabit bir konumda bırakılır
        const t = reducedMotion ? i / puffs : ((time / cycle) + i / puffs) % 1;
        const py = chimY - t * 78 * s;
        const px = chimX + Math.sin(t * 5 + i) * 20 * s + t * 26 * s;
        const pr = (12 + t * 26) * s;
        drawGlow(glowMist, px, py, pr * 3, (1 - t) * 0.20);
      }
    }

    if (milestones[300]) {
      const catX = x + 62 * s;
      const catY = baseY - 12 * s;
      ctx.fillStyle = '#0b1d18';
      ctx.beginPath();
      ctx.ellipse(catX, catY, 17 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(catX - 14 * s, catY - 6 * s, 7.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(catX - 19 * s, catY - 11 * s);
      ctx.lineTo(catX - 17 * s, catY - 18 * s);
      ctx.lineTo(catX - 13 * s, catY - 13 * s);
      ctx.moveTo(catX - 11 * s, catY - 13 * s);
      ctx.lineTo(catX - 7 * s, catY - 18 * s);
      ctx.lineTo(catX - 6 * s, catY - 11 * s);
      ctx.fill();
      ctx.strokeStyle = '#0b1d18';
      ctx.lineWidth = 3.4 * s;
      ctx.beginPath();
      ctx.moveTo(catX + 16 * s, catY + 2 * s);
      ctx.quadraticCurveTo(catX + 26 * s, catY + 6 * s, catX + 22 * s, catY - 4 * s);
      ctx.stroke();
    }
  }

  function clampScale() {
    return Math.max(0.62, Math.min(1.06, H / 900 + 0.34));
  }

  function drawCabins() {
    const margin = 320;
    const first = Math.floor((camera - margin) / CABIN_SPACING);
    const last = Math.floor((camera + W + margin) / CABIN_SPACING);

    for (let i = first; i <= last; i++) {
      const wx = i * CABIN_SPACING;
      if (wx <= 0) continue;
      const depth = i % 3 === 0 ? 1 : 0.86;
      drawCabin(wx, depth * clampScale());
    }
  }

  /* ---------- Çizim: ateş böcekleri ve yapraklar ---------- */

  function drawFireflies() {
    if (!milestones[500] || reducedMotion) return;
    for (let i = 0; i < fireflies.length; i++) {
      const f = fireflies[i];
      const sx = f.wx - camera * f.parallax + Math.sin(time * f.freq + f.phase) * f.driftX;
      const sy = f.y + Math.cos(time * f.freq * 0.7 + f.phase) * f.driftY;
      const a = 0.35 + Math.sin(time * 1.6 + f.phase * 2) * 0.3;
      drawGlow(glowGreen, sx, sy, f.size * 2.6, Math.max(0.08, a) * 0.55);
    }
  }

  function drawFallingLeaves() {
    if (reducedMotion) return;
    for (let i = 0; i < leaves.length; i++) {
      const L = leaves[i];
      const x = L.x + Math.sin(time * 1.4 + L.phase) * L.amp;

      ctx.save();
      ctx.translate(x, L.y);
      ctx.rotate(L.rot);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, L.size, L.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Çizim: sis ve keşif öğeleri ---------- */

  function drawFog() {
    const f = clamp(world.fog, 0, 1);
    if (f < 0.02) return;

    const cx = W * 0.5;
    const cy = horizonY + (H - horizonY) * 0.35;
    const radius = Math.max(W, H) * 0.85;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, 'rgba(' + C.fogColor + ',' + (f * 0.3) + ')');
    grad.addColorStop(0.6, 'rgba(' + C.fogColor + ',' + (f * 0.12) + ')');
    grad.addColorStop(1, 'rgba(' + C.fogColor + ',0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Yatay sis bantları: hafifçe kayar, sahne asla tamamen durmaz
    if (!reducedMotion) {
      const bands = 3;
      ctx.fillStyle = 'rgba(' + C.fogColor + ',1)';
      for (let i = 0; i < bands; i++) {
        const y = horizonY + (i + 1) * ((H - horizonY) / (bands + 1));
        const drift = time * (5 + i * 3);
        ctx.globalAlpha = f * 0.16;
        for (let x = -40; x <= W + 40; x += 90) {
          const xx = x + (drift % 90) - 45;
          const yy = y + Math.sin((x + drift) * 0.01 + i) * 4;
          ctx.beginPath();
          ctx.ellipse(xx, yy, 52, 9, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawDiscoveries() {
    for (let i = 0; i < discoveries.length; i++) {
      const d = discoveries[i];
      if (!d.visible) continue;
      const p = clamp(d.progress, 0, 1);
      const fade = Math.min(1, Math.min(p, 1 - p) * 6);

      if (d.id === 'shooting_star') {
        const sx = W * (0.15 + p * 0.7);
        const sy = horizonY * (0.12 + p * 0.4);
        const tailLen = 70;
        const grad = ctx.createLinearGradient(sx - tailLen, sy - tailLen * 0.4, sx, sy);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,255,255,' + (fade * 0.9) + ')');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - tailLen, sy - tailLen * 0.4);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        drawGlow(glowMist, sx, sy, 60, fade * 0.5);
      } else if (d.id === 'butterfly') {
        const sx = W * (1.15 - p * 1.3);
        const sy = pathY - 60 - Math.sin(p * Math.PI * 3) * 34;
        const flap = Math.sin(time * 9) * 0.5 + 0.5;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = fade * 0.75;
        ctx.fillStyle = C.leafColor2;
        ctx.beginPath();
        ctx.ellipse(-4, 0, 5, 3.4 * (0.4 + flap * 0.6), -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(4, 0, 5, 3.4 * (0.4 + flap * 0.6), 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (d.id === 'firefly') {
        const sx = W * 0.5 + Math.sin(p * Math.PI * 2) * W * 0.28;
        const sy = pathY - 110 + Math.cos(p * Math.PI * 3) * 30;
        drawGlow(glowGreen, sx, sy, 90, fade * 0.7);
      } else if (d.id === 'heron') {
        const sx = W * (0.3 + p * 0.3);
        const sy = waterY - 8;
        const land = Math.min(1, p * 3);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = fade;
        ctx.strokeStyle = '#dfeee9';
        ctx.fillStyle = '#dfeee9';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -14 * land);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, -17 * land, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(4, -18 * land);
        ctx.lineTo(11, -21 * land);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-3, 6);
        ctx.moveTo(0, 0); ctx.lineTo(3, 6);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Keşif öğelerinin sahne arkası (ör. balıkçıl için su halkası)
  function drawDiscoveryBackdrop() {
    for (let i = 0; i < discoveries.length; i++) {
      const d = discoveries[i];
      if (!d.visible || d.id !== 'heron') continue;
      const p = clamp(d.progress, 0, 1);
      const fade = Math.min(1, Math.min(p, 1 - p) * 6);
      const sx = W * (0.3 + p * 0.3);
      ctx.globalAlpha = fade * 0.35;
      ctx.strokeStyle = C.waterLight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(sx, waterY + 4, 22 + Math.sin(time * 2) * 3, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Ana döngü ---------- */

  function update(dt) {
    time += dt;

    // Dünya parametrelerini ilerlet, sonra oku.
    // update() çağrılmazsa sis/ay/su parıltısı hedefe hiç yaklaşmaz.
    if (typeof CalmWorld !== 'undefined' && CalmWorld) {
      CalmWorld.update(dt);
      world = CalmWorld.get();
    }

    // Keşif öğeleri tek ana döngüde ilerletilir; ayrı bir rAF yok.
    if (typeof CalmDiscovery !== 'undefined' && CalmDiscovery) {
      CalmDiscovery.update(dt);
      discoveries = CalmDiscovery.getActive();
    }

    const sinceInteraction = time - lastInteraction;
    const nextIdle = sinceInteraction > IDLE_DELAY && !holding && !cruise;
    if (nextIdle !== idle) {
      idle = nextIdle;
      if (onIdleChange) onIdleChange(idle);
    }

    let target = 0;
    if (holding) target = baseSpeed;
    else if (cruise) target = baseSpeed * 0.75;
    // Hareket azaltma: boşta otomatik kayma yapılmaz (kamera hareketi azaltılır)
    else if (idle && !reducedMotion) target = baseSpeed * IDLE_SPEED_FACTOR;

    currentSpeed += (target - currentSpeed) * Math.min(1, dt * 1.8);
    if (currentSpeed < 0.01) currentSpeed = 0;

    const advance = currentSpeed * dt;
    if (advance > 0) {
      camera += advance;
      if (onAdvance) onAdvance(holding || cruise ? advance : advance * IDLE_STEP_FACTOR);
    }

    recycle(farTrees, 200);
    recycle(nearTrees, 300);
    recycle(pathProps, 120);
    recycle(pebbles, 160);
    recycle(fireflies, 220);
    recycle(clouds, 260);

    updateLeaves(dt);
  }

  function updateLeaves(dt) {
    if (reducedMotion) return;
    for (let i = 0; i < leaves.length; i++) {
      const L = leaves[i];
      L.y += L.vy * dt;
      L.x += L.vx * dt;
      L.rot += L.vrot * dt;
      if (L.y > H + 30 || L.x < -40) {
        const nl = makeFallingLeaf();
        nl.x = rand(W * 0.2, W + 60);
        nl.y = rand(-120, -20);
        leaves[i] = nl;
      }
    }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawSky();
    drawRidge();
    drawTrees();
    drawGround();
    drawWater();
    drawWaterShimmer();
    drawNearTrees();
    drawPath();
    drawPathProps();
    drawDiscoveryBackdrop();
    drawCabins();
    drawFireflies();
    drawFallingLeaves();
    drawDiscoveries();
    drawFog();
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    render();
    rafId = requestAnimationFrame(loop);
  }

  /* ---------- Genel arayüz ---------- */

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    layout();
    buildCache();
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function init(el, options) {
    canvas = el;
    ctx = canvas.getContext('2d', { alpha: false });
    options = options || {};
    onAdvance = options.onAdvance || null;
    onIdleChange = options.onIdleChange || null;
    reducedMotion = !!options.reducedMotion;
    if (typeof options.baseSpeed === 'number') baseSpeed = options.baseSpeed;
    if (options.theme && THEMES[options.theme]) C = THEMES[options.theme];

    resize();
    lastInteraction = 0;
    time = 0;
    start();
    return api;
  }

  function notifyInteraction() {
    lastInteraction = time;
    if (idle) {
      idle = false;
      if (onIdleChange) onIdleChange(false);
    }
  }

  function setHolding(value) {
    holding = !!value;
    if (holding) notifyInteraction();
  }

  function setCruise(value) {
    cruise = !!value;
    if (cruise) notifyInteraction();
  }

  function setBaseSpeed(value) {
    baseSpeed = Math.max(4, value);
  }

  // Nefesle yürü modu: tek bir ritüel adımı.
  // Hız entegrasyonunu atlar; doğrudan kamera konumunu ilerletir.
  function stepForward(px) {
    if (!(px > 0)) return;
    camera += px;
    notifyInteraction();
  }

  function setReducedMotion(value) {
    reducedMotion = !!value;
    for (let i = 0; i < farTrees.length; i++) farTrees[i].amp = 0;
    for (let i = 0; i < nearTrees.length; i++) nearTrees[i].amp = 0;
    for (let i = 0; i < pathProps.length; i++) pathProps[i].amp = 0;
    if (reducedMotion) {
      fireflies = [];
      leaves = [];
      clouds = [];
    } else {
      buildLayers();
    }
  }

  function setTheme(next) {
    if (!THEMES[next]) return;
    C = THEMES[next];
    layout();
    buildCache();
  }

  function setDiscoveries(list) {
    discoveries = Array.isArray(list) ? list : [];
  }

  function unlockMilestone(threshold) {
    milestones[threshold] = true;
  }

  function setMilestones(list) {
    if (!Array.isArray(list)) return;
    for (let i = 0; i < list.length; i++) milestones[list[i]] = true;
  }

  function getCamera() {
    return camera;
  }

  function isIdle() {
    return idle;
  }

  function getMetrics() {
    return { W: W, H: H, horizonY: horizonY, waterY: waterY, pathY: pathY };
  }

  function destroy() {
    pause();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  let resizeTimer = null;
  function onResize() {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      resize();
    }, 180);
  }

  function onVisibility() {
    if (document.hidden) pause();
    else start();
  }

  const api = {
    init: init,
    resize: resize,
    destroy: destroy,
    notifyInteraction: notifyInteraction,
    setHolding: setHolding,
    setCruise: setCruise,
    setBaseSpeed: setBaseSpeed,
    stepForward: stepForward,
    setReducedMotion: setReducedMotion,
    setTheme: setTheme,
    setDiscoveries: setDiscoveries,
    unlockMilestone: unlockMilestone,
    setMilestones: setMilestones,
    getCamera: getCamera,
    getMetrics: getMetrics,
    isIdle: isIdle,
    isCruise: function () { return cruise; },
    THEMES: THEMES,
    attachGlobalListeners: function () {
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
    }
  };

  return api;
})();
