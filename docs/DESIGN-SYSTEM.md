# Tasarım Sistemi

Calm Haven'ın görsel dili: sinematik, yumuşak, derinlikli, el işçiliği hissi
veren stilize bir doğa dioraması. Amaç **görsel olarak zengin ama zihinsel yük
oluşturmayan** bir yüzey.

---

## 1. Tasarım ilkeleri

1. **Okunabilirlik sahnenin önünde gelir.** Metin her zaman okunur olmalı;
   hiçbir efekt bunu bozamaz.
2. **Az ama tutarlı.** Her nesneye glow, her yüzeye blur eklenmez. Işık ve
   kontrast anlamlı yerlerde kullanılır.
3. **Hareket yavaş ve organik.** Rastgele büyük sıçrama, hızlı parlama, ekran
   flaşı ve sürekli kamera sarsıntısı yok.
4. **İki ortam, iki atmosfer.** Orman ve ada yalnızca renk değiştirmez;
   kompozisyon, geometri ve ışık karakteri de değişir.
5. **Sakinlik bir özelliktir.** Gösterge panosu, ilerleme çubuğu veya rekabet
   hissi veren hiçbir öğe birincil katmana konmaz.

---

## 2. Renk token'ları

Tema renkleri **üç yerde** tanımlıdır ve senkron kalmalıdır:

| Yer | Dosya | Kapsam |
|---|---|---|
| CSS değişkenleri | `css/style.css` `:root` ve `html[data-theme="island"]` | Arayüz (metin, cam, kenarlık) |
| 3B paleti | `js/scene3d.js` `THEMES` | Gökyüzü, zemin, ağaç, su, kulübe |
| 2B paleti | `js/canvas.js` `THEMES` | Aynı öğelerin 2B karşılıkları |

`tests/static-checks.js` bölüm 5, tema anahtarlarının 3B ve 2B'de aynı olduğunu
ve CSS'te karşılık gelen kuralın bulunduğunu denetler. Yeni tema eklerken üçünü
de güncelleyin.

### 2.1 Arayüz token'ları

```css
--night-blue:   #0f172a   /* gece mavisi ana zemin */
--night-deep:   #070d1c   /* en koyu zemin */
--forest-emerald:#062c22  /* orman zümrüdü */
--island-green: #10b981   /* ada yeşili — birincil vurgu */
--lantern-amber:#f59e0b   /* fener amberi — ikincil vurgu */
--ink:          #e8f1ee   /* ana metin */
--mist:         rgba(226,240,235,0.72)  /* ikincil metin */
--mist-dim:     rgba(226,240,235,0.45)  /* üçüncül metin */

--glass-bg:     rgba(9,20,32,0.55)
--glass-brd:    rgba(226,240,235,0.12)
--glass-shadow: 0 18px 48px rgba(0,0,0,0.45)
```

Ada teması `html[data-theme="island"]` altında bu değerleri sıcak tonlara
kaydırır (mor-pembe-amber). Geçiş 1200 ms yumuşak geçişle yapılır.

### 2.2 Kontrast

Ölçülen değerler (WCAG parlaklık formülü, `tests/browser.js` bölüm 9):

| Öğe | Oran | Eşik |
|---|---|---|
| `.message-text` | 17,9:1 | 4,5:1 (AA) |
| `.hud-item dt` | 17,9:1 | 4,5:1 |
| `.breath-text` | 17,9:1 | 4,5:1 |
| `.settings-label` | 17,9:1 | 4,5:1 |

Renk tek başına anlam taşımaz: seçili durumlar `aria-pressed` ve kenarlık/arka
plan değişimiyle birlikte belirtilir.

---

## 3. Tipografi

```css
--font: "Avenir Next", "Segoe UI", system-ui, -apple-system,
        "Helvetica Neue", sans-serif;
```

Sistem yazı tipleri kullanılır; **uzak font yüklenmez** (zero-asset ilkesi).

| Rol | Boyut | Ağırlık | Not |
|---|---|---|---|
| Marka | 1rem | 600 | Büyük harf, 0,08em aralık |
| Nefes metni | clamp(0.95–1.15rem) | normal | Büyük harf, 0,14em aralık |
| Mesaj | clamp(0.92–1.05rem) | normal | Orta hizalı |
| Panel başlığı | 0.82rem | normal | Büyük harf, 0,2em aralık |
| Gövde | 0.78–0.85rem | normal | — |
| HUD etiketi | 0.66rem | normal | Büyük harf, 0,18em aralık |
| Yardımcı not | 0.72–0.74rem | normal | `--mist-dim` |

Kısa ekranlarda (`max-height: 560px`) nefes metni 0,76rem'e, mesaj 0,76rem'e
iner; dokunma alanları **48 px'in altına inmez**.

---

## 4. Aralık ve yüzey

