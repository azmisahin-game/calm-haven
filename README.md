# 🌿 Calm Haven / Sakin Sığınak

**Yoğun iş ortamlarında çalışan, dikkatini toplamakta zorlanan ve dinlenmeye
ihtiyaç duyan insanlar için tasarlanmış, görev ve skor baskısı olmayan dijital
bir sığınak.**

Burada skor yok, zaman kısıtı yok, envanter kaybı yok, ölüm yok, solan bitki yok.
Bu bir oyun değil. Burası nefes alabildiğin bir alan.

**Canlı Yayın:** https://azmisahin-game.github.io/calm-haven/

> ⚠️ **Sağlık bilgisi:** Bu uygulama tıbbi bir cihaz değildir; tedavi, teşhis
> veya profesyonel sağlık hizmeti yerine geçmez. Hiçbir biyometrik ölçüm
> yapmaz. Nefes egzersizleri bazı kişilerde baş dönmesi veya rahatsızlık
> yaratabilir; rahatsızlık duyduğunuzda durun ve doğal nefesinize dönün.
> Ayrıntı ve kaynaklar: [docs/SCIENCE-AND-SAFETY.md](docs/SCIENCE-AND-SAFETY.md)

---

## Neden var?

Sürekli telefon, bildirim ve kesintinin olduğu bir masada çalışmak dikkati
dağıtır ve dinlenmeyi zorlaştırır. Sakin Sığınak bunun için üç şeyi tek ekranda
birleştirir: isteğe bağlı bir nefes ritmi, prosedürel doğa sesleri ve bakması
dinlendirici bir 3B sahne. Hiçbiri zorunlu değildir.

### Bilimsel dayanaklar — ne biliyoruz, ne bilmiyoruz

Aşağıdaki tablo, uygulamadaki tercihlerin **hangi kaynağa dayandığını** ve
**o kaynağın neyi göstermediğini** birlikte verir. Uygulama bu araştırmaların
kendisi değildir ve buradaki hiçbir ifade kişisel bir tıbbi sonuç vaadi değildir.

| Uygulamadaki tercih | Dayanak | Kaynağın gerçekte gösterdiği | Göstermediği |
|---|---|---|---|
| İçe çekiş ritmi (çift alış + uzun veriş) | Balban vd., *Cell Reports Medicine*, 2023 | 108 katılımcı, 28 gün, günde 5 dk. Çift alış + uzun veriş yapan grup **pozitif duygudurumda** ve **solunum hızı düşüşünde** diğer gruplardan daha iyiydi (p<0,05). | **Kaygı ölçümünde gruplar arasında fark bulunmadı**; istirahat kalp hızı ve HRV değişmedi. "En hızlı kaygı giderici" değildir. |
| Varsayılan 4 sn al / 6 sn ver ritmi | Verişin alıştan uzun olduğu yavaş ritimler (ör. 1:2 oranı) | 1:2 oranı çalışmada kullanılan orandır ve verişe ağırlık verir. | Belirli bir "rezonans frekansı" kişiye göre değişir; **herkes için ideal olduğu gösterilmemiştir.** Bu ritim sadece bir seçenektir. |
| Dikkat Yenileme Teorisi (ART) | Kaplan & Kaplan, 1989/1995 | Doğa görüntüleri "yumuşak büyülenme" yoluyla dikkati yenileyebilir. | Bu bir kuramdır; bu uygulamanın ölçülmüş bir dikkat iyileştirmesi sağladığı gösterilmemiştir. |
| Kahverengi gürültü | 1/f² spektral yoğunluk | Düşük frekanslı gürültü konuşma sesini maskeleyebilir. | Kaygı veya uyku üzerinde kalıcı klinik etki kanıtlanmamıştır. |

**Uygulama neyi ölçmez:** Nefesinizi, kalp hızınızı, kalp hızı değişkenliğinizi,
oksijeninizi veya herhangi bir fizyolojik sinyali **ölçmez**. Kamera, mikrofon ve
sensör kullanmaz. Ekrandaki halka sabit zamanlı bir animasyondur; sizin nefesinize
göre ayarlanmaz. Bu nedenle burada "biofeedback" yoktur — yalnızca **nefes
ritmiyle senkronize görsel geri bildirim** vardır.


