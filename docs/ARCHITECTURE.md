# Mimari

Bu belge Calm Haven'ın gerçek yapısını anlatır: modüller, önyükleme sırası,
motor yükseltme/yedek akışı ve veri akışı.

**Derleme adımı yoktur.** Üretim deneyimi saf HTML5 + CSS3 + Vanilla ES6+ ve
depoda yerel Three.js ile çalışır. npm yalnızca testler içindir.

---

## 1. Dosya yapısı

```text
calm-haven/
├── index.html                 # Anlamsal iskelet, script sırası
├── css/
│   ├── style.css              # Tasarım token'ları, düzen, bileşenler
│   └── animations.css         # Keyframe'ler, prefers-reduced-motion
├── js/
│   ├── app.js                 # Durum, DOM bağları, giriş yönetimi
│   ├── scene3d.js             # 3B sahne (ES modülü, birincil motor)
│   ├── canvas.js              # 2B sahne (yedek motor)
│   ├── world.js               # Dünya durumu, nefes senkronizasyonu
│   ├── breathing.js           # Nefes zamanlayıcı ve faz motoru
│   ├── audio.js               # Web Audio sentezi
│   ├── messages.js            # Mesaj rotasyonu
│   ├── context.js             # Bağlamsal mesaj seçimi
│   ├── discovery.js           # Keşif motoru
│   └── sanctuary.js           # Bahçe, kabuklar, sal, anı defteri
├── data/
│   ├── messages.json          # 30 mesaj
│   ├── discoveries.json       # 4 keşif
│   └── context-messages.json  # 11 bağlamsal mesaj
├── vendor/
│   └── three.module.min.js    # Three.js r160 (MIT, yerel)
├── tests/                     # Yalnızca geliştirme/CI
├── docs/                      # Bu belgeler
└── .github/workflows/deploy.yml
```

---

## 2. Önyükleme sırası

Klasik `defer` scriptleri belge sırasına göre, DOM hazır olduktan sonra
çalışır. ES modülü ayrı ve asenkron yüklenir.

```text
1.  index.html ayrıştırılır
2.  CSS yüklenir → perde (veil) hemen boyanır (saf HTML/CSS)
3.  defer scriptleri sırayla çalışır:
      messages.js → world.js → discovery.js → context.js →
      sanctuary.js → breathing.js → audio.js → canvas.js → app.js
4.  app.js: boot() çalışır
      a. DOM öğeleri toplanır
      b. loadState() — bozuk veri doğrulamasıyla
      c. CalmAudio.init()
      d. CalmWorld.init()
      e. Engine = CalmForest; Engine.init(...)      ← 2B hemen başlar
      f. setupEngineUpgrade()                       ← 3B'yi yoklar
      g. CalmBreathing.init() + kancalar
      h. CalmMessages.init() / CalmDiscovery.init() / CalmContext.init()
      i. CalmSanctuary.init()
      j. bindEvents(), watchReservedZones()
5.  type="module" scene3d.js yüklenir (paralel)
      → window.__scene3dReady = true
6.  setupEngineUpgrade() bunu görür → promoteTo3D()
```

**Kritik nokta:** Kullanıcı hiçbir an boş ekran görmez. Perde saf HTML/CSS
olduğu için ilk boyama ~550 ms'de gerçekleşir; 655 KB'lık Three.js arka planda
yüklenirken 2B motor zaten çizim yapmaktadır.

---

## 3. Motor yükseltme ve yedek akışı

`app.js` içindeki `Engine` değişkeni **aktif motoru** tutar. Tüm motor çağrıları
`Engine` üzerinden yapılır; doğrudan `CalmForest` veya `CalmScene3D` çağrılmaz.

```text
                      ┌─────────────────────────────┐
   boot() ──────────► │ Engine = CalmForest (2B)     │  hemen çizer
                      └──────────────┬──────────────┘
                                     │ setupEngineUpgrade() 100 ms'de bir yoklar
                                     ▼
                    window.__scene3dReady === true ?
                          │                      │
                        evet                   hayır (6 sn sonra vazgeç)
                          │                      │
                          ▼                      ▼
              ┌───────────────────────┐   ┌──────────────────────┐
              │ promoteTo3D()         │   │ 2B motor devam eder  │
              │ • 2B pause()          │   │ (kullanıcı fark etmez)│
              │ • 2B tuvali gizle     │   └──────────────────────┘
              │ • CalmScene3D.init()  │
              └───────────┬───────────┘
                          │
              init() null döndü mü? (WebGL yok)
                    │                    │
                  evet                 hayır
                    │                    │
                    ▼                    ▼
        ┌──────────────────────┐  ┌──────────────────┐
        │ 2B'ye geri dön       │  │ Engine = 3B      │
        │ __scene3dReady=false │  │ 3B tuvali göster │
        └──────────────────────┘  └──────────────────┘
```

