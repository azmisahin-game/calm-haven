# Test Rehberi

Calm Haven'ın testleri **üretim uygulamasına bağımlı değildir.** Test
bağımlılıkları yalnızca geliştirme/CI içindir; GitHub Pages'e npm veya
`node_modules` gönderilmez.

---

## 1. Hızlı başlangıç

```bash
# 1. Statik denetimler (bağımlılık gerekmez, Node.js yeterli)
node tests/static-checks.js

# 2. Tarayıcı testleri (puppeteer-core kurar, sunucuyu başlatır)
bash tests/run-browser.sh

# 3. İkisi birden
npm run test:all
```

---

## 2. Statik denetimler — `tests/static-checks.js`

Bağımlılık yoktur. Yalnızca Node.js'in kendi modüllerini kullanır. 40 denetim
içerir.

| Bölüm | Ne denetler |
|---|---|
| 1. JS sözdizimi | Tüm `js/*.js` + `scene3d.js` ES modülü olarak |
| 2. JSON | Geçerlilik ve şema (id, chance, duration, trigger alanları) |
| 3. Yerel bağlantılar | `index.html`'in başvurduğu her dosya gerçekten var mı |
| 4. Göreceli yollar | `fetch`/`import` baştaki `/` kullanmıyor (Pages alt dizini) |
| 5. Tema tutarlılığı | 3B ve 2B `THEMES` anahtarları aynı; CSS'te kural var |
| 6. Yedek havuz uyumu | `FALLBACK` havuzları JSON kimlikleriyle eşleşiyor |
| 7. Kodlama | Tüm metin dosyaları geçerli UTF-8 (U+FFFD yok) |
| 8. Gizlilik/güvenlik | `document.write` yok, kullanıcı metni `innerHTML`'e yazılmıyor, CDN yok, analitik yok |
| 9. Vendor | Three.js lisans başlığı korunuyor |

Bu denetimler gerçek hatalar buldu:
- `context.js` yedek havuzunda 3 mesaj eksikti.
- Tema anahtarlarının üç yerde senkron kalması gerektiği doğrulandı.

---

## 3. Tarayıcı testleri — `tests/browser.js`

Gerçek Chromium ile 49 test. `tests/run-browser.sh` sunucuyu başlatır,
testleri çalıştırır, sunucuyu kapatır.

### Kapsanan senaryolar

| Bölüm | Kapsam |
|---|---|
| 1. Yükleme | 9 modül yükleniyor, konsol hatası yok |
| 2. Zoom/reflow | %100/%200/%400: taşma yok, kontroller erişilebilir |
| 3. Nefes güvenliği | Durdurma düğmesi, doğal nefes metni, yeniden başlatma |
| 4. Sessiz giriş | Ses kapalı başlama ve tercih kaydı |
| 5. Hareket azaltma | Kamera statik, keşifler duruyor |
| 6. Kalıcılık/XSS | Bahçe kaydı, büyüme, XSS yürütülmüyor, bozuk veri |
| 7. 2B yedek | three.js engellenince 2B devralıyor ve çiziyor |
| 8. Düzen (20 görünüm) | Çakışma, panel sığma, 48 px dokunma alanı, kaydırma |
| 9. Erişilebilirlik | Canlı bölge, dialog, aria-pressed, odak akışı, klavye, kontrast |
| 10. Bozuk storage (11 senaryo) | Bozuk veriyle açılış ve yürüme |
| 11. Sahne kompozisyonu | Gökyüzü görünür, ağaçlar sahneyi kapatmıyor |
| 12. Hareket öngörülebilirliği | Boşta kayma kapalıyken sabit, Nefesle Yürü sıçramıyor |
| 13. Keşif sesleri | Ses fonksiyonları, canPlay koruması, adıyla bildirim |
| 14. Bahçe dünyada | init öncesi güvenli okuma, çekmece, kalıcılık |

**Statik denetimler:** 52 denetim. Bölüm 11, ses fonksiyonlarının `canPlay()` ile
korunmasını, `idleDrift` varsayılanının kapalı olmasını, glide tamponunun her iki
motorda bulunmasını ve panellerin çekmece düzeninde olmasını denetler.

### Önemli test tasarım kararları

**Kontrast ölçümü.** Göz kararı yerine gerçek CSS renkleri okunur ve WCAG
parlaklık formülü uygulanır. Ölçülen değer: **17,9:1** (AA eşiği 4,5:1).

**Zoom simülasyonu.** Görünüm küçültülüp ölçek korunarak %200 ve %400
benzetilir; yatay taşma ve kontrol erişilebilirliği ölçülür.

**2B yedek testi.** `three.module.min.js` ve `scene3d.js` ağ istekleri
engellenir. Gerçek başarısızlık senaryosu budur.

**Bozuk storage matrisi.** 11 veri biçimi (null settings, metin kök değeri,
negatif adım, gelecekteki zaman damgası...) denenir; her birinde uygulama
açılmalı **ve** yürüme çalışmalıdır.

---

## 4. Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `CALM_URL` | `http://localhost:12000/` | Test edilecek adres |
| `CALM_PORT` | `12000` | Yerel sunucu portu |
| `CHROME_PATH` | otomatik bulunur | Chromium yolu |

Canlı siteyi test etmek için:

```bash
CALM_URL=https://azmisahin-game.github.io/calm-haven/ \
  CHROME_PATH=/usr/bin/chromium node tests/browser.js
```

---

## 5. Elle test gerektiren senaryolar

Aşağıdakiler otomatikleştirilemedi; sürüm öncesi elle doğrulanmalıdır:

| Senaryo | Neden otomatik değil | Nasıl test edilir |
|---|---|---|
| Ekran okuyucu akışı | Gerçek AT yazılımı gerekir | NVDA/VoiceOver ile perdeyi geç, nefes başlat, panel aç/kapat |
| iOS Safari jest davranışı | Chromium'da iOS jesti yok | Gerçek iPhone'da iki parmak zoom ve kaydırma dene |
| Ses kalitesi (click/pop) | Kulakla değerlendirilir | Sesi aç/kapat, tema değiştir, sekme değiştir |
| Gerçek GPU kare hızı | Yazılım render ölçümü gerçek GPU'yu yansıtmaz | Gerçek cihazda DevTools → Performance |
| Yüksek kontrast modu | Tarayıcı ayarı gerekir | OS yüksek kontrast açıkken kontrol et |

**Ölçülmeyen değerleri uydurmayız.** Bu depoda yazılım (SwiftShader) WebGL ile
ölçülen kare hızı ~3–5 fps'dir. Bu, GPU'suz CPU rasterizasyonunun sonucudur ve
gerçek cihaz performansını göstermez. Gerçek GPU ölçümü yapılmamıştır.

---

## 6. Yerel önizleme

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Sunucu gerekir çünkü tarayıcılar `file://` üzerinde `fetch` isteklerini
kısıtlar. Yine de uygulama bu durumda çökmez: `FALLBACK` havuzları devreye
girer.

---

## 7. CI

`.github/workflows/deploy.yml` iki iş içerir:

1. **verify** — statik denetimler + tarayıcı testleri
2. **deploy** — yalnızca `verify` başarılıysa çalışır

Yani `main`'e yapılan bir push, testler geçmezse **yayınlanmaz**.
