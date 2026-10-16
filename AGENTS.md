# AGENTS.md — Calm Haven / Sakin Sığınak

## Proje özeti

Derleme adımı olmayan (zero-build) saf HTML5 + CSS3 + Vanilla ES6+ uygulaması.
GitHub Pages'te `/calm-haven/` alt dizininde yayınlanır.

## Değişmez kurallar

Bu kurallar ürünün özüdür; katkılarda ihlal edilmemelidir.

- **Sıfır ceza.** Skor, geri sayım, kayıp, ölme, solan bitki yok.
  Çiçekler solmaz, deniz kabukları eksilmez, ilerleme geri gitmez.
- **Zero-asset (medya).** Harici `.mp3` veya görsel dosyası eklenmez. Ses
  **Web Audio API** ile sentezlenir, görseller **Canvas**/`CSS`/`WebGL` ile
  üretilir.
- **Kütüphane kuralı.** Tek istisna `vendor/three.module.min.js` (Three.js,
  MIT) dosyasıdır. **CDN'e bağlanmak yasaktır**: kütüphane depoda yerel durur,
  böylece çevrimdışı da çalışır ve derleme adımı gerekmez. Yeni bir kütüphane
  gerekiyorsa aynı şekilde `vendor/` altına konur.
- **Yedekli çalışma.** 3B yüklenemezse (WebGL yok, three.js gelmedi) `canvas.js`
  2B motoru devralır. Hiçbir koşulda boş ekran olmaz.
- **Göreceli yollar.** Alt dizinde yayınlandığı için her zaman `./css/...`,
  `./data/...` kullanılır. Baştaki `/` kullanılmaz.
- **Türkçe arayüz.** Kullanıcıya görünen tüm metin Türkçedir.
- **Gizlilik.** Kişisel sağlık verisi toplanmaz. Anı defteri dahil her şey
  cihazda (localStorage) kalır; sunucu, analitik ve paylaşım yoktur.

## Komutlar

```bash
# Yerel önizleme (fetch için file:// yerine sunucu gerekir)
python3 -m http.server 8000

# Sözdizimi denetimi
for f in js/*.js; do node --check "$f"; done
python3 -m json.tool data/messages.json > /dev/null
```

## Mimari notları

- **İki görsel motor.** `scene3d.js` (Three.js, ES modülü) birincildir;
  `canvas.js` (2B) yedektir. `app.js` içindeki `Engine` değişkeni hangisinin
  aktif olduğunu tutar. Yeni bir motor çağrısı eklerken **her zaman `Engine`
  üzerinden** çağırın, doğrudan `CalmForest` veya `CalmScene3D` yazmayın.
- **3B yükseltme akışı.** `setupEngineUpgrade()` `window.__scene3dReady`
  bayrağını yoklar; hazır olunca `promoteTo3D()` 2B motoru duraklatır, 2B
  tuvali gizler ve 3B'yi başlatır. `CalmScene3D.init()` `null` dönerse
  (WebGL bağlamı yok) 2B'ye geri dönülür.
- **Global modüller.** `js/*.js` dosyaları IIFE içinde `CalmForest`,
  `CalmWorld`, `CalmBreathing`, `CalmAudio`, `CalmMessages`, `CalmDiscovery`,
  `CalmContext`, `CalmSanctuary` global nesnelerini üretir. `scene3d.js` bir
  ES modülüdür ve `window.CalmScene3D` olarak kendini yayınlar.
- **Tek animasyon döngüsü.** Her motorun kendi `loop()`'u vardır; aynı anda
  yalnızca biri çalışır. `CalmWorld.update(dt)` ve `CalmDiscovery.update(dt)`
  aktif motorun döngüsünden çağrılır. **Ayrı bir `requestAnimationFrame`
  açmayın.**
- **`parallax` alanı (2B).** `canvas.js` içindeki `recycle()` nesneleri
  `it.parallax` ile konumlandırır. Eksik `parallax` `NaN` üretir ve katman geri
  dönüştürülmez. Çizimdeki çarpan ile `parallax` **aynı olmalıdır**.
- **InstancedMesh (3B).** Ağaçlar/kayalar `instanceData` dizisiyle yönetilir ve
  `updateInstances()` içinde hem geri dönüştürülür hem matrisleri güncellenir.
  Yeni bir örnek türü eklerken `seedInstances()`, `buildInstanced()` ve
  `updateInstances()` üçlüsünü birlikte güncelleyin.
- **Ölçü birimleri (3B).** Ana döngüdeki `dt` 0.05 sn ile sınırlıdır. Bu yüzden
  **geçen süreyi `dt` toplayarak ölçmeyin**; kare hızı düşükken yanlış çıkar.
  Performans ölçümü `performance.now()` ile yapılır (`trackPerf`).
- **Nefes → dünya akışı.** `breathing.js` `onProgress(phase, progress)` ve
  `onSighStep(i)` kancalarını yayar; `app.js` bunları `CalmWorld`'e bağlar.
- **Bağlamsal mesajlar.** `context.js` bölge/keşif/nefes/dwell tetikleyicileriyle
  mesaj seçer; görünürken `CalmMessages.stop()` ile rotasyon duraklar,
  `onRestore` ile yeniden başlar. Yeni tetikleyici eklerken `contextTick()`
  içinden besleyin.
- **Sığınak.** `sanctuary.js` kendi `localStorage` anahtarını
  (`calm_haven_sanctuary_v1`) kullanır. Çiçek büyümesi `plantedAt` zaman
  damgasından hesaplanır ve **asla geri gitmez**.
- **JSON yedekleri.** `messages.js`, `discovery.js`, `context.js` `fetch`
  başarısız olursa (ör. `file://`) gömülü `FALLBACK` havuzuna düşer. JSON ve
  yedek havuzu **birlikte** güncelleyin.
- **Ses kilidi.** `AudioContext` başlangıçta `suspended`; `CalmAudio.unlock()`
  ilk kullanıcı etkileşiminde çağrılır. Kısa olay sesleri (`footstep`,
  `rustle`, `chirp`) `canPlay()` ile korunur ve `level` ile ölçeklenir.
- **Temalar.** 3B paletleri `scene3d.js` içindeki `THEMES`, 2B paletleri
  `canvas.js` içindeki `THEMES` nesnesindedir; ayrıca CSS tarafında
  `html[data-theme="island"]` değişkenleri vardır. Yeni tema eklerken üçünü
  de güncelleyin.

## Erişilebilirlik

- `prefers-reduced-motion` **her motorda** uygulanır: ağaç salınımı, duman,
  su parıltısı, keşifler ve **boşta kamera kayması** kapanır; nefesle dünya
  dalgalanması durur. Bu tercihte sahne tamamen statiktir.
- Etkileşimli her öğe en az 48×48 px ve `aria-label` taşır.
- Sabit üst bar ve HUD yükseklikleri ölçülür (`syncReservedZones`), tahmin
  edilmez; mesaj kartı sahne ızgarasının ikinci satırındadır.
- Ortalanmış paneller `panel-center-in` keyframe'ini kullanır. `panel-in`
  kullanmak `translate(-50%, -50%)` ortalamasını ezer ve paneli kaydırır.
