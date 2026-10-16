/* =========================================================
   Calm Haven / Sakin Sığınak — canvas.js
   Sonsuz orman & ada görsel alanı.
   Paralaks derinlik, döngüsel tampon, delta-time ana döngü.
   ========================================================= */

const CalmForest = (function () {
  'use strict';

  const COLORS = {
    skyTop: '#16233f',
    skyMid: '#0f172a',
    skyLow: '#0a1526',
    ridge: 'rgba(8, 26, 38, 0.85)',
    farTree: '#0a2a30',
    nearTree: '#05231b',
    trunk: '#041a14',
    groundTop: '#062c22',
    groundLow: '#031510',
    water: '#0d3b3a',
    waterLight: 'rgba(148, 226, 213, 0.30)',
    island: '#10b981',
    islandSoft: 'rgba(16, 185, 129, 0.55)',
    amber: '#f59e0b',
    wood: '#123c30',
    woodDark: '#0a2b22',
    roof: '#0d3a2c',
    mist: 'rgba(212, 236, 231, 0.10)'
  };

  const CABIN_SPACING = 800;
  const IDLE_DELAY = 10;        // s — etkileşimsizlik sonrası yavaş salınım
  const IDLE_SPEED_FACTOR = 0.25;
  const IDLE_STEP_FACTOR = 0.06;

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let W = 0;
  let H = 0;

  let horizonY = 0;
  let creekY = 0;
  let pathY = 0;

  let camera = 0;
  let baseSpeed = 22;           // px/s (ayar ile değişir)
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

  const milestones = Object.create(null);

  // Katmanlar
  let stars = [];
  let ridgePoints = [];
  let farTrees = [];
  let nearTrees = [];
  let pathProps = [];
  let pebbles = [];
  let fireflies = [];

  // Önbelleğe alınan gradyan ve ışıma görselleri
  let skyGradient = null;
  let groundGradient = null;
  let creekGradient = null;
  let glowAmber = null;
  let glowGreen = null;
  let glowMist = null;

  /* ---------- Yardımcılar ---------- */

  function rand(min, max) {
    return min + Math.random() * (max - min);
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

  function drawGlow(sprite, x, y, size, alpha) {
    if (!sprite) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  /* ---------- Kurulum ---------- */

  function buildCache() {
    skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY + 2);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(0.55, COLORS.skyMid);
    skyGradient.addColorStop(1, COLORS.skyLow);

    groundGradient = ctx.createLinearGradient(0, horizonY, 0, H);
    groundGradient.addColorStop(0, COLORS.groundTop);
    groundGradient.addColorStop(0.45, '#04211a');
    groundGradient.addColorStop(1, COLORS.groundLow);

    creekGradient = ctx.createLinearGradient(0, creekY - 20, 0, creekY + 20);
    creekGradient.addColorStop(0, 'rgba(13, 59, 58, 0)');
    creekGradient.addColorStop(0.5, COLORS.water);
    creekGradient.addColorStop(1, 'rgba(13, 59, 58, 0)');

    glowAmber = makeGlow('rgba(245, 158, 11, 0.9)', 96);
    glowGreen = makeGlow('rgba(16, 185, 129, 0.9)', 64);
    glowMist = makeGlow('rgba(212, 236, 231, 0.55)', 128);
  }

  function makePine(baseY, parallax, layer) {
    const minH = layer === 'far' ? 26 : 90;
    const maxH = layer === 'far' ? 74 : Math.min(300, H * 0.52);
    return {
      wx: 0,
      baseY,
      parallax,
      h: rand(minH, maxH),
      w: rand(0.42, 0.62),
      phase: rand(0, Math.PI * 2),
      freq: rand(0.6, 1.3),
      amplitude: reducedMotion ? 0 : rand(0.012, 0.032),
      shade: rand(0.82, 1.18),
      layer
    };
  }

  function buildLayers() {
    const spread = W + 400;

    stars = [];
    const starCount = Math.round(Math.min(200, (W * horizonY) / 9000));
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, horizonY * 0.94),
        r: rand(0.6, 1.7),
        phase: rand(0, Math.PI * 2),
        freq: rand(0.4, 1.8),
        base: rand(0.25, 0.85)
      });
    }

    ridgePoints = [];
    for (let x = -60; x <= W + 60; x += 26) {
      ridgePoints.push({
        x,
        h: 26 + Math.sin(x * 0.004) * 22 + Math.sin(x * 0.011 + 1.7) * 12
      });
    }

    farTrees = [];
    const farCount = Math.max(14, Math.round(W / 46));
    for (let i = 0; i < farCount; i++) {
      const t = makePine(horizonY + 6, 0.34, 'far');
      t.wx = -200 + (i / farCount) * spread + rand(-18, 18);
      farTrees.push(t);
    }

    nearTrees = [];
    const nearCount = Math.max(4, Math.round(W / 210));
    for (let i = 0; i < nearCount; i++) {
      const t = makePine(pathY - H * 0.06, 0.86, 'near');
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
  }

  function makePathProp() {
    const roll = Math.random();
    const kind = roll < 0.42 ? 'fern' : roll < 0.72 ? 'grass' : roll < 0.92 ? 'flower' : 'shrub';
    return {
      wx: 0,
      kind,
      yOffset: rand(-pathY * 0.16, pathY * 0.08),
      scale: rand(0.6, 1.25),
      phase: rand(0, Math.PI * 2),
      freq: rand(0.5, 1.4),
      amplitude: reducedMotion ? 0 : rand(0.01, 0.05),
      hue: Math.random() < 0.3 ? COLORS.amber : COLORS.island
    };
  }

  function makePebble() {
    return {
      wx: 0,
      y: rand(-14, 18),
      rx: rand(2.5, 7),
      ry: rand(1.6, 3.4),
      shade: rand(0.5, 0.9)
    };
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

  function layout() {
    horizonY = Math.round(H * 0.5);
    creekY = Math.round(H * 0.68);
    pathY = Math.round(H * 0.86);
    buildLayers();
  }

  /* ---------- Döngüsel tampon (circular buffer) ---------- */

  function recycle(layer, margin) {
    const span = W + margin * 2;
    for (let i = 0; i < layer.length; i++) {
      const it = layer[i];
      // parallax tanımsız olan katmanlar kamera ile 1:1 hareket eder
      const px = typeof it.parallax === 'number' ? it.parallax : 1;
      const sx = it.wx - camera * px;
      if (sx < -margin) {
        it.wx += span;
      }
    }
  }

  /* ---------- Çizim: gökyüzü ---------- */

  function drawSky() {
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, horizonY + 2);

    // Yıldızlar (organik parıldama)
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = reducedMotion ? s.base : s.base + Math.sin(time * s.freq + s.phase) * 0.35;
      const a = Math.max(0.05, Math.min(1, tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#dfeee9';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    drawMoon();
  }

  function drawMoon() {
    const mx = W * 0.78;
    const my = horizonY * 0.3;
    const r = Math.max(18, Math.min(30, W * 0.018));

    drawGlow(glowMist, mx, my, r * 5.2, 0.35);

    ctx.fillStyle = 'rgba(226, 240, 235, 0.92)';
    ctx.beginPath();
    ctx.arc(mx, my, r, Math.PI * 0.35, Math.PI * 1.65, false);
    ctx.arc(mx + r * 0.52, my, r * 0.94, Math.PI * 1.65, Math.PI * 0.35, true);
    ctx.closePath();
    ctx.fill();
  }

  function drawRidge() {
    ctx.fillStyle = COLORS.ridge;
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

  function drawPine(tree) {
    const sway = reducedMotion ? 0 : Math.sin(time * tree.freq + tree.phase) * tree.amplitude;
    const h = tree.h;
    const w = h * tree.w;
    const shade = tree.layer === 'far' ? COLORS.farTree : COLORS.nearTree;

    ctx.save();
    ctx.translate(tree.wx - camera * tree.parallax, tree.baseY);
    ctx.rotate(sway);

    // Gövde
    ctx.fillStyle = COLORS.trunk;
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

    ctx.restore();
  }

  function drawTrees() {
    for (let i = 0; i < farTrees.length; i++) drawPine(farTrees[i]);
  }

  function drawNearTrees() {
    for (let i = 0; i < nearTrees.length; i++) drawPine(nearTrees[i]);
  }

  /* ---------- Çizim: zemin, dere, yol ---------- */

  function drawGround() {
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // Ufuk hattında yumuşak pus
    ctx.fillStyle = COLORS.mist;
    ctx.fillRect(0, horizonY, W, 26);
  }

  function drawCreek() {
    const half = 18;
    ctx.fillStyle = creekGradient;
    ctx.fillRect(0, creekY - half, W, half * 2);

    // Su kırışıklıkları: her zaman akar (idle dahil)
    ctx.strokeStyle = COLORS.waterLight;
    ctx.lineWidth = 1;
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const y = creekY - half + (r + 1) * (half * 2 / (rows + 1));
      ctx.beginPath();
      const drift = reducedMotion ? 0 : time * (10 + r * 5);
      for (let x = -20; x <= W + 20; x += 14) {
        const yy = y + Math.sin((x + drift) * 0.045 + r) * 1.6;
        if (x === -20) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.globalAlpha = 0.5 - r * 0.12;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Dere kenarı taşları
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      const sx = p.wx - camera;
      ctx.fillStyle = 'rgba(' + Math.round(120 * p.shade) + ',' +
        Math.round(150 * p.shade) + ',' + Math.round(142 * p.shade) + ',0.5)';
      ctx.beginPath();
      ctx.ellipse(sx, creekY + p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPath() {
    const half = 20;
    const grad = ctx.createLinearGradient(0, pathY - half, 0, pathY + half);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
    grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.07)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, pathY - half, W, half * 2);
  }

  function drawPathProps() {
    for (let i = 0; i < pathProps.length; i++) {
      const p = pathProps[i];
      const sx = p.wx - camera;
      const sway = reducedMotion ? 0 : Math.sin(time * p.freq + p.phase) * p.amplitude;
      const y = pathY + p.yOffset;

      ctx.save();
      ctx.translate(sx, y);
      ctx.rotate(sway);
      ctx.scale(p.scale, p.scale);

      if (p.kind === 'fern') {
        ctx.strokeStyle = COLORS.island;
        ctx.globalAlpha = 0.62;
        ctx.lineWidth = 1.4;
        for (let a = -2; a <= 2; a++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(a * 7, -9, a * 13, -18);
          ctx.stroke();
        }
      } else if (p.kind === 'grass') {
        ctx.strokeStyle = COLORS.island;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.2;
        for (let a = -1; a <= 1; a++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(a * 3, -8, a * 5, -15);
          ctx.stroke();
        }
      } else if (p.kind === 'flower') {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
        ctx.globalAlpha = 1;
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
        ctx.fillStyle = COLORS.nearTree;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.ellipse(0, -5, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Çizim: kişisel kulübe ---------- */

  function drawCabin(cabinX, scale) {
    const s = scale;
    const x = cabinX - camera;
    const baseY = pathY + 8 * s;

    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(s, s);

    const bodyW = 118;
    const bodyH = 74;

    // Veranda
    ctx.fillStyle = 'rgba(10, 43, 34, 0.9)';
    ctx.fillRect(-bodyW / 2 - 16, -10, bodyW + 32, 10);

    // Gövde
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(-bodyW / 2, -bodyH, bodyW, bodyH);

    // Ahşap çizgileri
    ctx.strokeStyle = 'rgba(4, 26, 20, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = -bodyH + (bodyH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(-bodyW / 2, y);
      ctx.lineTo(bodyW / 2, y);
      ctx.stroke();
    }

    // Çatı
    ctx.fillStyle = COLORS.roof;
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2 - 18, -bodyH);
    ctx.lineTo(0, -bodyH - 46);
    ctx.lineTo(bodyW / 2 + 18, -bodyH);
    ctx.closePath();
    ctx.fill();

    // Kapı
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(-15, -46, 30, 46);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.beginPath();
    ctx.arc(9, -24, 2, 0, Math.PI * 2);
    ctx.fill();

    // Pencere
    const windowLit = milestones[50];
    ctx.fillStyle = windowLit ? 'rgba(245, 158, 11, 0.85)' : 'rgba(212, 236, 231, 0.12)';
    ctx.fillRect(28, -60, 24, 22);
    ctx.strokeStyle = COLORS.woodDark;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, -60, 24, 22);
    ctx.beginPath();
    ctx.moveTo(40, -60);
    ctx.lineTo(40, -38);
    ctx.moveTo(28, -49);
    ctx.lineTo(52, -49);
    ctx.stroke();

    ctx.restore();

    // Veranda feneri (50 adım)
    if (milestones[50]) {
      const lampX = x - (bodyW / 2 + 10) * s;
      const lampY = baseY - 58 * s;
      const flicker = reducedMotion ? 0.85 : 0.78 + Math.sin(time * 3.1) * 0.1 + Math.sin(time * 7.7) * 0.05;
      drawGlow(glowAmber, lampX, lampY, 132 * s, Math.min(0.62, flicker * 0.7));
      ctx.fillStyle = COLORS.amber;
      ctx.beginPath();
      ctx.arc(lampX, lampY, 3.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Baca dumanı (150 adım)
    if (milestones[150]) {
      const chimX = x + 34 * s;
      const chimY = baseY - (bodyH + 40) * s;
      const puffs = 5;
      const cycle = 4.2;
      for (let i = 0; i < puffs; i++) {
        const t = ((time / cycle) + i / puffs) % 1;
        const py = chimY - t * 78 * s;
        const px = chimX + Math.sin(t * 5 + i) * 20 * s + t * 26 * s;
        const pr = (12 + t * 26) * s;
        drawGlow(glowMist, px, py, pr * 3, (1 - t) * 0.20);
      }
    }

    // Uyuyan kedi (300 adım)
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

  function drawCabins() {
    const margin = 320;
    const left = camera - margin;
    const right = camera + W + margin;
    const first = Math.floor(left / CABIN_SPACING);
    const last = Math.floor(right / CABIN_SPACING);

    for (let i = first; i <= last; i++) {
      const wx = i * CABIN_SPACING;
      if (wx <= 0) continue;
      const depth = i % 3 === 0 ? 1 : 0.86;
      drawCabin(wx, depth * clampScale());
    }
  }

  function clampScale() {
    return Math.max(0.62, Math.min(1.06, H / 900 + 0.34));
  }

  /* ---------- Çizim: ateş böcekleri ---------- */

  function drawFireflies() {
    if (!milestones[500]) return;
    for (let i = 0; i < fireflies.length; i++) {
      const f = fireflies[i];
      const sx = f.wx - camera * f.parallax + Math.sin(time * f.freq + f.phase) * f.driftX;
      const sy = f.y + Math.cos(time * f.freq * 0.7 + f.phase) * f.driftY;
      const a = 0.35 + Math.sin(time * 1.6 + f.phase * 2) * 0.3;
      drawGlow(glowGreen, sx, sy, f.size * 2.6, Math.max(0.08, a) * 0.55);
    }
  }

  /* ---------- Ana döngü ---------- */

  function update(dt) {
    time += dt;

    const sinceInteraction = time - lastInteraction;
    const nextIdle = sinceInteraction > IDLE_DELAY && !holding && !cruise;
    if (nextIdle !== idle) {
      idle = nextIdle;
      if (onIdleChange) onIdleChange(idle);
    }

    let target = 0;
    if (holding) target = baseSpeed;
    else if (cruise) target = baseSpeed * 0.75;
    else if (idle) target = baseSpeed * IDLE_SPEED_FACTOR;

    currentSpeed += (target - currentSpeed) * Math.min(1, dt * 1.8);
    if (currentSpeed < 0.01) currentSpeed = 0;

    const advance = currentSpeed * dt;
    if (advance > 0) {
      camera += advance;
      if (onAdvance) {
        onAdvance(holding || cruise ? advance : advance * IDLE_STEP_FACTOR);
      }
    }

    recycle(farTrees, 200);
    recycle(nearTrees, 300);
    recycle(pathProps, 120);
    recycle(pebbles, 160);
    recycle(fireflies, 220);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawSky();
    drawRidge();
    drawTrees();
    drawGround();
    drawCreek();
    drawNearTrees();
    drawPath();
    drawPathProps();
    drawCabins();
    drawFireflies();
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

  function setReducedMotion(value) {
    reducedMotion = !!value;
    for (let i = 0; i < farTrees.length; i++) farTrees[i].amplitude = 0;
    for (let i = 0; i < nearTrees.length; i++) nearTrees[i].amplitude = 0;
    for (let i = 0; i < pathProps.length; i++) pathProps[i].amplitude = 0;
    if (reducedMotion) fireflies = [];
    else buildLayers();
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
    setReducedMotion: setReducedMotion,
    unlockMilestone: unlockMilestone,
    setMilestones: setMilestones,
    getCamera: getCamera,
    isIdle: isIdle,
    isCruise: function () { return cruise; },
    attachGlobalListeners: function () {
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
    }
  };

  return api;
})();
