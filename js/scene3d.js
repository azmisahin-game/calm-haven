/* =========================================================
   Calm Haven / Sakin Sığınak — scene3d.js  (3.0)
   Three.js tabanlı 3D dünya: derinlik, gerçek nesneler, shader'lı
   sis/su/ışık ve nefes senkronizasyonu.

   ES modülü olarak yüklenir (vendor/three.module.min.js yerelden gelir;
   CDN yoktur, çevrimdışı da çalışır). WebGL yoksa veya three.js
   yüklenemezse window.CalmScene3D tanımsız kalır ve app.js 2D
   canvas.js motoruna düşer — böylece hiçbir koşulda boş ekran olmaz.
   ========================================================= */

import * as THREE from '../vendor/three.module.min.js';

const CalmScene3D = (function () {
  'use strict';

  const EYE = 1.7;
  const CHUNK = 14;            // yanal yerleşim genişliği (birim)
  const RECYCLE_BEHIND = 25;   // kameranın bu kadar gerisindeki nesne geri dönüşür
  const SPREAD = 70;           // ileriye doğru yerleşim derinliği
  const NEAR_MIN = 5;          // kayalar için en yakın doğuş mesafesi
  // Ağaçlar için daha uzak bir alt sınır: 4-6 birim yüksekliğindeki bir ağaç
  // kameranın 5 birim önünde doğarsa ekranın üst yarısını tamamen kapatır ve
  // gökyüzü hiç görünmez. Ölçüm: ada temasında gün batımı gökyüzünün yalnızca
  // %3'ü görünüyordu. Bu yüzden ağaçlar daha geride başlar ve kompozisyonu
  // çerçeveler, kapatmaz.
  const TREE_NEAR_MIN = 17;
  const IDLE_DELAY = 10;
  const IDLE_SPEED_FACTOR = 0.25;
  const IDLE_STEP_FACTOR = 0.06;
  // Boşta kayma varsayılan olarak KAPALIDIR (bkz. canvas.js aynı not).
  let idleDrift = false;
  const TURN_SPEED = 1.5;      // rad/s (A/D)

  const THEMES = {
    forest: {
      skyTop: 0x2c4570, skyMid: 0x1c2c4d, skyLow: 0x132039,
      fogColor: 0x16283f,
      ground: 0x0d4433, groundFar: 0x08281d,
      trunk: 0x0a2a20, foliage: 0x14543c, foliageAlt: 0x0e3f2d,
      rock: 0x1b4247,
      water: 0x15605c, waterDeep: 0x0a3438,
      wood: 0x2a6350, roof: 0x1d5a45,
      treeStyle: 'pine',
      hasCreek: true, hasOcean: false,
      hemiSky: 0xa8c4e8, hemiGround: 0x14402c
    },
    island: {
      skyTop: 0x4a3568, skyMid: 0x9c5f78, skyLow: 0xd98b62,
      fogColor: 0xc98a70,
      ground: 0xe0bd82, groundFar: 0xa8845a,
      trunk: 0x6b4a35, foliage: 0x3d7a58, foliageAlt: 0x2d5c44,
      rock: 0xb8a48c,
      water: 0x2b7f92, waterDeep: 0x134a5c,
      wood: 0xa8764a, roof: 0xbd8b5c,
      treeStyle: 'palm',
      hasCreek: false, hasOcean: true,
      hemiSky: 0xffd9b0, hemiGround: 0xb08a5c
    }
  };

  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = null;
  let canvas = null;
  let rafId = null;
  let running = false;
  let ok = false;

  let theme = 'forest';
  let T = THEMES.forest;
  let reducedMotion = false;

  let yaw = 0;
  let pitch = 0;
  let camZ = 0;              // ilerleme ekseni (-Z yönünde negatifleşir)
  let speed = 22;
  let currentSpeed = 0;
  let turnInput = 0;
  let holding = false;
  let cruise = false;
  let idle = false;
  let time = 0;
  let lastInteraction = 0;
  let bobPhase = 0;

  let world = { fog: 0.3, moon: 0.7, shimmer: 0.5, leaf: 0.2, mist: 0.35 };
  let discoveries = [];
  const milestones = Object.create(null);

  let onAdvance = null;
  let onIdleChange = null;

  // Sahne grupları
  let groundMesh = null;
  let waterMesh = null;
  let skyMesh = null;
  let moonMesh = null;
  let hemiLight = null;
  let moonLight = null;
  let starField = null;
  const cabinPool = [];
  let discoveryGroup = null;

  // Ağaç ve kayalar InstancedMesh ile çizilir: yüzlerce nesne tek çizim
  // çağrısında birleşir. Döngüsel tampon matris güncellemesiyle yapılır.
  let pineFoliage = null;   // InstancedMesh
  let pineTrunks = null;
  let palmTrunks = null;
  let palmFronds = null;
  let rockMesh = null;
  const PINE_MAX = 130;
  const ROCK_MAX = 70;
  const PALM_MAX = 60;
  const FROND_PER_PALM = 7;
  let instanceData = [];    // { kind, x, z, scale, phase } — yerleşim kayıtları

  let waterUniforms = null;

  /* ---------- Yardımcılar ---------- */

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeSkyMaterial() {
    // Gökyüzü: dikey gradyan, nefesle ay ışığı eklenir
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(T.skyTop) },
        midColor: { value: new THREE.Color(T.skyMid) },
        lowColor: { value: new THREE.Color(T.skyLow) },
        moonLight: { value: 0.7 },
        moonDir: { value: new THREE.Vector3(0.6, 0.5, -0.6).normalize() }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 midColor; uniform vec3 lowColor;
        uniform float moonLight; uniform vec3 moonDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(lowColor, midColor, smoothstep(0.35, 0.55, h));
          col = mix(col, topColor, smoothstep(0.55, 1.0, h));
          // Ay ışığı: ay yönüne bakan bölge hafifçe aydınlanır
          float m = max(dot(normalize(vDir), normalize(moonDir)), 0.0);
          col += vec3(0.16, 0.19, 0.24) * pow(m, 3.0) * moonLight;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
  }

  function makeWaterMaterial() {
    waterUniforms = {
      uTime: { value: 0 },
      uShimmer: { value: 0.5 },
      uColor: { value: new THREE.Color(T.water) },
      uDeep: { value: new THREE.Color(T.waterDeep) },
      uMoon: { value: 0.7 }
    };
    return new THREE.ShaderMaterial({
      transparent: true,
      uniforms: waterUniforms,
      vertexShader: `
        uniform float uTime; uniform float uShimmer;
        varying vec2 vUv; varying float vWave;
        void main() {
          vUv = uv;
          vec3 p = position;
          float w = sin(p.x * 0.35 + uTime * 0.7) * 0.06
                  + sin(p.y * 0.5 - uTime * 0.5) * 0.05;
          w *= (0.4 + uShimmer);
          p.z += w;
          vWave = w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime; uniform float uShimmer; uniform float uMoon;
        uniform vec3 uColor; uniform vec3 uDeep;
        varying vec2 vUv; varying float vWave;
        void main() {
          // Parıltı: hareketli çizgiler, nefesle yoğunlaşır
          float g = sin(vUv.x * 90.0 + uTime * 2.0) * sin(vUv.y * 22.0 - uTime * 1.1);
          float sparkle = smoothstep(0.86, 1.0, g) * uShimmer * (0.35 + uMoon * 0.65);
          vec3 col = mix(uDeep, uColor, smoothstep(-0.08, 0.08, vWave) * 0.6 + 0.35);
          col += vec3(0.72, 0.86, 0.9) * sparkle;
          gl_FragColor = vec4(col, 0.9);
        }
      `
    });
  }

  function makePineGeometry() {
    // Katmanlı koni: çam silueti
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.ConeGeometry(1.05 - i * 0.22, 1.5, 6);
      g.translate(0, 1.1 + i * 0.85, 0);
      parts.push(g);
    }
    return mergeGeoms(parts);
  }

  function makePalmTrunkGeometry() {
    const g = new THREE.CylinderGeometry(0.12, 0.22, 4.2, 6);
    g.translate(0, 2.1, 0);
    return g;
  }

  function makeFrondGeometry() {
    const g = new THREE.ConeGeometry(0.42, 2.2, 4);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -1.1);
    return g;
  }

  // Basit geometri birleştirme (BufferGeometryUtils bağımlılığı olmadan)
  function mergeGeoms(list) {
    let totalVerts = 0;
    list.forEach(g => { totalVerts += g.attributes.position.count; });
    const pos = new Float32Array(totalVerts * 3);
    const norm = new Float32Array(totalVerts * 3);
    let offset = 0;
    list.forEach(g => {
      const p = g.attributes.position.array;
      const n = g.attributes.normal ? g.attributes.normal.array : null;
      pos.set(p, offset * 3);
      if (n) norm.set(n, offset * 3);
      offset += g.attributes.position.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    return out;
  }

  /* ---------- Nesne oluşturma ---------- */

  /* ---------- Instanced orman ---------- */

  // Ağaçlar ve kayalar InstancedMesh ile çizilir. Yüzlerce nesne yerine
  // birkaç çizim çağrısı yapılır; yazılım (software) WebGL'de bile akıcı kalır.
  function makeInstanced(geometry, color, count, flat) {
    const mat = new THREE.MeshLambertMaterial({ color: color });
    if (flat) mat.flatShading = true;
    const mesh = new THREE.InstancedMesh(geometry, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    return mesh;
  }

  function seedInstances() {
    instanceData = [];
    const isPalm = T.treeStyle === 'palm';

    if (isPalm) {
      for (let i = 0; i < PALM_MAX; i++) {
        instanceData.push({
          kind: 'palm',
          // Palmiyeler sahneyi çerçeveler: daha geride başlar ve hafif
          // küçülür, böylece ortada gün batımı gökyüzü açık kalır.
          x: rand(-CHUNK, CHUNK),
          z: camZ - rand(TREE_NEAR_MIN, SPREAD),
          scale: rand(0.75, 1.25),
          phase: rand(0, Math.PI * 2),
          tilt: 0
        });
      }
    } else {
      for (let i = 0; i < PINE_MAX; i++) {
        instanceData.push({
          kind: 'pine',
          x: rand(-CHUNK, CHUNK),
          z: camZ - rand(TREE_NEAR_MIN, SPREAD),
          scale: rand(0.8, 1.9),
          phase: rand(0, Math.PI * 2),
          tilt: 0
        });
      }
    }

    for (let i = 0; i < ROCK_MAX; i++) {
      instanceData.push({
        kind: 'rock',
        x: rand(-CHUNK, CHUNK),
        z: camZ - rand(NEAR_MIN, SPREAD),
        scale: rand(0.6, 1.6),
        phase: rand(0, 3),
        tilt: rand(-0.3, 0.3)
      });
    }
  }

  function buildInstanced() {
    const isPalm = T.treeStyle === 'palm';

    if (isPalm) {
      palmTrunks = makeInstanced(makePalmTrunkGeometry(), T.trunk, PALM_MAX, false);
      scene.add(palmTrunks);

      // Her palmiye için ayrı yaprak demeti: yaprak geometrisini
      // PALM_MAX * FROND_PER_PALM örnekle çiziyoruz.
      const frondGeo = makeFrondGeometry();
      palmFronds = makeInstanced(frondGeo, T.foliage, PALM_MAX * FROND_PER_PALM, false);
      scene.add(palmFronds);
    } else {
      pineFoliage = makeInstanced(makePineGeometry(), T.foliage, PINE_MAX, true);
      scene.add(pineFoliage);
      pineTrunks = makeInstanced(
        new THREE.CylinderGeometry(0.12, 0.18, 1.3, 5), T.trunk, PINE_MAX, false
      );
      scene.add(pineTrunks);
    }

    rockMesh = makeInstanced(new THREE.DodecahedronGeometry(0.7, 0), T.rock, ROCK_MAX, true);
    scene.add(rockMesh);
  }

  const _m4 = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3();
  const _s = new THREE.Vector3();

  function updateInstances() {
    const isPalm = T.treeStyle === 'palm';
    const gust = reducedMotion ? 0 : (1 + world.leaf * 1.6) * 0.03;

    let pineIdx = 0, rockIdx = 0, palmIdx = 0, frondIdx = 0;

    for (let i = 0; i < instanceData.length; i++) {
      const d = instanceData[i];

      // Döngüsel tampon: kameranın gerisinde kalan nesneyi ileri taşı
      if (d.z > camZ + RECYCLE_BEHIND) {
        d.z = camZ - rand(TREE_NEAR_MIN, SPREAD);
        d.x = rand(-CHUNK, CHUNK);
        d.scale = d.kind === 'rock' ? rand(0.6, 1.6) : rand(0.75, 1.9);
      }

      // Rüzgar salınımı: z ekseni etrafında küçük bir eğilme
      const tilt = reducedMotion ? 0 : Math.sin(time * 0.9 + d.phase) * gust;

      _e.set(d.tilt, d.phase, tilt);
      _q.setFromEuler(_e);
      _v.set(d.x, 0, d.z);

      if (d.kind === 'pine') {
        _s.setScalar(d.scale);
        _m4.compose(_v, _q, _s);
        pineFoliage.setMatrixAt(pineIdx, _m4);
        // Gövde: aynı konum, hafif yukarı
        _v.set(d.x, 0.6 * d.scale, d.z);
        _m4.compose(_v, _q, _s);
        pineTrunks.setMatrixAt(pineIdx, _m4);
        pineIdx++;
      } else if (d.kind === 'palm') {
        _s.setScalar(d.scale);
        _m4.compose(_v, _q, _s);
        palmTrunks.setMatrixAt(palmIdx, _m4);
        // Yapraklar: gövde tepesinden dışa açılan demet
        for (let f = 0; f < FROND_PER_PALM; f++) {
          const ang = (f / FROND_PER_PALM) * Math.PI * 2;
          _e.set(-0.55 - (f % 2) * 0.18, ang, tilt);
          _q.setFromEuler(_e);
          _v.set(d.x, 4.2 * d.scale, d.z);
          _s.setScalar(d.scale);
          _m4.compose(_v, _q, _s);
          palmFronds.setMatrixAt(frondIdx, _m4);
          frondIdx++;
        }
        palmIdx++;
      } else {
        _s.set(d.scale, d.scale * 0.75, d.scale);
        _v.set(d.x, -0.1, d.z);
        _m4.compose(_v, _q, _s);
        rockMesh.setMatrixAt(rockIdx, _m4);
        rockIdx++;
      }
    }

    if (pineFoliage) { pineFoliage.instanceMatrix.needsUpdate = true; pineTrunks.instanceMatrix.needsUpdate = true; }
    if (palmTrunks) { palmTrunks.instanceMatrix.needsUpdate = true; palmFronds.instanceMatrix.needsUpdate = true; }
    if (rockMesh) rockMesh.instanceMatrix.needsUpdate = true;
  }

  function createCabin(x, z) {
    const group = new THREE.Group();
    const bodyW = 5;
    const bodyH = 3.2;
    const bodyD = 4.4;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW, bodyH, bodyD),
      new THREE.MeshLambertMaterial({ color: T.wood })
    );
    body.position.y = bodyH / 2;
    group.add(body);

    // Çatı: piramit
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(bodyW * 0.82, 2.4, 4),
      new THREE.MeshLambertMaterial({ color: T.roof, flatShading: true })
    );
    roof.position.y = bodyH + 1.2;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Kapı
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.0, 0.12),
      new THREE.MeshLambertMaterial({ color: T.trunk })
    );
    door.position.set(0, 1.0, bodyD / 2 + 0.02);
    group.add(door);

    // Pencere (50 adımda yanar)
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.0),
      new THREE.MeshBasicMaterial({ color: 0x1a2a2a })
    );
    win.position.set(-1.5, 2.0, bodyD / 2 + 0.03);
    group.add(win);
    group.userData.window = win;

    // Fener ışığı (50 adım)
    const lamp = new THREE.PointLight(0xf59e0b, 0, 14, 2);
    lamp.position.set(bodyW / 2 + 0.7, 2.3, bodyD / 2);
    group.add(lamp);
    group.userData.lamp = lamp;

    // Baca dumanı (150 adım): küçük yarı saydam küreler
    const puffs = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0 })
      );
      group.add(p);
      puffs.push(p);
    }
    group.userData.puffs = puffs;

    // Uyuyan kedi (300 adım)
    const cat = new THREE.Group();
    const catBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x0b1d18 })
    );
    catBody.scale.set(1.5, 0.85, 1);
    cat.add(catBody);
    const catHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x0b1d18 })
    );
    catHead.position.set(-0.42, 0.1, 0);
    cat.add(catHead);
    cat.position.set(2.6, 0.28, bodyD / 2 + 0.3);
    cat.visible = false;
    group.add(cat);
    group.userData.cat = cat;

    // Bahçe: dikilen çiçekler kulübenin yanında, dünyada görünür.
    // Önceden bahçe yalnızca ayarlardaki soyut ızgaraydı; kullanıcı
    // "bastığımda bir şey olmuyor" diyordu. Artık çiçekler sahneye
    // yerleştirilir ve büyüdükçe boyutları artar (asla solmaz).
    const garden = new THREE.Group();
    garden.position.set(-(bodyW / 2) - 2.4, 0, bodyD / 2 - 1.2);
    group.add(garden);
    group.userData.garden = garden;
    group.userData.flowers = [];

    group.position.set(x, 0, z);
    return group;
  }

  /* ---------- Yerleşim ---------- */

  function buildWorld() {
    // Gökyüzü
    skyMesh = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), makeSkyMaterial());
    scene.add(skyMesh);

    // Yıldızlar
    const starCount = reducedMotion ? 120 : 420;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 300;
      const theta = rand(0, Math.PI * 2);
      const phi = rand(0.05, 1.25);
      starPos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
      starPos[i * 3 + 1] = Math.cos(phi) * r;
      starPos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfeee9, size: 1.6, sizeAttenuation: false }));
    scene.add(starField);

    // Ay
    moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(9, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xe6f0ec })
    );
    moonMesh.position.set(70, 62, -170);
    scene.add(moonMesh);

    // Zemin
    const groundGeo = new THREE.PlaneGeometry(600, 600, 1, 1);
    groundGeo.rotateX(-Math.PI / 2);
    groundMesh = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: T.ground }));
    scene.add(groundMesh);

    // Su
    if (T.hasOcean) {
      // Tessellation ölçülü tutulur: büyük ve yoğun bir düzlem, düşük güçlü
      // cihazlarda dolgu oranını (fill rate) tek başına tüketebilir.
      const wg = new THREE.PlaneGeometry(600, 600, 32, 32);
      wg.rotateX(-Math.PI / 2);
      waterMesh = new THREE.Mesh(wg, makeWaterMaterial());
      waterMesh.position.y = -0.35;
      scene.add(waterMesh);
      // Kum adası
      const island = new THREE.Mesh(
        new THREE.CircleGeometry(34, 40),
        new THREE.MeshLambertMaterial({ color: T.ground })
      );
      island.rotation.x = -Math.PI / 2;
      island.position.y = 0.02;
      scene.add(island);
    } else if (T.hasCreek) {
      const wg = new THREE.PlaneGeometry(14, 600, 6, 90);
      wg.rotateX(-Math.PI / 2);
      waterMesh = new THREE.Mesh(wg, makeWaterMaterial());
      waterMesh.position.set(-11, -0.12, 0);
      scene.add(waterMesh);
    }

    // Orman ve kayalar: tek çizim çağrısında, instanced
    seedInstances();
    buildInstanced();

    // Kulübeler. İlk kulübe kameraya daha yakın başlar: kullanıcı bahçeyi
    // kısa sürede görsün (önceden 60-110 birim ötedeydi, dakikalar alıyordu).
    const cabinSpacing = 55;
    for (let i = 0; i < 3; i++) {
      const c = createCabin(rand(8, 16), -(i * cabinSpacing) - 26);
      scene.add(c);
      cabinPool.push(c);
    }

    // Keşif öğeleri için grup
    discoveryGroup = new THREE.Group();
    scene.add(discoveryGroup);
  }

  function rebuildScene() {
    // Temizle. Sahne çocukları kaldırılırken keşif nesnelerinin geometri ve
    // materyalleri de serbest bırakılır; aksi halde tema değişimlerinde
    // GPU belleği birikir.
    for (let i = 0; i < discoObjects.length; i++) disposeDiscovery(discoObjects[i]);
    while (scene.children.length) scene.remove(scene.children[0]);
    cabinPool.length = 0;
    pineFoliage = null; pineTrunks = null;
    palmTrunks = null; palmFronds = null;
    rockMesh = null;
    discoObjects = [];
    buildWorld();
    applyLights();
  }

  function applyLights() {
    hemiLight = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, 1.15);
    scene.add(hemiLight);
    moonLight = new THREE.DirectionalLight(0xd6e4f2, 1.1);
    moonLight.position.set(0.6, 1.0, -0.7).normalize();
    scene.add(moonLight);
    // Dolgu ışığı: karanlık yüzlerin tamamen siyah olmasını engeller
    const fill = new THREE.DirectionalLight(0x9fb6cc, 0.45);
    fill.position.set(-0.5, 0.4, 0.8).normalize();
    scene.add(fill);
  }

  /* ---------- Geri dönüşüm ---------- */

  // Ağaç ve kayaların geri dönüşümü updateInstances() içinde yapılır
  // (matris güncellemesiyle birlikte). Burada yalnızca kulübeler taşınır.
  function recycle() {
    for (let i = 0; i < cabinPool.length; i++) {
      const c = cabinPool[i];
      if (c.position.z > camZ + RECYCLE_BEHIND) {
        c.position.z = camZ - rand(26, SPREAD + 30);
        c.position.x = rand(8, 16);
      }
    }
  }

  /* ---------- Kulübe görselleri ---------- */

  // Bahçe: dikilen çiçekleri kulübenin yanında göster.
  // Sanctuardaki büyüme değeri (0..1) doğrudan ölçeğe yansır; çiçek
  // olgunlaştıktan sonra sabit kalır, asla küçülmez.
  function syncGarden() {
    if (typeof CalmSanctuary === 'undefined' || !CalmSanctuary) return;

    const flowers = CalmSanctuary.getGarden();
    if (!flowers.length && !gardenSignature) return;

    // Değişiklik yoksa her karede yeniden kurma (pahalı)
    const sig = flowers.map(function (f) { return f.kind + ':' + f.x + ':' + f.y; }).join('|');
    if (sig === gardenSignature) {
      updateGardenGrowth(flowers);
      return;
    }
    gardenSignature = sig;

    for (let i = 0; i < cabinPool.length; i++) {
      const cabin = cabinPool[i];
      const holder = cabin.userData.garden;
      if (!holder) continue;

      // Eski çiçekleri serbest bırak
      while (holder.children.length) {
        const old = holder.children[0];
        holder.remove(old);
        disposeDiscovery(old);
      }

      // Izgara konumlarını sahne koordinatına çevir (6x4 ızgara, 0.7 birim)
      const SPACING = 0.7;
      for (let k = 0; k < flowers.length; k++) {
        const f = flowers[k];
        const gx = (f.x - 2.5) * SPACING;
        const gz = (f.y - 1.5) * SPACING;

        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.025, 0.5, 4),
          new THREE.MeshLambertMaterial({ color: 0x2d5c44 })
        );
        stem.position.set(gx, 0.25, gz);

        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 7, 6),
          new THREE.MeshLambertMaterial({ color: new THREE.Color(f.color) })
        );
        bloom.position.set(gx, 0.55, gz);

        const flower = new THREE.Group();
        flower.add(stem);
        flower.add(bloom);
        flower.userData.bloom = bloom;
        flower.userData.stem = stem;
        holder.add(flower);
      }
    }

    updateGardenGrowth(flowers);
  }

  // Büyüme: ölçek yalnızca artar, asla geri gitmez.
  function updateGardenGrowth(flowers) {
    for (let i = 0; i < cabinPool.length; i++) {
      const holder = cabinPool[i].userData.garden;
      if (!holder) continue;
      for (let k = 0; k < holder.children.length && k < flowers.length; k++) {
        const flower = holder.children[k];
        const growth = Math.max(0, Math.min(1, flowers[k].growth));
        const scale = 0.35 + growth * 0.65;
        flower.scale.setScalar(scale);
        if (flower.userData.bloom) {
          // Tomurcuktan tam açmış çiçeğe
          flower.userData.bloom.scale.setScalar(0.6 + growth * 0.4);
        }
      }
    }
  }

  function updateCabins() {
    syncGarden();
    for (let i = 0; i < cabinPool.length; i++) {
      const c = cabinPool[i];
      const d = c.userData;

      const lit = !!milestones[50];
      if (d.lamp) d.lamp.intensity = lit ? (reducedMotion ? 1.6 : 1.4 + Math.sin(time * 3.1) * 0.25) : 0;
      if (d.window) d.window.material.color.setHex(lit ? 0xf59e0b : 0x1a2a2a);

      if (d.puffs) {
        const on = !!milestones[150];
        for (let k = 0; k < d.puffs.length; k++) {
          const p = d.puffs[k];
          if (!on) { p.material.opacity = 0; continue; }
          const t = reducedMotion ? k / d.puffs.length : ((time / 4.2) + k / d.puffs.length) % 1;
          p.material.opacity = (1 - t) * 0.22;
          p.position.set(
            1.6 + Math.sin(t * 5 + k) * 0.5 + t * 0.7,
            5.6 + t * 2.6,
            -0.4
          );
          p.scale.setScalar(0.7 + t * 1.4);
        }
      }

      if (d.cat) d.cat.visible = !!milestones[300];
    }
  }

  /* ---------- Keşif öğeleri ---------- */

  let discoObjects = [];

  // Bahçe: son kurulan çiçek düzeni imzası. Her karede yeniden kurmayı önler.
  let gardenSignature = '';

  // Keşif nesneleri: her tür için ayırt edilebilir biçim.
  // Önceden hepsi aynı küreydi; kullanıcı "ne geçti?" diye ayırt edemiyordu.
  function makeDiscoveryObject(id) {
    const g = new THREE.Group();
    const basic = (color) => new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });

    if (id === 'butterfly') {
      // İki ince kanat: çırparken ayırt edilir
      const wingGeo = new THREE.PlaneGeometry(0.5, 0.32);
      const wl = new THREE.Mesh(wingGeo, basic(0xf59e0b));
      const wr = new THREE.Mesh(wingGeo, basic(0xf59e0b));
      wl.position.x = -0.24;
      wr.position.x = 0.24;
      g.add(wl);
      g.add(wr);
      g.userData.wingL = wl;
      g.userData.wingR = wr;
      g.userData.kind = 'butterfly';
    } else if (id === 'heron') {
      // Gövde + uzun boyun + bacaklar: su kuşu silueti
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), basic(0xdfeee9));
      body.scale.set(1.5, 0.9, 1);
      g.add(body);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 5), basic(0xdfeee9));
      neck.position.set(0.34, 0.42, 0);
      neck.rotation.z = -0.35;
      g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), basic(0xdfeee9));
      head.position.set(0.5, 0.82, 0);
      g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 4), basic(0xd9c48a));
      beak.position.set(0.68, 0.8, 0);
      beak.rotation.z = -Math.PI / 2;
      g.add(beak);
      const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 4);
      const l1 = new THREE.Mesh(legGeo, basic(0xdfeee9));
      const l2 = new THREE.Mesh(legGeo, basic(0xdfeee9));
      l1.position.set(-0.06, -0.45, 0);
      l2.position.set(0.06, -0.45, 0);
      g.add(l1);
      g.add(l2);
      g.userData.kind = 'heron';
    } else if (id === 'shooting_star') {
      // Uzun bir iz + parlak baş: kayan yıldız
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), basic(0xffffff));
      g.add(head);
      const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.09, 3.4, 5), basic(0xcfe4f2));
      trail.rotation.z = Math.PI / 2;
      trail.position.set(-1.7, 0.35, 0);
      g.add(trail);
      g.userData.kind = 'shooting_star';
    } else {
      // Ateş böceği: küçük gövde, parıltı rengiyle
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), basic(0x10b981));
      g.add(core);
      g.userData.kind = 'firefly';
    }

    g.visible = false;
    discoveryGroup.add(g);
    return g;
  }

  function syncDiscoveries() {
    // Havuzu tür başına yönet: gereken sayıda nesne üret
    while (discoObjects.length < discoveries.length) {
      const d = discoveries[discoObjects.length];
      discoObjects.push(makeDiscoveryObject(d ? d.id : 'firefly'));
    }

    for (let i = 0; i < discoObjects.length; i++) {
      const g = discoObjects[i];
      const d = discoveries[i];
      if (!d) { g.visible = false; continue; }

      // Tür değiştiyse (havuz yeniden kullanımı) yeni biçim kur.
      // Eski geometri ve materyaller serbest bırakılır; aksi halde uzun
      // oturumlarda GPU belleği birikir.
      if (g.userData.kind !== d.id) {
        discoveryGroup.remove(g);
        disposeDiscovery(g);
        const replacement = makeDiscoveryObject(d.id);
        discoObjects[i] = replacement;
        replacement.visible = false;
        continue;
      }

      g.visible = true;
      const p = Math.max(0, Math.min(1, d.progress));
      const fade = Math.min(1, Math.min(p, 1 - p) * 6);

      if (d.id === 'shooting_star') {
        g.position.set(rand(-30, 30), 40 + p * 10, camZ - 120 + p * 40);
        g.rotation.z = -0.25;
        setDiscoveryOpacity(g, fade);
      } else if (d.id === 'butterfly') {
        g.position.set(Math.sin(p * 6) * 5, 1.4 + Math.sin(p * 9) * 0.4, camZ - 14);
        // Kanat çırpma
        const flap = Math.sin(time * 14) * 0.9;
        if (g.userData.wingL) g.userData.wingL.rotation.y = flap;
        if (g.userData.wingR) g.userData.wingR.rotation.y = -flap;
        g.rotation.y = Math.PI / 2;
        setDiscoveryOpacity(g, fade * 0.95);
      } else if (d.id === 'firefly') {
        g.position.set(Math.sin(p * 7) * 8, 1.8 + Math.cos(p * 5) * 0.6, camZ - 20);
        const pulse = 0.7 + Math.sin(time * 3) * 0.3;
        g.scale.setScalar(pulse);
        setDiscoveryOpacity(g, fade * 0.9);
      } else if (d.id === 'heron') {
        // Suya yakın durur, sonra uzaklaşır
        g.position.set(-8 + p * 6, 0.62, camZ - 26);
        g.rotation.y = -0.3;
        setDiscoveryOpacity(g, fade);
      }
    }
  }

  // Bir keşif grubundaki tüm materyallerin opaklığını ayarlar
  function setDiscoveryOpacity(group, value) {
    group.traverse(function (child) {
      if (child.material && 'opacity' in child.material) {
        child.material.transparent = true;
        child.material.opacity = Math.max(0, Math.min(1, value));
      }
    });
  }

  // Keşif nesnesinin geometri ve materyallerini serbest bırakır.
  function disposeDiscovery(group) {
    group.traverse(function (child) {
      if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(function (m) { if (m && typeof m.dispose === 'function') m.dispose(); });
      }
    });
  }

  /* ---------- Ana döngü ---------- */

  function update(dt) {
    time += dt;

    if (typeof CalmWorld !== 'undefined' && CalmWorld) {
      CalmWorld.update(dt);
      world = CalmWorld.get();
    }
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

    // Dönüş (A/D)
    if (turnInput !== 0) {
      yaw -= turnInput * TURN_SPEED * dt;
    }

    let target = 0;
    if (holding) target = speed;
    else if (cruise) target = speed * 0.75;
    // Boşta kayma yalnızca kullanıcı açtıysa ve hareket azaltma kapalıysa
    else if (idle && idleDrift && !reducedMotion) target = speed * IDLE_SPEED_FACTOR;

    currentSpeed += (target - currentSpeed) * Math.min(1, dt * 1.8);
    if (currentSpeed < 0.01) currentSpeed = 0;

    // Nefesle Yürü: yumuşak adım tamponunu tüket (sıçrama yok)
    const glide = consumeGlide(dt);
    if (glide > 0) {
      camZ -= glide;
      if (onAdvance) onAdvance(glide);
    }

    const advance = currentSpeed * dt;
    if (advance > 0) {
      camZ -= advance;
      if (onAdvance) onAdvance(holding || cruise ? advance : advance * IDLE_STEP_FACTOR);
    }

    // Yürüme sarsıntısı: yaw salınımı + dikey bob
    if (!reducedMotion && currentSpeed > 0.5) {
      bobPhase += dt * (2.4 + currentSpeed * 0.16);
    }
    const bobAmp = reducedMotion ? 0 : Math.min(0.09, currentSpeed * 0.004);
    const bobY = Math.sin(bobPhase * 2) * bobAmp;
    const bobRoll = Math.sin(bobPhase) * bobAmp * 0.5;

    camera.position.set(0, EYE + bobY, camZ);
    camera.rotation.set(pitch, yaw, bobRoll, 'YXZ');

    // Ağaç salınımı ve geri dönüşüm tek geçişte: instanced matrisler güncellenir
    updateInstances();

    recycle();
    updateCabins();
    syncDiscoveries();

    // Sis ve ışık nefesle senkron.
    // Sis yoğunluğu düşük tutulur: yüksek yoğunluk gökyüzünü, yıldızları ve
    // ayı da yutuyor ve sahne "boş karanlık" gibi okunuyor.
    const fogDensity = 0.0055 + world.fog * 0.022;
    if (scene.fog) scene.fog.density = fogDensity;
    if (skyMesh && skyMesh.material.uniforms) {
      skyMesh.material.uniforms.moonLight.value = world.moon;
    }
    if (hemiLight) hemiLight.intensity = 0.95 + world.moon * 0.5;
    if (moonLight) moonLight.intensity = 0.7 + world.moon * 0.9;
    if (waterUniforms) {
      waterUniforms.uTime.value = reducedMotion ? 0 : time;
      waterUniforms.uShimmer.value = world.shimmer;
      waterUniforms.uMoon.value = world.moon;
    }
    if (moonMesh) {
      moonMesh.material.color.setRGB(0.82 + world.moon * 0.16, 0.87 + world.moon * 0.12, 0.9 + world.moon * 0.1);
    }
    if (starField) {
      starField.material.opacity = 0.55 + world.moon * 0.45;
      starField.material.transparent = true;
    }
  }

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    trackPerf();
    update(dt);
    renderer.render(scene, camera);
  }

  /* ---------- Uyarlanabilir kalite ---------- */

  // Düşük güçlü cihazlarda kare hızı düşerse çözünürlük kademeli olarak
  // azaltılır. Amaç: sahne akıcı kalsın; görsel kayıp ölçülü olsun.
  // Yazılım (software) WebGL'de bu koruma olmadan deneyim bozulur.
  // Kare sayısı yerine zaman tabanlı pencere kullanılır: 3 fps'de 90 kare
  // beklemek 30 saniye sürer ve koruma çok geç devreye girer.
  // Ölçüm gerçek duvar saatiyle yapılır: ana döngüdeki dt 0.05 sn ile
  // sınırlandığı için onu toplamak düşük kare hızında süreyi yanlış sayar.
  let perfFrames = 0;
  let perfWindowStart = 0;
  let perfStartMs = 0;        // sahnenin başladığı duvar saati
  const PERF_WINDOW = 1.5;    // s
  const PERF_WARMUP_MS = 3000;
  let qualityLevel = 1;       // 1 = tam, 0.75 / 0.5
  const MIN_QUALITY = 0.5;
  let lowStreak = 0;
  let highStreak = 0;

  function trackPerf() {
    const now = performance.now();
    if (perfStartMs === 0) { perfStartMs = now; perfWindowStart = now; return; }

    perfFrames++;
    const elapsed = (now - perfWindowStart) / 1000;
    if (elapsed < PERF_WINDOW) return;

    const fps = perfFrames / elapsed;
    perfFrames = 0;
    perfWindowStart = now;

    // Isınma penceresi (kurulum + ilk gölgelendirici derlemesi) değerlendirilmez
    if (now - perfStartMs < PERF_WARMUP_MS) return;

    // Kararlılık için üst üste iki ölçüm gerekir
    if (fps < 26) { lowStreak++; highStreak = 0; }
    else if (fps > 52) { highStreak++; lowStreak = 0; }
    else { lowStreak = 0; highStreak = 0; }

    if (lowStreak >= 2 && qualityLevel > MIN_QUALITY) {
      qualityLevel = Math.max(MIN_QUALITY, qualityLevel - 0.25);
      lowStreak = 0;
      applyQuality();
    } else if (highStreak >= 4 && qualityLevel < 1) {
      qualityLevel = Math.min(1, qualityLevel + 0.25);
      highStreak = 0;
      applyQuality();
    }
  }

  function applyQuality() {
    if (!renderer) return;
    const base = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(Math.max(0.6, base * qualityLevel));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  /* ---------- Genel arayüz ---------- */

  function resize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const base = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(Math.max(0.6, base * qualityLevel));
    renderer.setSize(w, h, false);
  }

  function start() {
    if (!ok || running) return;
    running = true;
    clock.getDelta(); // birikmiş süreyi sıfırla
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setTheme(next) {
    if (!THEMES[next]) return;
    theme = next;
    T = THEMES[next];
    if (!ok) return;
    scene.fog = new THREE.FogExp2(T.fogColor, 0.02);
    rebuildScene();
    resize();
  }

  function setReducedMotion(value) {
    reducedMotion = !!value;
    if (!ok) return;
    // Instanced matrisler zaten reducedMotion'ı dikkate alır (rüzgar sıfırlanır)
    updateInstances();
    camera.position.y = EYE;
  }

  function setMilestones(list) {
    if (!Array.isArray(list)) return;
    for (let i = 0; i < list.length; i++) milestones[list[i]] = true;
  }

  function unlockMilestone(t) { milestones[t] = true; }

  function notifyInteraction() {
    lastInteraction = time;
    if (idle) {
      idle = false;
      if (onIdleChange) onIdleChange(false);
    }
  }

  function setHolding(v) { holding = !!v; if (holding) notifyInteraction(); }
  function setCruise(v) { cruise = !!v; if (cruise) notifyInteraction(); }
  function setBaseSpeed(v) { speed = Math.max(4, v); }
  function setTurnInput(v) { turnInput = Math.max(-1, Math.min(1, v)); if (v !== 0) notifyInteraction(); }

  // "Nefesle Yürü" için yumuşak adım tamponu (bkz. canvas.js aynı not).
  // Anlık ilerletme tek karede 26 birim atlar ve sıçrama yaratır.
  const GLIDE_RATE = 30;      // birim/s — 26 birim yaklaşık 0.9 sn
  let glideRemaining = 0;

  function stepForward(px) {
    if (!(px > 0)) return;
    glideRemaining += px;
    notifyInteraction();
  }

  function consumeGlide(dt) {
    if (glideRemaining <= 0) return 0;
    const step = Math.min(glideRemaining, GLIDE_RATE * dt);
    glideRemaining -= step;
    return step;
  }

  function setIdleDrift(value) {
    idleDrift = !!value;
  }

  function getCamera() { return -camZ; }        // 2D motoruyla aynı yön/ölçek
  function isIdle() { return idle; }
  function isCruise() { return cruise; }
  function getMetrics() {
    return { W: window.innerWidth, H: window.innerHeight, yaw: yaw, pitch: pitch, z: camZ };
  }

  function attachGlobalListeners() {
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
  }

  let resizeTimer = null;
  function onResize() {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resizeTimer = null; resize(); }, 180);
  }
  function onVisibility() {
    if (document.hidden) pause(); else start();
  }

  function init(el, options) {
    options = options || {};
    canvas = el;
    onAdvance = options.onAdvance || null;
    onIdleChange = options.onIdleChange || null;
    reducedMotion = !!options.reducedMotion;
    if (typeof options.baseSpeed === 'number') speed = options.baseSpeed;
    if (options.theme && THEMES[options.theme]) { theme = options.theme; T = THEMES[options.theme]; }

    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'low-power' });
    } catch (err) {
      return null; // WebGL yok → app.js 2D motora düşer
    }

    renderer.setClearColor(T.skyLow, 1);
    // three.js r155+ ışık şiddetlerini fiziksel birimlere çevirdi; bu yüzden
    // aynı sayısal değerler eski sürümlere göre çok daha karanlık görünür.
    // Sahne gece olduğu için ışığı legacy davranışa alıp pozlamayı yükseltiyoruz.
    if ('useLegacyLights' in renderer) renderer.useLegacyLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(T.fogColor, 0.02);
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.rotation.order = 'YXZ';
    clock = new THREE.Clock();

    buildWorld();
    applyLights();
    resize();

    ok = true;
    lastInteraction = 0;
    time = 0;
    start();
    return api;
  }

  const api = {
    init: init,
    resize: resize,
    start: start,
    pause: pause,
    setTheme: setTheme,
    setReducedMotion: setReducedMotion,
    setMilestones: setMilestones,
    unlockMilestone: unlockMilestone,
    notifyInteraction: notifyInteraction,
    setHolding: setHolding,
    setCruise: setCruise,
    setBaseSpeed: setBaseSpeed,
    setTurnInput: setTurnInput,
    setIdleDrift: setIdleDrift,
    stepForward: stepForward,
    getCamera: getCamera,
    isIdle: isIdle,
    isCruise: isCruise,
    getMetrics: getMetrics,
    attachGlobalListeners: attachGlobalListeners,
    THEMES: THEMES
  };

  return api;
})();

window.CalmScene3D = CalmScene3D;
window.__scene3dReady = true;