**Yedekleme testi:** `tests/browser.js` bölüm 7, `three.module.min.js` ve
`scene3d.js` isteklerini engelleyip 2B motorun gerçekten çizdiğini ve yürümenin
çalıştığını doğrular.

---

## 4. Modül sözleşmeleri

Tüm modüller IIFE içinde tek bir global yayınlar. `scene3d.js` tek istisnadır:
ES modülüdür ve kendini `window.CalmScene3D` olarak yayınlar.

| Modül | Global | Sorumluluk | Dış bağımlılık |
|---|---|---|---|
| `app.js` | — (IIFE) | Durum, DOM, giriş, motor seçimi | Tümü |
| `scene3d.js` | `CalmScene3D` | 3B çizim, kamera, shader'lar | `three` (vendor) |
| `canvas.js` | `CalmForest` | 2B çizim | — |
| `world.js` | `CalmWorld` | Sis/ay/parıltı hedef değerleri | — |
| `breathing.js` | `CalmBreathing` | Faz zamanlaması | — |
| `audio.js` | `CalmAudio` | Ses sentezi | Web Audio API |
| `messages.js` | `CalmMessages` | Mesaj rotasyonu | `data/messages.json` |
| `context.js` | `CalmContext` | Bağlamsal mesaj seçimi | `data/context-messages.json` |
| `discovery.js` | `CalmDiscovery` | Keşif tetikleme | `data/discoveries.json` |
| `sanctuary.js` | `CalmSanctuary` | Bahçe/kabuk/sal/defter | `localStorage` |

Her modülün ortak yüzeyi: `init(öğeler, seçenekler)`, `start()`, `stop()`,
`setReducedMotion(bool)`. Modüller birbirini **doğrudan çağırmaz**; `app.js`
kanca (callback) ile bağlar.

---

## 5. Motor arayüzü (Engine sözleşmesi)

Her iki motor da aynı yüzeyi sunar. Yeni motor eklerken bu sözleşmeye uyulmalı.

```text
init(tuval, seçenekler) → api | null      (null = bu motor kullanılamaz)
start() / pause()
setHolding(bool)          tıklama/Space basılı
setCruise(bool)           otomatik gezinti
setBaseSpeed(px/s)
setTurnInput(-1|0|1)      yalnızca 3B; 2B'de yok sayılır
stepForward(px)           Nefesle Yürü adımı
setTheme('forest'|'island')
setMilestones([...]) / unlockMilestone(n)
setReducedMotion(bool)
notifyInteraction()
getCamera() → px          ilerleme (2B px, 3B -camZ)
getMetrics() → { ... }    yalnızca 3B; yaw dahil
isIdle() / isCruise()
attachGlobalListeners()
```

---

## 6. Tek animasyon döngüsü kuralı

Her motorun kendi `requestAnimationFrame` döngüsü vardır ama **aynı anda
yalnızca biri çalışır.** `promoteTo3D()` önce 2B motoru `pause()` eder.

Yeni bir zaman tabanlı sistem eklerken **ayrı bir rAF açmayın.** Aktif motorun
döngüsünden besleyin:

```javascript
function update(dt) {
  time += dt;
  CalmWorld.update(dt);          // dünya değerlerini ilerlet
  world = CalmWorld.get();       // sonra oku
  CalmDiscovery.update(dt);      // keşifleri ilerlet
  discoveries = CalmDiscovery.getActive();
  // ... hareket, geri dönüşüm, çizim
}
```

**Not:** `CalmWorld.update(dt)` çağrılmazsa sis/ay/parıltı hedefe hiç yaklaşmaz
ve dünya donuk kalır. Bu hata bir kez yapıldı; `tests/browser.js` artık
dünya değerlerinin gerçekten değiştiğini ölçer.

---

## 7. Hareket modeli

Kamera hareketinin dört kaynağı vardır ve hepsi tek bir yerde, motorun
`update(dt)` döngüsünde birleşir:

