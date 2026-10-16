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
  `CalmBreathing`, `CalmAudio`, `CalmMessages` global nesnelerini üretir.
  `index.html` içinde sırasıyla `defer` ile yüklenir; `app.js` en son çalışır.
- **`parallax` alanı kritiktir.** `canvas.js` içindeki `recycle()` nesneleri
  `it.parallax` ile konumlandırır. Bir katmana yeni nesne türü eklerken
  `parallax` tanımlamayı unutmak `NaN` üretir ve katman geri dönüştürülmez.
  Çizimde kullanılan çarpan ile `parallax` değeri **aynı olmalıdır**.
- **Mesaj havuzu yedeği.** `messages.js`, `./data/messages.json` erişilemezse
  (ör. `file://`) gömülü `FALLBACK` havuzuna düşer. İki havuzu birlikte güncelle.
- **Nefes motoru zamanlaması.** `breathing.js` içinde faz geçişleri tek bir
  `tick()` noktasından yönetilir. Yeni bir faz eklerken `pause()`/`resume()`
  yolunun kalan süreyi (`remaining`) doğru ele aldığından emin ol.
- **Ses kilidi.** `AudioContext` başlangıçta `suspended`; `CalmAudio.unlock()`
  ilk kullanıcı etkileşiminde çağrılır. Ses her zaman `gain` ramp'ı ile
  yumuşak açılır/kapanır.

## Erişilebilirlik

- `prefers-reduced-motion` üç yerde birden uygulanır: `canvas.js`,
  `breathing.js`, `messages.js` ve `animations.css`.
- Etkileşimli her öğe en az 48×48 px ve `aria-label` taşır.
