# Değişiklik Günlüğü

Kullanıcıyı etkileyen anlamlı değişiklikler. Biçim:
[Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) yaklaşımına yakın.

---

## [Yayınlanmadı]

### Değişti — Hareket öngörülebilirliği

- **Boşta kayma varsayılan olarak kapatıldı.** Önceden 10 saniye
  etkileşimsizlikten sonra kamera habersizce kaymaya başlıyordu; kullanıcı bunu
  "hiçbir şey yapmadan beklerken başka bir yere gitme" olarak yaşıyordu. Artık
  varsayılan olarak sahne yerinde kalır ve Ayarlar'da **"Boşta Bırak"** düğmesi
  ile açılabilir. Kapalıyken de sahne canlıdır (yapraklar, su, ateş böcekleri,
  bulutlar). Hareket azaltma tercihinde bu ayar yine kapalı kalır.
- **"Nefesle Yürü" sıçraması giderildi.** Her nefes verişinde kamera tek karede
  26 piksel atlıyordu (normal hız 22 px/s olduğu için görünür bir sıçrama).
  Adım artık yumuşak bir tamponda biriktirilir ve yaklaşık bir saniyeye yayılır.
  Ölçüm: en büyük tek kare adımı 26 px → **1,5 px**.

### Eklendi — Keşifler artık algılanabilir

- **Keşif sesleri.** Kelebek, ateş böceği, balıkçıl ve kayan yıldız için
  prosedürel, yumuşak ve ayırt edilebilir tek seferlik sesler eklendi. Hepsi
  `canPlay()` ile korunur, ses düzeyiyle ölçeklenir ve harici dosya kullanmaz.
- **Ayırt edilebilir biçimler.** 3B sahnede keşifler önceden aynı küreydi.
  Artık her türün kendi silueti var: kelebek iki çırpan kanat, balıkçıl gövde +
  boyun + bacaklar, kayan yıldız uzun bir iz, ateş böceği nabız gibi büyüyen
  bir çekirdek.
- **Adıyla bildirim.** Keşif bildirimi artık türün adını içerir
  ("Kelebek — Bir kelebek yoldan geçti...").

### Değişti — Paneller sahneyi kapatmıyor

- **Bahçe ve anı defteri artık sağ kenardan açılan yarı saydam çekmece.**
  Önceden ekranın ortasında opak bir karttı (0.92) ve dünyayı tamamen
  kapatıyordu; kullanıcı "panel ekranın önüne geliyor" diyordu. Çekmece 420 px
  genişliğinde, arka planı 0.72 opak ve arkasında sahne görünür kalıyor.
  Çekmece açıkken sahne içeriği sağa kaydırılır, böylece nefes alanı ve mesaj
  kartı altında kalmaz. Odak yönetimi ve `Escape` davranışı korunur.

### Eklendi — Bahçe dünyaya bağlandı

- **Dikilen çiçekler artık kulübenin yanında görünür.** Önceden bahçe yalnızca
  ayarlardaki soyut bir ızgaraydı ve kullanıcı "bastığımda bir şey olmuyor"
  diyordu. Çiçekler 3B sahnede ve 2B yedek motorda kulübenin yanındaki bahçe
  bölgesine yerleştirilir; büyüdükçe boyutları artar ve **asla solmaz**.
  Bildirim de nerede olduğunu söyler: "Kadife diktin. Kulübenin yanında
  büyüyecek."
- İlk kulübe kameraya yaklaştırıldı (60–110 birim → 26 birim), böylece bahçe
  dakikalar yerine saniyeler içinde görülür.

### Düzeltildi

- **`CalmSanctuary` init öncesi çöküyordu.** Görsel motorların çizim döngüsü
  sanctuary `init()` çağrısından önce başlar ve bahçeyi okur; bu
  `Cannot read properties of null (reading 'garden')` hatası veriyordu. Tüm
  okuma fonksiyonları artık `ensureLoaded()` ile güvenli.
- **`.theme-btn` biçimlendirilmemişti** ve yalnızca ~21 px yüksekliğindeydi;
  bu, 48 px dokunma alanı kuralının ihlaliydi. Artık `.seg-btn` ile aynı
  görsel dili paylaşıyor ve 48 px yüksekliğinde.
- **Çekmece giriş animasyonu** `animation` + `hidden` birlikte kullanıldığında
  `both` dolgu kipiyle başlangıç karesini kalıcı uyguluyor ve çekmeceyi 24 px
  taşırıyordu. Animasyon artık yalnızca görünür durumda uygulanır.

---

## [3.0] — Derin daldırma ve bağlamsal keşif

### Eklendi

- **3B sahne (Three.js).** Gerçek hacimli ağaçlar, kayalar, dere/okyanus ve
  kulübe. `W`/`S` yürüme, `A`/`D` dönme, yürürken kamera sallanması.

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