| Kaynak | Nasıl çalışır | Varsayılan |
|---|---|---|
| Kullanıcı girdisi | `holding` (tıklama/`Space`/`W`) → `baseSpeed` | Etkin |
| Otomatik gezinti | `cruise` → `baseSpeed * 0.75` | Kapalı (düğme) |
| Boşta kayma | `idle && idleDrift` → `baseSpeed * 0.25` | **Kapalı** (ayar) |
| Nefesle Yürü | `glideRemaining` tamponu → `GLIDE_RATE` | Kapalı (ayar) |

**Boşta kayma kuralı:** 10 saniye etkileşimsizlikten sonra kamera kendiliğinden
kaymaya başlarsa kullanıcı bunu "habersiz hareket" olarak yaşar. Bu yüzden
`idleDrift` varsayılan olarak **kapalıdır** ve yalnızca Ayarlar'dan açılır.
`prefers-reduced-motion` açıkken her durumda kapalı kalır.

**Nefesle Yürü kuralı:** `stepForward(px)` kamerayı **anında** ilerletmez.
Mesafe bir tampona (`glideRemaining`) eklenir ve `update(dt)` içinde
`consumeGlide(dt)` ile sabit oranda tüketilir. Anlık ilerletme tek karede
26 px atlar ve görünür bir sıçrama yaratır (normal hız 22 px/s); yumuşak tampon
bunu ~1 saniyeye yayar. Her iki motor da aynı deseni kullanır.

---

## 8. Zaman ölçümü tuzağı

Ana döngüdeki `dt` **0.05 sn ile sınırlandırılır** (`Math.min(dt, 0.05)`). Bu,
sekme arka plandan döndüğünde simülasyonun sıçramasını engeller.

**Sonuç:** Geçen süreyi `dt` toplayarak ölçmeyin. Düşük kare hızında `dt`
sınırlandığı için toplam süre gerçek zamandan çok küçük çıkar. Performans
ölçümü `performance.now()` ile yapılır (`scene3d.js` içindeki `trackPerf`).
Bu hata bir kez yapıldı ve uyarlanabilir kalite korumasının hiç devreye
girmemesine yol açtı.

---

## 9. Veri akışı

```text
Nefes motoru (breathing.js)
   │  onProgress(faz, ilerleme) / onSighStep(i)
   ▼
app.js kancaları
   │
   ▼
CalmWorld (world.js)
   │  hedef değerler: fog, moon, shimmer, leaf, mist
   │  update(dt) ile yumuşatılır
   ▼
Aktif motor (scene3d.js veya canvas.js)
   │  her karede get() ile okur
   ▼
Görsel: sis yoğunluğu, ay parlaklığı, su parıltısı, ağaç salınımı
```

İlerleme akışı:

```text
Motor hareketi → onAdvance(px) → app.accumulate(px)
                                    │
                                    ├─ adım birikimi → state.steps
                                    ├─ kilometre taşı → CalmForest/Scene3D.unlockMilestone()
                                    └─ HUD güncellemesi
```

---

## 10. Kalıcılık

İki bağımsız `localStorage` anahtarı:

| Anahtar | Modül | İçerik |
|---|---|---|
| `calm_haven_data_v1` | `app.js` | Adımlar, süre, gelişmeler, ayarlar |
| `calm_haven_sanctuary_v1` | `sanctuary.js` | Bahçe, kabuklar, sal, anı defteri |

Her iki modül de okuma sırasında **tam doğrulama** yapar: kök nesne denetimi,
alan türü denetimi, aralık sınırlama, geçersiz kayıt ayıklama. Bozuk veri
uygulamayı çökertmez ve geçerli kayıtlar korunur.

Ayrıntılar ve sınırlamalar: [PRIVACY.md](PRIVACY.md)

---

## 11. Hata davranışı

| Senaryo | Davranış |
|---|---|
| WebGL yok | 2B motor devam eder, kullanıcı fark etmez |
| three.js yüklenemedi | 2B motor devam eder |
| JSON yüklenemedi (`file://`) | Gömülü `FALLBACK` havuzu devreye girer |
| `localStorage` kapalı/kota dolu | Sessizce devam, oturumla sınırlı |
| Bozuk `localStorage` verisi | Doğrulama ayıklar, uygulama açılır |
| Sekme arka plana alındı | Motor `pause()`, ses askıya alınır |
| Sekme geri geldi | Motor `start()`, ses `resume()` |

Hiçbir senaryoda kullanıcıya teknik stack trace gösterilmez. Hatalar konsola
yazılır; arayüz sakin kalır.
