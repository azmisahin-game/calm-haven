# 🌿 Calm Haven / Sakin Sığınak

**Bilgi işlem ortamlarında tükenmişlik, boyun/baş ağrısı ve panik atak yaşayan
insanlar için tasarlanmış, nörobiyolojik tabanlı bir "Dijital Sığınak".**

Burada skor yok, zaman kısıtı yok, envanter kaybı yok, ölüm yok, solan bitki yok.
Bu bir oyun değil. Burası nefes alabildiğin bir alan.

**Canlı Yayın:** https://azmisahin-game.github.io/calm-haven/

---

## Neden var?

Personelsiz, sürekli telefon ve bildirim baskısı olan bir masada çalışmak sinir
sistemini sürekli "tehlike" modunda tutar. Kalp hızı yükselir, nefes yüzeyselleşir,
omuzlar kulaklara doğru çekilir. Sakin Sığınak bu döngüyü kırmak için üç kanıta
dayalı aracı tek bir ekranda birleştirir.

### Bilimsel dayanaklar

| Mekanizma | Kaynak | Uygulamadaki yeri |
|---|---|---|
| Fizyolojik İçe Çekiş (Cyclic Sighing) | Balban, Spiegel, Huberman vd., *Cell Reports Medicine*, Ocak 2023 | "Sakinleş" butonu / `P` tuşu |
| Rezonans Frekansı (4 sn Al / 6 sn Ver) | HRV araştırmaları, vagal frenleme | Varsayılan nefes ritmi |
| Dikkat Yenileme Teorisi (ART) | Kaplan & Kaplan, 1989/1995 | Yumuşak büyülenme sağlayan fraktal orman hareketi |
| Kahverengi Gürültü (Brown Noise) | 1/f² spektral yoğunluk | Ofis gürültüsünü maskeleyen prosedürel ses |

---

## Öne çıkan ilkeler

- **Sıfır ceza, sıfır kayıp.** Hiçbir şey elinden alınmaz, geri sayım yoktur.
- **Çabasız faillik.** Tıklama, `Space` basılı tutma ya da
  **"Kendi Akışına Bırak"** otomatik gezinti ile tekrarlayan zorlanma (RSI) yaratmaz.
- **Zero-Asset Failure.** Harici `.mp3` veya görsel yoktur. Sesler **Web Audio API**
  ile sentezlenir, görseller saf **Canvas** ve **CSS** ile çizilir.
- **Tamamen Türkçe.** Arayüz, mesajlar ve nefes rehberi.

---

## Kurulum

Derleme adımı yoktur. `npm install`, `build`, `vite` gerekmez.

```bash
git clone https://github.com/azmisahin-game/calm-haven.git
cd calm-haven
```

Ardından `index.html` dosyasını tarayıcıda aç. En sağlıklı deneyim için yerel bir
sunucu kullan (tarayıcılar `file://` üzerinde `fetch` isteklerini kısıtlar;
uygulama bu durumda gömülü mesaj havuzuna düşer ve yine çalışır):

```bash
python3 -m http.server 8000
# http://localhost:8000
```

---

## Kontroller

| Eylem | Kontrol |
|---|---|
| Yürümek / adım atmak | Ekrana tıklama **veya** `Space` basılı tutma |
| Otomatik gezinti | Üst bardaki **"Kendi Akışına Bırak"** (veya `C`) |
| Fizyolojik içe çekiş | **"Sakinleş"** butonu **veya** `P` |
| Sesi aç / kapat | `M` **veya** üst bardaki ses düğmesi |
| Ayarlar | `Esc` |

Tüm düğmeler en az 48×48 piksel dokunma alanına sahiptir.

---

## Ada ve kulübe

Yürüdükçe "Sakinlik Adımı" birikir (her 10 pikselde 1 adım; otomatik gezintide
dakikada ~2 adım). İlerleme `localStorage` içinde `calm_haven_data_v1` anahtarıyla
saklanır. Kilometre taşları kulübeyi güzelleştirir:

| Adım | Gelişme |
|---|---|
| 50 | Verandada sıcak amber fener yanar |
| 150 | Bacadan minik dumanlar tüter |
| 300 | Verandaya kıvrılıp uyuyan bir kedi gelir |
| 500 | Ağaçların arasında ateş böcekleri uçuşur |

---

## Dosya yapısı

```text
calm-haven/
├── .github/workflows/deploy.yml   # GitHub Pages otomatik dağıtım
├── .nojekyll                      # Jekyll işlemesini devre dışı bırakır
├── index.html                     # Erişilebilir semantic HTML5 iskeleti
├── css/
│   ├── style.css                  # Koyu tema, değişkenler, tipografi
│   └── animations.css             # Nefes ve doğa keyframe'leri
├── js/
│   ├── app.js                     # Durum, LocalStorage, klavye/dokunma
│   ├── canvas.js                  # Sonsuz orman/ada yürüyüşü
│   ├── audio.js                   # Web Audio: brown noise & yağmur
│   ├── breathing.js               # Rezonans & fizyolojik içe çekiş
│   └── messages.js                # Şefkatli mesaj çekici
├── data/messages.json             # Somatik farkındalık mesajları (Türkçe)
├── README.md
└── LICENSE
```

> **Yol kuralı:** Depo `/calm-haven/` alt dizininde yayınlandığı için tüm dosya
> yolları görecelidir (`./css/style.css`, `./data/messages.json`).

---

## Erişilebilirlik ve performans

- Anlamsal HTML5 etiketleri (`<main>`, `<section>`, `<nav>`, `<button>`) ve her
  etkileşimli öğede `aria-label`.
- `prefers-reduced-motion` desteklenir: hareket azaltma tercihinde nefes halkası
  animasyonları ve ağaç salınımı devre dışı kalır.
- Hedefler: boşta CPU < %5, bellek < 60 MB, `devicePixelRatio` ile retina uyumlu
  Canvas çizimi.

---

## GitHub Pages

Depo ayarlarında **Settings → Pages → Build and deployment → Source** kısmı
**"GitHub Actions"** olarak seçilmelidir. `main` dalına yapılan her push,
`.github/workflows/deploy.yml` iş akışını tetikler.

---

## Katkı

1. Fork'la.
2. Anlamlı bir dal adıyla kendi dalını aç: `git checkout -b nefes-ritmi-ekle`.
3. Değişikliğini yap ve tarayıcıda test et.
4. Pull request aç; neyi neden değiştirdiğini kısaca anlat.

Katkılarda şu kuralı koruyoruz: **hiçbir cezalandırıcı mekanizma eklenmez.**
Skor, geri sayım, kayıp veya başarısızlık hissi doğuran hiçbir özellik kabul edilmez.

### Davranış Kuralları

Bu proje [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)
sürüm 2.1 davranış kurallarına uyar. Katılım, saygılı ve kapsayıcı bir ortamı
koruma sözünü içerir.

---

## Lisans

[MIT](LICENSE) © azmisahin-game

Bu uygulama tıbbi tedavi veya profesyonel yardım yerine geçmez. Kendine zarar verme
düşüncesi veya sürekli panik yaşıyorsan lütfen bir uzmandan destek al.