## Yaşayan Dünya (2.0)

Sahne hiçbir zaman tamamen durmaz. Sis, ışık, su parıltısı, bulutlar ve düşen
yapraklar sürekli hafif hareket halindedir; ama hiçbiri dikkat istemez.

**Dünya sizinle nefes alır.** Nefes alırken sis dağılır, ay ışığı parlar, su
yüzeyi parıldar; verirken dünya yumuşar ve dinginleşir. Fizyolojik içe çekişte
sahne "nefes alır gibi" genişler ve bırakışta rahatlar.

**İşitsel geri bildirim.** Yürürken çok hafif ayak sesi ve yaprak hışırtısı
duyulur; nadiren bir kuş cıvıldar. Tüm seviyeler düşüktür — amaç dikkat çekmek
değil, toprakla temas hissi.

**Keşifler.** Kayan yıldız, balıkçıl, kelebek ve ateş böceği rastgele belirir.
Yakalamak, tıklamak veya yetişmek gerekmez. Kaçırılan bir an yoktur: görülmezse
sadece kaybolur ve başka bir zamanda yeniden gelir.

**Nefesle Yürü.** Ayarlardan açılır. Her nefes verişinde bir adım atılır; tuşa
basmanız gerekmez. Yürümek bir ritüele dönüşür ve RSI riski ortadan kalkar.

**İki ortam.** 🌲 **Orman** (gece mavisi, çam, dere) ve 🏝️ **Issız Ada**
(gün batımı, palmiye, okyanus dalgaları).

---

## Derinlik (3.0)

Sahne **Three.js** tabanlı gerçek 3B'dir: ağaçlar, kayalar, dere/okyanus ve
kulübe artık hacimli nesnelerdir. Sis, ay ışığı ve su parıltısı özel
gölgelendiricilerle (shader) nefes fazına bağlıdır.

- **W / ↑** yürü, **S / ↓** dur · **A / ←** ve **D / →** dön
- Kamera yürürken hafifçe sallanır (yaw + roll); hareket azaltmada bu tamamen kapanır
- Ağaçlar ve kayalar **InstancedMesh** ile çizilir: yüzlerce nesne birkaç çizim
  çağrısında birleşir
- **Uyarlanabilir kalite:** kare hızı düşerse çözünürlük kademeli azalır, sahne
  akıcı kalır
- **3B yüklenemezse** (WebGL yok, three.js gelmedi) oyun sessizce 2B motora düşer.
  Boş ekran veya hata mesajı oluşmaz.

> Three.js `vendor/three.module.min.js` içinde **yerelden** sunulur. CDN
> kullanılmaz; böylece çevrimdışı da çalışır ve derleme adımı gerekmez.

---

## Bağlamsal mesajlar (3.0)

Mesajlar artık rastgele değil; **konuma ve ana** göre seçilir:

| Tetikleyici | Örnek |
|---|---|
| Dere kenarına bakmak | "Su sesi... Burada biraz dur." |
| Tepeden uzağa bakmak | "Uzaklara bak. Gözlerini dinlendir." |
| Kulübeye varmak | "Kulübene geldin. Burada kimse senden bir şey istemiyor." |
| Kuş konduğunda | "Bir kuş geldi. Onu izle." |
| İçe çekiş tamamlanınca | "İçe çekişi tamamladın. Bedenin bunu hatırlayacak." |
| Uzun süre yürüyünce | "Uzun süredir yürüyorsun. Durmak da bir seçenek." |

Aynı bölge mesajı 45 saniye içinde tekrar etmez; bağlamsal mesaj görünürken
normal rotasyon duraklar, sonra kaldığı yerden devam eder.

---

## Kişisel sığınak (3.0)

- **Bahçe.** 6×4 saksıya çiçek dikersiniz. Her çiçek zamanla **büyür ve öyle
  kalır** — hiçbiri solmaz, hiçbiri kaybolmaz, sulamanız gerekmez.
- **Deniz kabukları.** Ada temasında kıyıda nadiren kabuk bulursunuz. Toplamak
  tüketmek değildir: koleksiyon büyür, hiçbir şey eksilmez.
