# AGENTS.md — Calm Haven / Sakin Sığınak

## Proje özeti

Derleme adımı olmayan (zero-build) saf HTML5 + CSS3 + Vanilla ES6+ uygulaması.
GitHub Pages'te `/calm-haven/` alt dizininde yayınlanır.

## Değişmez kurallar

Bu kurallar ürünün özüdür; katkılarda ihlal edilmemelidir.

- **Sıfır ceza.** Skor, geri sayım, kayıp, ölme, solan bitki yok.
- **Zero-asset.** Harici `.mp3` veya görsel dosyası eklenmez. Ses **Web Audio API**
  ile sentezlenir, görseller **Canvas**/`CSS` ile çizilir.
- **Göreceli yollar.** Alt dizinde yayınlandığı için her zaman `./css/...`,
  `./data/...` kullanılır. Baştaki `/` kullanılmaz.
- **Türkçe arayüz.** Kullanıcıya görünen tüm metin Türkçedir.

## Komutlar

```bash
# Yerel önizleme (fetch için file:// yerine sunucu gerekir)
python3 -m http.server 8000

# Sözdizimi denetimi
for f in js/*.js; do node --check "$f"; done
python3 -m json.tool data/messages.json > /dev/null
```

## Mimari notları

- **Global modüller.** `js/*.js` dosyaları IIFE içinde `CalmForest`,
  `CalmWorld`, `CalmBreathing`, `CalmAudio`, `CalmMessages`, `CalmDiscovery`
  global nesnelerini üretir. `index.html` içinde sırasıyla `defer` ile yüklenir;
  `app.js` en son çalışır.
- **Tek animasyon döngüsü.** `canvas.js` içindeki `loop()` tek `requestAnimationFrame`
  kaynağıdır. `CalmWorld.update(dt)` ve `CalmDiscovery.update(dt)` bu döngüden
  çağrılır. Yeni bir zaman tabanlı sistem eklerken **ayrı bir rAF açmayın**;
  buradan besleyin. `CalmWorld.update()` çağrılmazsa sis/ay/parıltı hedefe
  yaklaşmaz ve dünya donuk kalır (bir kez bu hata yapıldı).
- **`parallax` alanı kritiktir.** `recycle()` nesneleri `it.parallax` ile
  konumlandırır. Yeni katman nesnesi eklerken `parallax` tanımlamayı unutmak
  `NaN` üretir ve katman geri dönüştürülmez. Çizimde kullanılan çarpan ile
  `parallax` değeri **aynı olmalıdır**.
- **Nefes → dünya akışı.** `breathing.js` `onProgress(phase, progress)` ve
  `onSighStep(i)` kancalarını yayar; `app.js` bunları `CalmWorld`'e bağlar.
  `CalmWorld` yalnızca hedef değer tutar, `update(dt)` yumuşatır, `canvas.js`
  her karede `get()` ile okur.
- **Nefesle yürü.** `CalmBreathing.onExhaleEnd(cb)` her veriş bitiminde
  `app.js`'teki `onExhaleStep()`'i tetikler; adım `CalmForest.stepForward(px)`
  ile atılır.
- **Mesaj ve keşif yedekleri.** `messages.js` ve `discovery.js`, `fetch`
  başarısız olursa (ör. `file://`) gömülü `FALLBACK` havuzuna düşer. JSON ve
  yedek havuzu **birlikte** güncelleyin.
- **Nefes motoru zamanlaması.** Faz geçişleri tek bir `tick()` noktasından
  yönetilir. Yeni faz eklerken `pause()`/`resume()` yolunun kalan süreyi
  (`remaining`) doğru ele aldığından emin olun.
- **Ses kilidi.** `AudioContext` başlangıçta `suspended`; `CalmAudio.unlock()`
  ilk kullanıcı etkileşiminde çağrılır. Ses her zaman `gain` ramp'ı ile
  yumuşak açılır/kapanır. Kısa olay sesleri (`footstep`, `rustle`, `chirp`)
  `canPlay()` ile korunur ve `level` ile ölçeklenir.
- **Temalar.** Renk paletleri `canvas.js` içindeki `THEMES` nesnesindedir;
  `THEMES.island` için CSS tarafında `html[data-theme="island"]` değişkenleri
  vardır. Yeni tema eklerken iki tarafı da güncelleyin.

## Erişilebilirlik

- `prefers-reduced-motion` **altı** yerde birden uygulanır: `canvas.js`,
  `world.js`, `discovery.js`, `breathing.js`, `messages.js` ve `animations.css`.
  Bu tercihte sahne **tamamen statiktir** (ölçülen piksel değişimi %0), keşifler
  durur ve dünya nefesle dalgalanmaz.
- Etkileşimli her öğe en az 48×48 px ve `aria-label` taşır.
- Sabit üst bar ve HUD yükseklikleri ölçülür (`syncReservedZones`), tahmin
  edilmez; mesaj kartı sahne ızgarasının ikinci satırındadır.
