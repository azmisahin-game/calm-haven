# Bilim ve Güvenlik

Bu belge, uygulamadaki nefes seçeneklerinin hangi kaynağa dayandığını, bu
kaynakların **neyi gösterdiğini ve neyi göstermediğini** ve kullanıcı güvenliği
için alınan önlemleri açıklar.

> **Özet:** Calm Haven tıbbi bir cihaz değildir. Tedavi, teşhis veya profesyonel
> sağlık hizmeti yerine geçmez. Hiçbir fizyolojik ölçüm yapmaz.

---

## 1. Uygulamanın ölçmediği şeyler

Bu bölüm, yanlış beklenti oluşmaması için önce okunmalıdır.

| Ölçülür mü? | Durum |
|---|---|
| Nefes hızınız / derinliğiniz | **Hayır** |
| Kalp hızınız veya kalp hızı değişkenliğiniz (HRV) | **Hayır** |
| Kan oksijeniniz | **Hayır** |
| Stres, kaygı veya duygudurum düzeyiniz | **Hayır** |
| Kamera / mikrofon / biyometrik sensör | **Kullanılmaz** |

Ekrandaki nefes halkası **sabit zamanlı** bir animasyondur. Sizin nefesinize göre
ayarlanmaz, sizi "okumaz", hızınıza uyum sağlamaz. Yalnızca takip etmek isterseniz
bir ritim önerir.

**Bu nedenle uygulamada "biofeedback" yoktur.** Doğru ifade: *nefes ritmiyle
senkronize görsel geri bildirim*. Geri bildirim döngüsü kapalı değildir; sizden
uygulamaya ölçüm akmaz.

---

## 2. Nefes seçenekleri

### 2.1 Rezonans ritmi (varsayılan): 4 sn al / 6 sn ver

- **Ne yapar:** Alıştan uzun bir veriş ritmi önerir. Ekranda "Nefes al..." ve
  "Bırak..." metinleriyle halka büyüyüp küçülür.
- **Dayanak:** Verişin alıştan uzun olduğu yavaş ritimler (yaklaşık 1:2 oranı)
  yaygın olarak kullanılır ve Balban vd. (2023) çalışmasında test edilen orandır.
- **Ne iddia etmiyoruz:** Bu ritmin **herkes için ideal** olduğunu iddia
  etmiyoruz. Kişiye göre rahat olan ritim değişir. "Rezonans frekansı" kişiye
  özeldir ve burada ölçülmez. Bu yalnızca bir seçenektir; hiç kullanmayabilirsiniz.

### 2.2 İçe çekiş (çift alış + uzun veriş)

- **Ne yapar:** 2,5 sn burundan derin alış → 1,0 sn küçük bir alış daha →
  6,0 sn ağızdan uzun veriş. Üç tur sürer, sonra varsayılan ritme döner.
- **Dayanak:** Balban, Spiegel, Huberman vd., *Brief structured respiration
  practices enhance mood and reduce physiological arousal*, **Cell Reports
  Medicine**, 2023. <https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947/>

**Kaynağın gerçekte gösterdiği:**

- Çalışma 108 katılımcıyı 28 gün boyunca günde 5 dakika izledi; dört grup vardı
  (içe çekiş, kutu nefesi, tutmalı hızlı nefes, mindfulness).
- İçe çekiş grubu **pozitif duygudurumda** ve **solunum hızı düşüşünde** diğer
  gruplardan daha iyi sonuç verdi (p < 0,05).
- Etki, protokole uyum arttıkça büyüdü.

**Kaynağın göstermediği (bunu açıkça yazıyoruz):**

- **Kaygı ölçümünde gruplar arasında anlamlı fark bulunmadı.** İçe çekiş, kaygı
  açısından diğer yöntemleri geçmedi. Bu yüzden onu "en hızlı kaygı giderici"
  diye sunmuyoruz.
- **İstirahat kalp hızı ve HRV değişmedi.** "Vagal frenleme" gibi bir mekanizma
  iddiası bu çalışmadan çıkarılamaz.
- Örneklem küçüktür (grup başına 21–33 kişi) ve kutu nefesi grubu özellikle
  küçüktür; yazarlar da bunu sınırlılık olarak belirtir.
- Çalışma **bu web uygulamasını** değil, yüz yüze/uzaktan yönlendirilen bir
  protokolü inceledi. Buradaki deneyim o çalışmanın kendisi değildir.

**Uygulamadaki fark:** Çalışma günde 5 dakikalık oturumlar kullandı. Uygulamada
içe çekiş **üç tur** sürer (yaklaşık 30 saniye) ve sonra normal ritme döner. Bu,
çalışmanın süresinden farklıdır; kısa bir araç olarak tasarlandı, bir tedavi
protokolü olarak değil.

### 2.3 Doğal nefesinizle kalmak

Nefes rehberi **isteğe bağlıdır**. Ritmi takip etmek zorunda değilsiniz.

