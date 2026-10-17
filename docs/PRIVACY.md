# Gizlilik

Calm Haven yerel öncelikli bir uygulamadır. Bu belge **neyin cihazda tutulduğunu**
ve — en az bunun kadar önemlisi — **neyin garanti edilmediğini** açıklar.

---

## 1. Kısa özet

| Soru | Yanıt |
|---|---|
| Hesap gerekir mi? | Hayır |
| Sunucuya veri gönderilir mi? | **Hayır** |
| Analitik, telemetri, reklam var mı? | **Hayır** |
| Çerez kullanılır mı? | **Hayır** |
| Kamera / mikrofon / konum istenir mi? | **Hayır** |
| Üçüncü taraf istek var mı? | **Hayır** (Three.js depoda yereldir) |
| Veri cihazdan çıkar mı? | **Hayır** |
| Veri şifrelenir mi? | **Hayır** (gerekmez, ama bu bir eksiklik değil, bir gerçek) |
| Yedeklenir mi? | **Hayır** |

---

## 2. Cihazda tutulan veriler

Tarayıcının `localStorage` alanında **iki** anahtar bulunur. Başka hiçbir kalıcı
veri yazılmaz.

### 2.1 `calm_haven_data_v1`

| Alan | İçerik |
|---|---|
| `steps` | Sakinlik adımı sayısı (tam sayı) |
| `totalTime` | Sığınakta geçirilen toplam saniye |
| `milestones` | Açılan gelişmelerin eşikleri (ör. `[50, 150]`) |
| `lastVisit` | Son ziyaretin ISO tarihi |
| `settings.audioEnabled` | Ses açık/kapalı |
| `settings.audioLevel` | Ses düzeyi (0–1) |
| `settings.walkSpeed` | Yürüyüş hızı (0,1–1) |
| `settings.breathMode` | `resonance` veya `sigh` |
| `settings.theme` | `forest` veya `island` |
| `settings.breathWalk` | Nefesle yürü açık/kapalı |

### 2.2 `calm_haven_sanctuary_v1`

| Alan | İçerik |
|---|---|
| `garden` | Dikilen çiçekler: tür, ekilme zamanı, ızgara konumu |
| `shells` | Toplanan deniz kabuklarının tür ve adetleri |
| `raftBuilt` | Salın hazır olup olmadığı |
| `journal` | **Kullanıcının yazdığı anı notları** (en fazla 200 kayıt, kayıt başına 500 karakter) |
| `lastShellAt` | Son kabuk bulma zamanı |

**Kişisel sağlık verisi toplanmaz.** Nefes ritmi tercihi (`breathMode`) bir
uygulama ayarıdır; bir sağlık kaydı değildir ve hiçbir yere gönderilmez.

---

## 3. Sınırlamalar — bunları açıkça söylüyoruz

### 3.1 Veri şifrelenmez

`localStorage` verisi düz metin olarak saklanır. Aynı cihazı ve tarayıcı profilini
kullanan başka biri (veya cihazdaki başka bir yazılım) bu veriyi okuyabilir.
Anı defterine hassas bilgi yazmayın.

### 3.2 Veri yedeklenmez

Tarayıcı verilerini temizlerseniz, gizli/incognito sekme kullanırsanız veya
tarayıcı depolamayı temizlerse **tüm ilerleme ve anılar kalıcı olarak silinir.**
Sunucu tarafında bir kopya yoktur, bu yüzden geri getirilemez. Bu bir hata değil,
mimarinin doğal sonucudur.

### 3.3 Cihazlar arasında eşitlenmez

Veri cihaza özeldir. Telefonda diktiğiniz çiçekler bilgisayarda görünmez.
Hesap ve senkronizasyon yoktur.

### 3.4 Depolama reddedilebilir

Gizli sekmede veya depolama kapalıysa yazma başarısız olabilir. Uygulama bu
durumda **çalışmaya devam eder**; yalnızca ilerleme o oturumla sınırlı kalır.
Konsola sessizce düşer, kullanıcıya hata gösterilmez.

---

## 4. Ağ istekleri

Uygulama çalışırken yapılan **tüm** istekler aynı kaynaktandır
(`azmisahin-game.github.io/calm-haven/`):

| İstek | Amaç |
|---|---|
| `index.html` | Sayfa |
| `css/style.css`, `css/animations.css` | Stiller |
| `js/*.js` (11 dosya) | Uygulama modülleri |
| `vendor/three.module.min.js` | 3B motor (depoda yerel) |
| `data/messages.json` | Mesaj havuzu |
| `data/discoveries.json` | Keşif tanımları |
| `data/context-messages.json` | Bağlamsal mesajlar |
| `favicon` (data URI) | Sekme simgesi — ağ isteği değil |

**Harici alan adına istek yoktur.** `tests/static-checks.js` bunu otomatik olarak
denetler: CDN, analitik ve izleme kalıpları aranır ve bulunursa test başarısız olur.

---

## 5. Veri silme

| İşlem | Ne siler |
|---|---|
| Anı defteri → "Defteri Temizle" | Yalnızca `journal` alanı |
| Ayarlar → "İlerlemeyi Sıfırla" | Adımlar, süre, gelişmeler (anılara dokunmaz) |
| Tarayıcı verilerini temizleme | Her şey |

**"İlerlemeyi Sıfırla" anı defterinizi silmez.** İki eylem kasten ayrıdır;
birini yapmak diğerinin verisini etkilemez.

---

## 6. Çevrimdışı kullanım — dürüst durum

**Doğru ifade:** Uygulamanın **harici CDN veya medya bağımlılığı yoktur.**
Three.js dahil tüm dosyalar depoda yereldir.

**Yanlış olur:** "Uygulama her zaman çevrimdışı açılır." Bu **garanti edilmez.**
Depoda bir service worker yoktur, bu yüzden tarayıcı önbelleği dosyaları
saklamazsa ilk çevrimdışı açılış başarısız olur. Dosyalar tarayıcı önbelleğinde
varsa açılabilir, ama bu tarayıcının kararıdır, uygulamanın garantisi değildir.

Tam çevrimdışı destek eklenmesi (service worker + manifest) ayrı bir iştir ve
bu sürümde **yoktur**. Bu belge, olmayan bir özelliği varmış gibi göstermez.

---

## 7. Bu politikayı doğrulama

Gizlilik iddialarını kendiniz kontrol edebilirsiniz:

1. Tarayıcı geliştirici araçlarını açın → **Network** sekmesi.
2. Uygulamayı açın, perdeyi geçin, 2–3 dakika kullanın.
3. Tüm isteklerin `azmisahin-game.github.io` kaynaklı olduğunu doğrulayın.
4. **Application → Local Storage** altında yalnızca yukarıdaki iki anahtarı
   görürsünüz.

Ayrıca `node tests/static-checks.js` çalıştırıldığında "Analitik veya izleme
kodu yok" ve "Çalışma anında harici CDN bağımlılığı yok" denetimleri bu iddiayı
otomatik olarak sınar.
