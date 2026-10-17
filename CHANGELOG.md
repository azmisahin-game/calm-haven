# Değişiklik Günlüğü

Kullanıcıyı etkileyen anlamlı değişiklikler. Biçim:
[Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) yaklaşımına yakın.

---

## [Yayınlanmadı]

### Düzeltildi — Erişilebilirlik

- **Yakınlaştırma engeli kaldırıldı.** `viewport` etiketindeki
  `maximum-scale=1, user-scalable=no` az gören kullanıcıların sayfayı
  büyütmesini engelliyordu. Ayrıca iOS'ta iki parmak yakınlaştırmayı bloke eden
  `gesturestart` işleyicisi kaldırıldı. %100/%200/%400 zoom doğrulandı.
- **Ekran okuyucu çığı giderildi.** Nefes faz metni (`Nefes al...` / `Bırak...`)
  bir canlı bölgeydi ve her 4–6 saniyede değişiyordu; ekran okuyucu sürekli
  konuşurdu. Canlı bölge kaldırıldı, yalnızca seyrek durum değişiklikleri ayrı
  bir bölgeden duyuruluyor.
- **Panellere dialog semantiği eklendi.** Ayarlar, bahçe ve anı defteri
  `role="dialog"` + `aria-labelledby` aldı.
- **Yanlış ARIA kullanımı düzeltildi.** Segment kontroller `role="radio"`
  taşıyordu ama ok tuşu davranışını uygulamıyordu. Native `button` +
  `aria-pressed`'e geçildi.
- **Odak yönetimi eklendi.** Panel açılınca odak içeri giriyor, kapanınca
  tetikleyen düğmeye dönüyor. `Escape` en üstteki paneli kapatıyor.
- **Klavye kısayolu çakışması giderildi.** Anı defterine yazarken `c` ve `p`
  tuşları otomatik gezintiyi ve nefes rehberini tetikliyordu; artık metin
  alanlarında kısayollar devre dışı.

### Düzeltildi — Dayanıklılık

- **Bozuk kayıt uygulamayı çökertiyordu.** `settings: null` kaydedilmişse
  uygulama hiç açılmıyordu. Kaydedilmiş veri artık tam doğrulanıyor: kök nesne,
  ayar türleri, sayısal aralıklar, çiçek türleri, ızgara konumları, zaman
  damgaları. Bozuk kayıtlar ayıklanır, geçerli ilerleme korunur.
- **NaN hız sahneyi bozuyordu.** `walkSpeed: "hizli"` gibi bir değer `NaN`
  üretiyordu. Tür doğrulaması eklendi.
- **Kısa ekranda düzen çakışması.** Nefes alanına eklenen açıklama ve durdurma
  düğmesi 480×320, 320×568, 740×360 ve 568×320 boyutlarında üst bar ve mesaj
  kartıyla çakışıyordu. Halka artık yükseklikten türetiliyor; çok kısa ekranda
  açıklama gizleniyor.
- **Bağlamsal mesaj yedeği eksikti.** `file://` üzerinden açıldığında 3 mesaj
  (deep_forest, butterfly_seen, firefly_seen) hiç görünmüyordu.

### Değişti — Bilimsel dil ve güvenlik

- **Aşırı iddialar düzeltildi.** "Nörobiyolojik tabanlı", "vagal frenleme" ve
  "çift yönlü biofeedback" ifadeleri kaldırıldı. Uygulama biyometrik ölçüm
  yapmadığı için "biofeedback" yanlıştı; yerine "nefes ritmiyle senkronize
  görsel geri bildirim" geldi.
- **Kaynak sınırları belgelendi.** Balban vd. (2023) çalışmasının kaygı
  ölçümünde gruplar arası fark bulmadığı ve istirahat HRV'nin değişmediği
  açıkça yazıldı. Ayrıntı: [SCIENCE-AND-SAFETY.md](docs/SCIENCE-AND-SAFETY.md)
- **Nefes rehberine durdurma düğmesi eklendi.** Kullanıcı her an çıkabilir ve
  doğal nefesine dönebilir. Durdurmak cezalandırıcı değildir.