- Ekrandaki **"Rehberi Durdur"** düğmesi her zaman görünür ve tek tıkla çalışır.
- Durdurduğunuzda ekranda "Kendi nefesinle kal..." yazar; sahne sakin kalır.
- Durdurmak cezalandırıcı değildir: hiçbir ilerleme kaybolmaz, hiçbir uyarı
  çıkmaz. İstediğiniz an yeniden başlatabilirsiniz.
- Yürümek, sesi kapatmak ve sahneyi izlemek için nefes rehberine hiç
  dokunmanız gerekmez.

---

## 3. Güvenlik

### 3.1 Nefes egzersizleri ve olası rahatsızlık

Yavaş ve derin nefes egzersizleri bazı kişilerde **baş dönmesi, nefes darlığı
hissi, karıncalanma veya rahatsızlık** yaratabilir. Nadiren panik hissini
artırabilir.

**Rahatsızlık duyduğunuzda:**

1. **Durun.** Nefes rehberini kapatın ("Rehberi Durdur" veya `Esc`).
2. **Doğal nefesinize dönün.** Ritmi yakalamaya çalışmayın.
3. Gerekirse oturun, su için, pencereye çıkın.
4. Belirti sürerse bir sağlık uzmanına başvurun.

Nefesinizi **tutmanız gerekmez.** Uygulamada nefes tutma adımı yoktur ve
"yetişmeye çalışmak" beklenmez. Ritim bir davettir, bir kural değil.

### 3.2 Bu uygulamanın uygun olmadığı durumlar

Aşağıdaki durumlarda nefes egzersizlerine başlamadan önce bir sağlık uzmanına
danışın:

- Kalp veya akciğer rahatsızlığı, yüksek tansiyon
- Panik bozukluğu veya travma sonrası stres bozukluğu tanısı
- Epilepsi veya nöbet geçmişi
- Gebelik
- Yakın zamanda geçirilmiş ameliyat veya solunum yolu enfeksiyonu

### 3.3 Acil durum

Bu uygulama bir kriz aracı **değildir**. Panik atak geçirdiğinizi düşünüyorsanız,
kendinize zarar verme düşüncesi varsa veya akut bir tıbbi durum yaşıyorsanız,
uygulamayı kapatın ve **acil sağlık hizmetlerine** başvurun (Türkiye'de 112).
Lütfen bu uygulamayı profesyonel yardım yerine kullanmayın.

---

## 4. Diğer dayanaklar ve sınırları

| Uygulamadaki tercih | Dayanak | Sınır |
|---|---|---|
| Yaşayan, hareketli doğa sahnesi | Dikkat Yenileme Teorisi (Kaplan & Kaplan, 1989/1995) | Bir **kuramdır**. Bu uygulamanın ölçülmüş bir dikkat iyileştirmesi sağladığı gösterilmemiştir. |
| Kahverengi gürültü (1/f² spektrum) | Spektral yoğunluk tanımı | Düşük frekanslı gürültü konuşmayı maskeleyebilir. Kaygı, uyku veya odaklanma üzerinde kalıcı klinik etkisi kanıtlanmamıştır. |
| Seslerin prosedürel üretimi | Uygulama içi tasarım | Kayıtlı doğa sesi değildir; sentezlenmiş gürültüdür. |
| Skor ve ceza olmaması | Ürün felsefesi | Bir tercihtir; bilimsel bir iddia değildir. |

---

## 5. Arayüzdeki güvenlik metinleri

Aşağıdaki metinler kullanıcıya doğrudan gösterilir:

- **Başlangıç perdesi:** "Bu uygulama tıbbi bir cihaz değildir; tedavi veya
  profesyonel yardım yerine geçmez. Nefes egzersizi rahatsızlık verirse dur ve
  doğal nefesine dön."
- **Nefes alanı (kalıcı):** "Ritmi takip etmek zorunda değilsin. Doğal nefesinle
  de kalabilirsin."
- **İçe çekiş başlarken:** "İçe çekiş başladı. Rahatsızlık duyarsan durdur ve
  doğal nefesine dön."
- **Durdurma düğmesi:** "Rehberi Durdur"
- **Anı defteri:** "Buradaki her şey yalnızca bu cihazda kalır."

Uyarılar kasten **sakin** tutulmuştur: korkutucu modal, kırmızı alarm veya
deneyimin merkezine yerleştirilmiş engelleyici uyarı yoktur.

---

## 6. Kaynaklar

1. Balban MY, Neri E, Kogon MM, Weed L, Nouriani B, Jo B, Holl G, Zeitzer JM,
   Spiegel D, Huberman AD. *Brief structured respiration practices enhance mood
   and reduce physiological arousal.* **Cell Reports Medicine**, 2023;4(1):100895.
   <https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947/>
2. Kaplan S, Kaplan R. *The Experience of Nature: A Psychological Perspective.*
   Cambridge University Press, 1989. (Dikkat Yenileme Teorisi)
3. Kaplan S. *The restorative benefits of nature: Toward an integrative
   framework.* Journal of Environmental Psychology, 1995;15(3):169–182.

Kaynaklar yalnızca **yön gösterir**. Hiçbiri bu uygulamanın etkinliğini
kanıtlamaz; uygulama bu araştırmaların kendisi değildir.