| Token | Değer | Kullanım |
|---|---|---|
| `--radius` | 18px | Paneller, mesaj kartı |
| `--radius-sm` | 12px | Küçük yüzeyler, girdi |
| `--touch` | 48px | Tüm etkileşimli öğelerin en küçük boyutu |
| `--gap` | 12px | Genel boşluk |
| `--header-h` / `--hud-h` | ölçülür | Sahnenin ayrılmış bölgeleri |

**Ölçülen bölgeler:** Üst bar ve HUD yükseklikleri dar ekranda satır atlayıp
büyür (üst bar 134 px'e kadar). Bu yüzden **tahmin edilmez**;
`syncReservedZones()` gerçek yüksekliği ölçüp CSS değişkenine yazar ve
`ResizeObserver` ile günceller.

Sahne ızgarası iki satırlıdır: nefes alanı (esnek) + mesaj kartı (sabit).
Bu yapı sayesinde mesaj kartının üst bar veya HUD ile çakışması **yapısal
olarak imkânsızdır**.

---

## 5. Katmanlama (z-index)

| Katman | z-index | Öğe |
|---|---|---|
| Sahne | 0 | `#scene-canvas`, `#forest-canvas` |
| Nefes ve mesaj | 10–18 | `.stage`, `.message-card` |
| Üst bar / HUD | 20 | `.top-bar`, `.hud` |
| Bildirim | 26–28 | `.toast` |
| Ayarlar paneli | 30 | `.settings-panel` |
| Bahçe / anı defteri | 40 | `.panel` |
| Başlangıç perdesi | 60 | `.veil` |

---

## 6. Hareket dili

```css
--ease-calm: cubic-bezier(0.4, 0, 0.2, 1);
--dur-soft:  600ms;
```

| Hareket | Süre | Not |
|---|---|---|
| Nefes halkası | 4 s / 6 s | Nefes fazıyla eşleşir |
| Mesaj geçişi | 600 ms opaklık | Eski metin kaybolur, yenisi gelir |
| Panel girişi | 320 ms | `panel-center-in` (ortalamayı korur) |
| Tema geçişi | 1200 ms | Arka plan rengi |
| Bildirim | 620 ms giriş | Sonra kendiliğinden kaybolur |
| Keşif öğeleri | 1,6–16 s | Türüne göre |

**Kritik:** Ortalanmış paneller `panel-center-in` keyframe'ini kullanmalıdır.
`panel-in` kullanmak `translate(-50%, -50%)` ortalamasını ezer ve paneli
ekran dışına kaydırır. Bu hata bir kez yapıldı.

---

## 7. Hareket azaltma

`prefers-reduced-motion: reduce` **altı yerde** uygulanır ve sahne tamamen
statik hale gelir:

| Dosya | Durdurulan |
|---|---|
| `scene3d.js` | Ağaç salınımı, duman, su hareketi, keşifler, **boşta kamera kayması** |
| `canvas.js` | Aynı öğelerin 2B karşılıkları, düşen yapraklar, bulutlar |
| `world.js` | Nefesle dünya dalgalanması (hedefler sabitlenir) |
| `discovery.js` | Keşif zamanlayıcısı hiç başlamaz |
| `breathing.js` | Halka geçişleri 0,01 ms'ye iner |
| `animations.css` | Tüm keyframe'ler ve geçişler kapanır |

Sistem tercihi çalışma anında değişirse `matchMedia` dinleyicisi uygular.

**Ölçüm:** Hareket azaltma açıkken kamera konumu ve yaw sabittir; keşif sayısı
0'dır (`tests/browser.js` bölüm 5).

---

## 8. İkonlar

Emoji **yalnızca** dekoratif ve tanıdık yerlerde kullanılır (üst bar düğmeleri,
tema seçimi, marka işareti). Bunların her biri `aria-label` taşır veya
`aria-hidden="true"` ile işaretlenir; emoji tek başına anlam taşımaz.

Harici ikon kütüphanesi **eklenmez** (zero-asset ilkesi). Yeni ikon gerekirse
inline SVG veya tipografik işaret tercih edilir.

---

## 9. Bileşenler

| Bileşen | Sınıf | Not |
|---|---|---|
| Üst bar düğmesi | `.ctrl-btn` | ≥48 px, cam yüzey, `aria-pressed` |
| Segment kontrol | `.seg-btn` / `.theme-btn` | `role="group"` + `aria-pressed` |
| Panel | `.panel` | `role="dialog"`, kaydırılabilir |
| Ayarlar paneli | `.settings-panel` | `aria-modal="false"` (sahne kullanılabilir kalır) |
| Mesaj kartı | `.message-card` | Sahne ızgarasının 2. satırı |
| Bildirim | `.toast` | `role="status"` |
| Bahçe ızgarası | `.garden-grid` | 6×4, `aspect-ratio: 1` saksılar |

Tüm panellerde ortak davranış: açılınca odak içeri girer, `Escape` kapatır,
kapanınca odak tetikleyen düğmeye döner.