- **Sal.** 8 kabuk birikince kendiliğinden hazır olur; kaynak harcanmaz.
- **Anı defteri.** İsteğe bağlıdır ve **tamamen cihazda kalır**. Sunucuya
  gitmez, paylaşılmaz, analitik yoktur. "Defteri Temizle" ile silinir.

---

## Öne çıkan ilkeler

- **Sıfır ceza, sıfır kayıp.** Hiçbir şey elinden alınmaz, geri sayım yoktur.
  Çiçekler solmaz, kabuklar eksilmez, kaydedilen ilerleme geri gitmez.
- **Çabasız faillik.** Tıklama, `Space`, otomatik gezinti veya **Nefesle Yürü**
  ile tekrarlayan zorlanma (RSI) yaratmaz.
- **Yaşayan ama sakin.** Sahne asla donmaz, ama sizden hiçbir şey istemez.
- **Zero-Asset Failure.** Harici medya yoktur: sesler **Web Audio API** ile
  sentezlenir, görseller **Canvas**/`CSS`/`WebGL` ile üretilir, Three.js
  depoda yereldir. 3B çalışmazsa 2B yedek devralır.
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
| Yürümek | Ekrana tıklama, `Space`, **`W`** veya `↑` |
| Sağa / sola dönmek (3B) | **`A`** / **`D`** veya `←` / `→` |
| Otomatik gezinti | Üst bardaki **"Kendi Akışına Bırak"** (veya `C`) |
| Fizyolojik içe çekiş | **"Sakinleş"** butonu **veya** `P` |
| Sesi aç / kapat | `M` **veya** üst bardaki ses düğmesi |
| Ayarlar | `Esc` |

Ayarlar panelinden ayrıca **Nefesle Yürü**, **ortam teması** (Orman / Issız Ada),
**bahçe**, **anı defteri**, ses düzeyi ve yürüyüş hızı seçilebilir.

Tüm düğmeler en az 48×48 piksel dokunma alanına sahiptir.

---

## Gizlilik

**Bu uygulama hiçbir kişisel sağlık verisi toplamaz, saklamaz veya paylaşmaz.**
Sunucu yoktur, hesap yoktur, analitik yoktur, çerez yoktur. Hiçbir veri cihazdan
çıkmaz.

Tarayıcının `localStorage` alanında yalnızca şu teknik ilerleme tutulur
(`calm_haven_data_v1` anahtarı): adım sayısı, toplam süre, açılan gelişmeler,
son ziyaret tarihi ve ses/hız/tema tercihleri. Bu veri sizin tarayıcınızdadır;
"İlerlemeyi Sıfırla" düğmesi veya tarayıcı verilerini temizlemekle silinir.

Bu proje, tükenmişlik sendromu yaşayan bireyler için tasarlanmıştır. Tanıtım
metinlerindeki semptom ifadeleri (boyun/baş ağrısı, panik, tükenmişlik) genel
hedef kullanıcı profilini tanımlar; gerçek bir kişiye ait sağlık kaydı içermez.

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
│   ├── scene3d.js                 # Three.js 3B sahne (ES modülü)
│   ├── canvas.js                  # 2B yedek motor, yaşayan orman/ada
│   ├── world.js                   # Dünya durumu, nefes senkronizasyonu
│   ├── audio.js                   # Web Audio: brown noise, ayak sesi, kuş
│   ├── breathing.js               # Rezonans & fizyolojik içe çekiş
│   ├── discovery.js               # Keşif motoru (kayan yıldız, balıkçıl...)
│   ├── context.js                 # Bağlamsal mesaj sistemi
│   ├── sanctuary.js               # Bahçe, kabuklar, sal, anı defteri
│   └── messages.js                # Şefkatli mesaj çekici
├── vendor/
│   └── three.module.min.js        # Three.js r160 (MIT, yerel — CDN yok)
├── data/
│   ├── messages.json              # Somatik farkındalık mesajları (Türkçe)
│   ├── discoveries.json           # Keşif tanımları
│   └── context-messages.json      # Bağlamsal mesaj tanımları
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