- **"Ritmi takip etmek zorunda değilsin"** notu görünür hale getirildi.
- **Nefes metinleri davet kipine çevrildi** ("Burnundan derin bir nefes al..." →
  "İstersen burnundan derin bir nefes al...").
- **"Sakinleş" düğmesi "İçe Çekiş" olarak yeniden adlandırıldı**; tıbbi
  rahatlama vaadi ima etmiyor.
- **Başlangıç perdesine** sakin tıbbi uyarı ve **sessiz giriş** seçeneği eklendi.

### Eklendi — Test altyapısı

- `tests/static-checks.js` — 40 bağımlılıksız denetim (sözdizimi, JSON şeması,
  yerel bağlantılar, göreceli yollar, tema tutarlılığı, yedek havuz uyumu,
  UTF-8, gizlilik izleri, vendor lisansı).
- `tests/browser.js` — gerçek Chromium ile 49 test (zoom, nefes güvenliği,
  hareket azaltma, XSS, bozuk storage matrisi, 2B yedek, 20 görünüm boyutu,
  erişilebilirlik ve kontrast).
- `tests/run-browser.sh` — sunucuyu başlatıp testleri çalıştırır.
- CI artık testleri **zorunlu** kılıyor: `verify` başarısızsa dağıtım yapılmaz.
  Üretim paketi `node_modules` ve `tests` içermez.

### Eklendi — Belgeler

- `docs/ARCHITECTURE.md`, `docs/DESIGN-SYSTEM.md`,
  `docs/SCIENCE-AND-SAFETY.md`, `docs/PRIVACY.md`, `docs/TESTING.md`,
  `CHANGELOG.md`.

---

## [3.0] — Derin daldırma ve bağlamsal keşif

### Eklendi

- **3B sahne (Three.js).** Gerçek hacimli ağaçlar, kayalar, dere/okyanus ve
  kulübe. `W`/`S` yürüme, `A`/`D` dönme, yürürken kamera sallanması.
- **Shader'lı atmosfer.** Sis, ay ışığı ve su parıltısı nefes fazına bağlı;
  alışta dünya canlanır, verişte yumuşar.
- **InstancedMesh** ile ağaç ve kayalar tek çizim çağrısında.
- **Uyarlanabilir kalite:** kare hızı düşerse çözünürlük kademeli azalır.
- **Bağlamsal mesajlar.** Bölge, keşif, nefes ve uzun yürüme durumuna göre
  seçilir; rastgele değil.
- **Kişisel sığınak:** bahçe (çiçekler büyür, solmaz), deniz kabuğu koleksiyonu
  (hiçbir şey eksilmez), sal, anı defteri (yalnızca cihazda).

### Düzeltildi

- `panel-in` animasyonu ortalanmış panelleri ekran dışına kaydırıyordu.
- Three.js r155+ ışık birimleri sahneyi "boş karanlık" yapıyordu.
- Performans ölçümü `dt` toplamına dayandığı için koruma hiç devreye girmiyordu.
- Hareket azaltmada boşta kamera kayması devam ediyordu.

---

## [2.0] — Yaşayan dünya

### Eklendi

- Dünya nefesle senkron: sis, ay ışığı, su parıltısı.
- Sürekli hareket: bulutlar, düşen yapraklar, su parıltısı, sis bantları.
- İşitsel geri bildirim: ayak sesi, yaprak hışırtısı, kuş cıvıltısı.
- Keşifler: kayan yıldız, balıkçıl, kelebek, ateş böceği.
- **Nefesle Yürü** ritüel modu.
- Ortam temaları: 🌲 Orman ve 🏝️ Issız Ada.

### Ölçüm

- Boşta piksel değişimi %1 → %42 (canlı ama sakin: ortalama fark 15,7/765).

---

## [1.0] — İlk sürüm

- Nefes rehberi: rezonans (4/6) ve fizyolojik içe çekiş.
- Prosedürel Web Audio: kahverengi gürültü, pembe gürültü yağmur katmanı.
- Sonsuz 2B orman/ada, paralaks derinlik, kişisel kulübe.
- LocalStorage kalıcılığı ve kilometre taşları.
- GitHub Pages dağıtımı, MIT lisansı.
