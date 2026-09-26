# Be Unicorn Web — Oyun Planı

> Mobil **Be Unicorn** oyununun web (Three.js) versiyonu.
> Kavramlar, amaç ve strateji `omerfarukdemiral/be-unicorn` reposundan geliyor. Matematik, sunum ve öğretim sistemi sıfırdan kuruluyor.
> Görsel tarafın tamamı kodla üretilecek: prosedürel low-poly geometri, HTML/CSS arayüz. Görsel asset dosyası yok.

---

## 0. Tek paragrafta oyun

Oyuncu küçük bir bütçeyle bir garajda şirket kurar. İşe alım yapar, mobilya alır, ofisini **merkezden kenarlara doğru** büyütür, ürün çıkarır, kullanıcı ve gelir toplar, yatırım turlarıyla daha büyük ofislere taşınır. Hedef 1 milyar dolar değerlemeye, yani Unicorn'a ulaşmak. Kasa 60 gün boyunca ekside kalırsa şirket batar.

Oyunun asıl amacı startup dünyasının kavramlarını **oynatarak öğretmek**. Runway, burn, churn, LTV:CAC, dilution gibi kavramlar oyuncuya önce bir mekanik olarak yaşatılır. Adı ancak ondan sonra konur.

---

## 1. Kapsam

### Repodan taşınanlar (kavram olarak)
- **Aşamalar:** Garaj → Pre-seed → Seed → Series A → Series B → Series C → Unicorn
- **Departmanlar:** Mühendislik, Ürün & Tasarım, Pazarlama, Satış, Operasyon
- **Projeler:** 6 kategori (Mobil, Web, AI, API, Oyun, Pazar Yeri). MVP ile yayına çıkar, olgunlaştıkça değer üretir.
- **Karar kartları:** Tek doğru cevap yok. Bazı kararların etkisi gecikmeli gelir. Seçimin ardından yargılamayan bir "yansıma" cümlesi gösterilir.
- **Founder arketipleri:** Bootstrap, VC-Roket, Niş Uzman, Platform. Dördü de kazanabilmeli.
- **Kurucu Defteri:** Dersler, ipuçları ve anlatı satırları. Hepsi yeniden yazılıyor, bkz. §6.
- **İflas sonrası yeniden başlama:** Founder XP ile bir sonraki oyun küçük bir avantajla başlar.
- **Tasarım ilkeleri:** Tek doğru cevap yok, sığ formül yok, rastgele ceza yok.

### Bilinçli olarak dışarıda bırakılanlar (v1)
Lig, sezon, günlük hedef, streak, paywall/IAP, offline ilerleme ve bildirimler. Önce çekirdek döngü eğlenceli olmalı. Bunlar v2'de değerlendirilir.

### Eski oyunun çözülmesi gereken sorunları
Kaynak: PLAYTEST_FEEDBACK, BALANCE_REPORT, PRODUCT_AUDIT.

| Sorun | Bu versiyondaki cevap |
|---|---|
| "Oyun değil uygulama gibi", aksiyonlar arası 22–40 sn ölü süre | Ofiste sürekli bir şey oluyor. Kararlar karakterlerin konuşma balonlarıyla geliyor. Aktif kurucu aksiyonları var (§4.4). |
| Series C ofisi 30 aynı kareden oluşuyordu, ilerleme hissi yoktu | İzometrik 3D ofis, halka halka açılan alan, her turda taşınma (§3) |
| İpucu şeridi bağlamsızdı ("runway her şeydir" dendiği anda şirket kârdaydı) | Her metin bir duruma bağlı tetikleniyor (§6) |
| Ders ve sonuç satırları 3,5 sn'lik toast'larda kayboluyordu | Metin balonda bekler, tıklanınca açılır, Defter'e kaydolur |
| Modallar üst üste biniyordu | Kararlar ekranı kilitlemeyen balonlar. Aynı anda en fazla 1 blocking modal. |
| Ekonomi ve denge en zayıf alandı (62/100). Sim ile kod ayrışmıştı. | Aynı engine modülünü hem oyun hem node denge simülatörü kullanır (§8) |
| Series A–C arası uzun grind, yeni bir şey açılmıyordu | Her aşama yeni kavram, yeni gösterge, yeni slot tipi ve yeni ofis açar (§3.1) |

---

## 2. Temel ilke: Hisset → Adlandır → Kullan

Her kavram üç adımda öğretilir.

1. **Hisset.** Oyuncu kavramın etkisini mekanik olarak yaşar ama henüz adını bilmez. Örneğin kasa her gün eriyor ve oyuncu bunu sayaçta görüyor.
2. **Adlandır.** Tetikleyici koşul oluştuğunda ofisteki bir karakter tek cümleyle adını koyar: *"Bu parayla kaç ay dayanırız, hesapladın mı?"* Oyuncu tıklarsa kısa bir Defter kartı açılır.
3. **Kullan.** Kavram öğrenilince onunla ilgili **gösterge veya araç açılır**. Runway'i öğrenen oyuncunun HUD'ında runway sayacı belirir. LTV:CAC'ı öğrenen reklam panelinde oranı görmeye başlar.

**Bundan çıkan kural:** HUD baştan kalabalık başlamaz. Garajda sadece kasa, kullanıcı ve moral görünür. Oyuncu öğrendikçe panosu dolar. Bilgi toplamak bu sayede ilerlemenin kendisi olur.

**Metin kuralları**
- Balon cümlesi en fazla 12 kelime. Konuşma dili, suçlamasız.
- Defter kartı üç satırdan oluşur: **Ne?**, **Sen nerede gördün?** ve **Kural**. Kartın toplamı 50 kelimeyi geçmez.
- "Sen nerede gördün?" satırı oyuncunun kendi verisiyle dolar. Örnek: *"Geçen ay 4.2K yaktın, kasanda 11K var, yani 2.6 ay."*

---

## 3. Mekân: izometrik ofis ve merkezden kenara slotlar

### 3.1 Aşamalar ve ofisler

Her yatırım turunda oyuncu yeni ve daha büyük bir ofise taşınır. Mobilyalar taşınırken bedava yeni ofise geçer. Yeni ofis daha fazla halkayla ama çoğu kilitli halde başlar.

| Aşama | Ofis | Halka | Toplam slot | Hedef değerleme | Tur | Hisse | Açılan yeni şey |
|---|---|---|---|---|---|---|---|
| 0 Garaj | Garaj | 1 | 4 | — | — | — | Masa slotu, elle kullanıcı bulma |
| 1 Pre-seed | Coworking köşesi | 2 | 10 | $500K | $150K | %10 | Ortak alan slotu, cap table |
| 2 Seed | Küçük ofis | 3 | 18 | $3M | $800K | %15 | Oda slotu (toplantı), fiyat ayarı |
| 3 Series A | Açık plan kat | 4 | 30 | $15M | $4M | %18 | Reklam bütçesi, LTV:CAC paneli |
| 4 Series B | İki katlı ofis | 5 | 44 | $75M | $20M | %15 | Sunucu odası, kurumsal satış |
| 5 Series C | Bina | 6 | 60 | $300M | $150M | %12 | Özel slotlar (sahne, lab) |
| 6 Unicorn | Kampüs | — | — | $1B | — | — | Final sahnesi |

> Tur tutarları ve hisse oranları repodan alındı. Slot sayıları başlangıç değeri, denge simülasyonuyla ayarlanacak. **[DENGE]**

### 3.2 Halka yapısı

- Merkezde **kurucu masası** var, kaldırılamaz.
- **1. halka** kurucunun hemen etrafı, çekirdek ekip buraya oturur.
- Dış halkalar para verilerek açılır. Açma bedeli tek seferlik bir yenileme maliyeti artı aylık kira artışıdır. Oyuncu büyümenin kira bedelini böylece doğrudan hisseder.
- Bir halka açılmadan bir sonrakine geçilemez. Ofis gözle görülür şekilde içten dışa büyür.
- Görsel olarak kilitli halkalar karanlık ve tozlu durur. Açılınca bir "tadilat" animasyonuyla aydınlanır.

### 3.3 Slot tipleri

| Tip | İçine ne girer | Ne işe yarar |
|---|---|---|
| **Masa** | Departman masası (basit → ergonomik → çift ekranlı) | 1 çalışan oturur. Masa kalitesi o kişinin verimini artırır. |
| **Ortak alan** | Kahve köşesi, mutfak, oyun köşesi, bitkiler | Komşu masalara moral aurası |
| **Oda** (2 slot kaplar) | Toplantı odası, sunucu odası, kitaplık, telefon kabini | Sistem düzeyinde etki (koordinasyon, kapasite, öğrenme) |
| **Özel** | Demo sahnesi, AR-GE lab, podcast stüdyosu | Aşama ödülü, itibar veya özel aksiyon |

### 3.4 Komşuluk kuralları

Kurallar az ve okunaklı tutulur. Seçilen slota hover yapınca etki alanı zemin üzerinde parlar.

1. **Ortak alan aurası:** Bitişik masalara +moral hedefi. Eşya kalitesine göre +3 ile +8 arası.
2. **Departman kümesi:** Aynı departmandan 3 veya daha fazla masa yan yanaysa o departmanın verimi +%10.
3. **Toplantı odası:** Ekip 6 kişiyi geçince koordinasyon cezası başlar. Toplantı odası bu cezayı kaldırır. Erken ölçekleme dersi buna bağlı.
4. **Kitaplık:** Açılmış her Defter kartı kitaplıkta bir kitap olarak görünür. Kitaplık küçük bir global moral bonusu verir.

---

## 4. Oyun döngüsü ve zaman

### 4.1 Zaman modeli
- 1 oyun günü = 2 sn, 1 ay = 30 gün = 60 sn (1x hızda).
- Hız seçenekleri: duraklat / 1x / 2x / 4x.
- HUD'da gün, ay ve aşama görünür.
- Engine, render'dan bağımsız **sabit tick** ile çalışır (§8).

### 4.2 Ana döngü (dakika ölçeği)
```
işe al → masa gerekir → slot gerekir → halka aç (kira ↑)
   ↓
çalışan üretir → proje olgunlaşır → kullanıcı gelir → MRR
   ↓
kasa büyür veya erir → karar balonları → tur topla → taşın
```

### 4.3 Kurucunun görünür hali
Kurucu ofiste yürüyen bir karakterdir. Hangi aksiyonu yapıyorsa o görünür. Kullanıcı aramaya çıkarsa kapıdan çıkar, yatırımcıyla görüşüyorsa toplantı odasına girer.

### 4.4 Aktif kurucu aksiyonları
Bu aksiyonlar ölü süreyi öldürür. Hepsi kısa cooldown'lıdır ve bir kavramı hissettirir.

| Aksiyon | Açıldığı aşama | Etki | Hissettirdiği kavram |
|---|---|---|---|
| **Elle kullanıcı bul** | Garaj | 1 gün sürer, +3–6 sadık kullanıcı gelir (düşük churn) | Kapı kapı dolaşmak |
| **Kullanıcıyla konuş** | Garaj | Seçili projenin olgunluğuna +bonus | Ürün-pazar uyumu |
| **Ekibi motive et** | Pre-seed | Kısa süreli +moral, kurucunun enerjisi düşer | Kurucu burnout |
| **Yatırımcıyla kahve** | Pre-seed | Tur sürecini kısaltır | Tur zaman alır |
| **Satış görüşmesi** | Seed | Tek bir büyük müşteri | Concentration risk (fazla kullanırsan) |

> **Kurucu enerjisi:** Aktif aksiyonlar enerji harcar, enerji günlük olarak yenilenir. Kurucuyu fazla kullanmak burnout kararını tetikler.

---

## 5. Ekonomi matematiği (yeniden kurgu)

Hedef: eski modeldeki 30'a yakın iç içe formül yerine **8 ana değişken**. Her formülün tek bir sebebi ve ekranda görünür bir karşılığı olacak.

> Aşağıdaki sabitler başlangıç değeridir. Tamamı `balance.ts` içinde yaşar, denge simülatörüyle ayarlanır. **[DENGE]**

### 5.1 Ana değişkenler

| Değişken | Aralık | Nerede görünür |
|---|---|---|
| `cash` Kasa | $ | HUD, her zaman |
| `users` Kullanıcı | adet | HUD, her zaman |
| `morale` Moral | 0–100 | HUD + karakter halleri |
| `reputation` İtibar | 0–100 | Kavram açılınca |
| `maturity[p]` Proje olgunluğu | 0–1 | Proje panelinde |
| `arpu` Kullanıcı başı gelir | $/ay | Kavram açılınca |
| `churn` Aylık kayıp oranı | % | Kavram açılınca |
| `equity` Kurucu hissesi | % | Cap table kavramıyla |

### 5.2 Üretim
```
verim(kişi)   = temelÇıktı[dept] × masaKalitesi × moralÇarpanı × komşulukBonusu
moralÇarpanı  = 0.5 + moral / 100                 // 0.5 – 1.5
koordinasyon  = ekip > 6 ve toplantıOdası yok → × (1 − 0.03 × (ekip − 6)), en fazla −%30
```

### 5.3 Ürün
```
olgunluk += (müh×1.0 + ürün×0.5) × hız / projeBüyüklüğü     // atanan kişiler üzerinden
yayın     = olgunluk ≥ 0.2  (MVP)
paralel proje cezası (Garaj–Seed) = her ek proje için tüm projelerde −%20 hız   → "Odak" dersi
```

### 5.4 Kullanıcı
```
kapasite   = max(50, müh × 1500)
aşırıYük   = max(0, users / kapasite − 1)

organik/ay = pazarlama × 25 × (0.5 + itibar/100) × ortOlgunluk
reklam/ay  = reklamBütçesi / CAC
CAC        = 8 × 1.3^aşama / kalite ,   kalite = 0.5 + ortOlgunluk
churn/ay   = 0.06 × (1 − min(0.6, ops × 0.02)) × (1 + aşırıYük) × (1.5 − ortOlgunluk)
```
Olgunluk düşükken reklamla gelen kullanıcı hızla gider. Bu, "ürün-pazar uyumu olmadan ölçekleme delik kovaya su doldurmaktır" dersinin kendisi.

### 5.5 Gelir
```
arpu       = 4 × 1.15^aşama × fiyatÇarpanı × (1 + min(0.8, satış × 0.04)) × (0.3 + 0.7 × ortOlgunluk)
MRR        = users × arpu
fiyatÇarpanı: oyuncunun ayarı (0.7 – 1.6), Seed'de açılır
fiyat artışı → 1 ay boyunca churn × (1 + (fiyatÇarpanı − 1) × 0.8)
```

### 5.6 Gider
```
burn = maaşlar + kira + altyapı + reklamBütçesi
maaş(kişi) = temelMaaş[dept] × 1.5^aşama
kira       = ofisTabanKirası[aşama] + açıkHalkaSayısı × halkaKirası[aşama]
altyapı    = users / 1000 × 10 × (sunucuOdası ? 0.8 : 1)
net        = MRR − burn
runway     = net < 0 ? cash / −net : ∞
```

### 5.7 Moral
```
hedef = 60 + ortakAlanAuraları + kararBonusları + kitaplık
        − 40 (kasa < 0 iken) − 15 × aşırıYük − koordinasyonCezası
moral hedefe yavaşça yaklaşır (günde %5)
moral < 28 → istifa riski (çalışan kapıya yürür, 3 gün içinde "kalsın mı" balonu çıkar)
```
İstifa rastgele ve anlık değil. Oyuncuya görünür bir uyarı ve müdahale penceresi verilir (rastgele ceza yok ilkesi).

### 5.8 Değerleme
```
gelir öncesi (MRR < 1K):  değerleme = 60K × ekip + 150 × users + 200K × yayındakiProje
gelir sonrası:            değerleme = MRR × 12 × çarpan
çarpan = clamp(4, 30, 6 + 150 × aylıkBüyüme)        // aylıkBüyüme = MRR MoM
```
Yatırımcının **büyümeyi fiyatladığı** doğrudan hissedilir. Aynı MRR, hızlı büyüyen bir şirkette çok daha değerli.

### 5.9 Yatırım turu (yeni mekanik)
- Değerleme hedefe ulaşınca **"Tur başlat"** açılır.
- Tur anlık kapanmaz, **4–8 hafta** sürer. Süreyi kurucunun yatırımcı görüşmeleri kısaltır.
- Tur süresince metrikler düşerse teklif küçülür. Kasa tur bitmeden biterse oyuncu köprü kredisi kararıyla karşılaşır.
- Tur kapanınca +kasa, −hisse, +10 moral, +15 itibar ve **taşınma sahnesi**.
- Bu mekanik "runway'ini yarıya böl, turu erken başlat" dersini yaşatır.

### 5.10 İflas ve yeniden başlama
- Kasa 60 gün boyunca ekside kalırsa veya ekip sıfıra inerse oyun biter.
- Post-mortem ekranında 3 neden gösterilir: oyuncunun kendi verisinden ve ilgili Defter kartlarından çıkarılır.
- Founder XP kazanılır: bir sonraki oyunda başlangıç kasası +%10 × XP (en fazla +%40).

---

## 6. Öğretim sistemi ve içerik

### 6.1 Veri modeli
```ts
type Concept = {
  id: string
  stage: number                 // en erken görünebileceği aşama
  trigger: (s: GameState) => boolean
  speaker: NpcRole              // mentor, ortak, muhasebeci, mühendis, yatırımcı, müşteri
  bubble: string                // ≤ 12 kelime
  card: { what: string; where: (s: GameState) => string; rule: string }
  unlocks?: HudWidget | Tool    // açtığı gösterge veya araç
  shelfColor: string            // kitaplıktaki kitabın rengi
}
```
- Her kavram oyun başına **bir kez** tetiklenir.
- Aynı anda en fazla 1 kavram balonu ekranda bulunur. Sıradakiler kuyrukta bekler.
- Balon 20 sn tıklanmazsa küçülüp kişinin başında ikon olarak kalır, kaybolmaz.

### 6.2 Kavram kataloğu (yeniden yazılmış)

Repodaki 20 Defter dersi ve yaklaşık 45 ipucu birleştirildi, tekrarlar çıkarıldı. Her biri bir mekaniğe bağlandı.

#### Garaj
| id | Tetik | Balon | Kural | Açar |
|---|---|---|---|---|
| `runway` | 10. gün | "Bu parayla kaç ay dayanırız, hiç hesapladın mı?" | İşe alım yapmadan önce runway'in kaç aya ineceğine bak. | Runway sayacı |
| `burn` | İlk işe alımdan sonraki ay | "Geçen ay bu kadar para yakmıyorduk. Ne değişti?" | Yeni masrafı onaylamadan önce burn'e ekle, sonra karar ver. | Gider kırılımı |
| `dont-scale` | İlk kez "Elle kullanıcı bul" | "Reklamı boş ver. Kullanıcıların bu ürünü neden açıyor, biliyor musun?" | Bu hafta bir kullanıcınla oturup konuş. | — |
| `pmf` | Olgunluk < 0.4 ve churn > %8 | "Denedim, fena değil ama bir daha açmadım açıkçası." | Kullanıcıların her ay %8'den fazlası gidiyorsa reklam açma. | Tutunma göstergesi |
| `focus` | Garajda 2. proje açılınca | "Yeni projeye mi geçiyoruz abi? Öbürü ne olacak?" | Birini bitirmeden yeni proje açma. | — |
| `default-alive` | İlk kez MRR > 0 | "Yatırımcı hiç gelmese, bu gidişle kâra geçer misin?" | Farkı zamanında kapatamayacaksan gideri kıs ya da yatırım ara. | Kâr projeksiyon çizgisi |

#### Pre-seed
| id | Tetik | Balon | Kural | Açar |
|---|---|---|---|---|
| `dilution` | İlk yatırım teklifi | "Parayı getiririm, karşılığında şirketinden biraz isterim. Adil, değil mi?" | Turu imzalamadan önce elinde yüzde kaç kalacağına bak. | Cap table pastası |
| `safe` | Melek yatırımcı kartı | "Parayı bugün vereyim, fiyatı sonraki turda konuşuruz. Anlaştık mı?" | SAFE imzalamadan önce hissenden ne kadar gideceğini hesapla. | — |
| `fundraise-time` | İlk tur başlatılınca | "Tur başladı. Para gelene kadar kasa dayanır mı, baktın mı?" | Kasan en az 6 ay yetiyorken turu başlat. | Tur süresi göstergesi |
| `hire-bar` | 3. işe alım | "Ekip büyüyor abi. Hepsi gerçekten iyi mi, yoksa acele mi ettik?" | Emin değilsen alma. Yanlış aldıysan hemen çıkar. | Aday kalite göstergesi |
| `morale-compounds` | İlk kez moral < 50 | "Ekip bitik abi, bu tempoyla daha ne kadar gideriz?" | Moral 50'nin altındaysa ekibin yükünü hafiflet, kasayı eksiye düşürme. | Ofis moral ısı haritası |

#### Seed
| id | Tetik | Balon | Kural | Açar |
|---|---|---|---|---|
| `churn` | users > 300 ve churn > %5 | "Bir ay kullandım, sonra bıraktım. Neden diye soran olmadı." | Yeni kullanıcı aramadan önce gidenin neden gittiğini sor. | Churn göstergesi |
| `pricing` | ARPU düşük, users > 500 | "Bu fiyata mı? Açıkçası iki katını da verirdim." | Fiyatı küçük adımla artır, bir ay churn'e bak. | Fiyat ayarı |
| `feature-vs-product` | Yeni proje açılırken | "Yeni proje mi açtın? Elimizdekine eklesek olmaz mıydı?" | Yeni proje açmadan önce kimin kullanacağını tek cümleyle yaz. | — |
| `premature-scaling` | ekip ≥ 6 ve users < 300 | "Masalar doldu, maaşlar arttı, kullanıcı hâlâ bir avuç, abi." | Kullanıcı artmıyorsa yeni kişiyi alma. | Koordinasyon uyarısı |

#### Series A
| id | Tetik | Balon | Kural | Açar |
|---|---|---|---|---|
| `ltv-cac` | Reklam bütçesi ilk kez açılınca | "Her kullanıcıya reklam parası saydık. Gidene kadar bunu çıkarır mı?" | Oran 1'in altındaysa reklamı kes, 3'ün altındaysa kıs. | LTV:CAC paneli |
| `organic-vs-paid` | Reklam payı > %70 | "Reklamı bir hafta kapatsan kaç kişi yine gelir?" | Pazarlamacı al, reklam payını 10'da 7'nin altına çek. | Kanal kırılımı |
| `tech-debt` | 3. crunch veya aceleci proje kararı | "Aceleyle yazdığımız kod şimdi her işte ayağıma dolanıyor." | Borç 5 puanı geçince ilk temizlik teklifine evet de. | Borç sayacı |
| `ten-x-myth` | Yıldız çalışan kartı | "Yıldızımız yarın giderse bu işi başka bilen var mı?" | Karşı teklif verme, işini bir ekip arkadaşına öğrettir. | — |
| `culture-freezes` | Ekip 15 | "Kalabalıklaştık abi, yeni gelenler bizi taklit ediyor." | Moral 60'ın altındaysa yükü dağıt, değerleri ekiple yaz. | Kültür rozeti |

#### Series B–C
| id | Tetik | Balon | Kural | Açar |
|---|---|---|---|---|
| `concentration` | Tek müşteri > MRR'ın %30'u | "En büyük müşterinin sözleşmesi bittiği gün gelir bir kalemde düşer." | Kurumsal müşteri ekle, en büyüğünün payını %30'un altına indir. | Gelir dağılımı |
| `compliance` | Kurumsal satış açılınca | "Verilerim nerede duruyor? Belgeyi görmeden imza atmam." | Veri denetimi gelince danışman tut, evrakı tamamla. | — |
| `trough` | MoM büyüme 2 ay boyunca < %2 | "İki aydır grafik dümdüz. Şimdi neyi değiştireceksin?" | Bu ay tek bir şeyi değiştir, ay sonunda sayıya bak. | — |
| `cap-table-health` | Kurucu hissesi < %35 | "Şirketin kaçta kaçı hâlâ senin, en son ne zaman baktın?" | Turda 18 ay yetecek kadar para al, fazlasını payınla ödersin. | — |
| `no-single-path` | Arketip tespit edilince | "Tarzın belli oldu. Rakibin başka yoldan gidiyor, sence kim yanlış?" | Rakibi kopyalamadan önce kendi kasana ve büyümene bak. | Arketip rozeti |

#### Her aşamada
| id | Tetik | Balon | Kural |
|---|---|---|---|
| `founder-burnout` | Kurucu enerjisi 5 gün boyunca < %20 | "Hiç durmadın. Bir gün de biz bakalım şirkete." | Enerjin %20'ye yaklaşınca bir gün izin al. |
| `failure-is-data` | İflas | "Kapandı. Otur bakalım, neyi farklı yapardın?" | Suçlu arama, sebebi bul. Yeni şirkete onu bilerek başla. |

### 6.3 Karar kartları

Repodaki 93 kart şu kurallarla yeniden yazılır:
- Soru en fazla 2 cümle. Konuşan bir NPC'nin balonundan gelir.
- 2 seçenek, bazen 3. Her seçeneğin altında **görünür takas** yazar: kazanç / bedel.
- Sonuç satırı en fazla 1 cümle ve bağlı olduğu kavramın Defter kartına bağlantı içerir.
- `cashPercent` gibi farm edilebilen efektler üst sınırla gelir.
- Hiçbir kart oyuncuyu yanlış seçim için azarlamaz.

**v1 seçimi, yaklaşık 45 kart, aşamaya göre:**
- **Garaj:** `early-focus`, `early-channel`, `early-sidegig`, `early-burnout`, `early-feedback`, `early-equity-split`, `friends-family`
- **Pre-seed:** `angel-1`, `accelerator-invite`, `grant-opportunity`, `key-hire`, `cofounder-conflict`, `advisor-equity`, `pmf-hypothesis-width`
- **Seed:** `seed-termsheet`, `press-launch`, `negative-review`, `pricing-change`, `feature-request-flood`, `remote-vs-office`, `culture-values`, `hiring-bar-vs-speed`, `d7-retention-drop`, `server-crash`
- **Series A:** `vc-board-seat`, `ad-spend-temptation`, `growth-hack`, `viral-tiktok`, `technical-debt-vote`, `star-resign`, `crunch-vs-launch`, `b2b-opportunity`, `custom-feature-trap`, `blitzscale-pressure`
- **Series B:** `enterprise-rfp`, `whale-churn`, `gdpr-audit`, `cloud-bill-shock`, `talent-raid`, `international-launch`, `market-downturn`
- **Series C:** `acquisition-offer`, `strategic-investor`, `secondary-sale`, `founder-burnout`, `ipo-vs-stay-private`
- **Kriz (her aşama):** `payroll-risk`, `vc-bridge-loan`, `emergency-bridge`
- **Rakip (baskı ≥ 0.35):** `rival-price-war`, `rival-talent-raid`, `rival-copycat-feature`

Kalan kartlar v2 havuzudur.

### 6.4 Ofis sesleri
Eski `onHire`, `onMilestone` ve `onCrisisResolved` satırları ofisteki karakterlerin **ortam balonlarına** dönüşür. Bunlar kısa, tıklanmaz ve 3 sn görünür. Duruma göre seçilir: kâra geçen şirkette runway paniği satırı çıkmaz. Kutlamalar da (ilk 100 ve 1000 kullanıcı, ilk MRR, ilk kâr ayı) ofiste konfeti ve ekip alkışı olarak gösterilir.

---

## 7. Sunum: ofis, karakterler, arayüz

### 7.1 Görsel dil
- **Kamera:** Sabit izometrik, ortografik. Zoom seviyeleri sınırlı. Ofis ortada, halkalar dışa doğru açılır.
- **Stil:** Low-poly, flat shading, pastel palet, yumuşak gölge. Her şey Three.js primitive'lerinden kod ile üretilir: kutu, silindir, küre, ekstrüzyon.
- **Palet:** Tek `palette.ts` dosyası. Her aşamanın zemin ve duvar tonu farklı. Garaj beton grisi, kampüs sıcak ahşap.
- **Karakterler:** Basit gövde ve kafa, departman renginde kıyafet, küçük aksesuarlar (kulaklık, gözlük). Başın üstünde durum ikonu.

### 7.2 Karakter halleri
Bu haller, sayıların yerine oyuncuya durumu gösterir.

| Hal | Görünüm |
|---|---|
| Çalışıyor | Masada, klavye animasyonu |
| Yorgun (moral < 40) | Yavaş yürüme, esneme |
| Tükenmiş (moral < 28) | Başında bulut, kapıya bakıyor |
| Aşırı yük | Sunucu rafında kırmızı ışık, mühendisler koşturuyor |
| Mola | Ortak alanda kahve |
| Yeni kişi | İlk 3 gün etrafı gezen onboarding yürüyüşü |

### 7.3 NPC ziyaretçiler
Yatırımcı, mentor, müşteri ve gazeteci kapıdan girip ilgili yere yürür. Karar kartları ve kavram balonları bu karakterlerden gelir.

### 7.4 Arayüz
- **Üst sol:** Kasa (+ aylık net), kullanıcı, moral. Diğer göstergeler kavramlar öğrenildikçe eklenir.
- **Üst orta:** Aşama adı, gün/ay, aşama ilerleme çubuğu (değerleme / hedef), hız kontrolleri.
- **Üst sağ:** Dil, ekran görüntüsü, zoom, ses, ayarlar.
- **Alt dock:** Mağaza · Ekip · Projeler · **Büyüme** · Defter. Büyüme sekmesinde ürün, kanal ve fiyat ayarları var. Defter kitaplığı açar.
- **Sağ detay paneli:** Seçilen bir slota, çalışana veya projeye tıklayınca açılır. Solunda o nesnenin yakın çekim 3D görünümü, sağında metrikler ve aksiyon butonları var (işe al, çıkar, yükselt, taşı, sat).
- **Alt sol aktivite satırı:** "Mira kullanıcı aramaya çıktı…", "Tur görüşmesi sürüyor (3/6 hafta)".
- Kart tasarımı yuvarlak köşeli, krem ve pastel yüzeyli. İkonlar SVG olarak inline gelir.

---

## 8. Teknik mimari

### 8.1 Stack
| Katman | Seçim | Neden |
|---|---|---|
| Build | **Vite** + TypeScript | Oyun tamamen istemcide çalışır, SSR gerekmez. |
| 3D | **React Three Fiber** + drei | Three.js'i React bileşen modeliyle yönetmek için |
| UI | React + Tailwind | Mevcut stack'le uyumlu |
| State | **zustand** | Engine state'ine abone olan hafif store |
| Test | Vitest | Formül ve tetik testleri için |
| Kayıt | localStorage, versiyonlu şema + migrasyon | Backend yok |

> Varsayım: Next.js gerekmediği varsayıldı. Bir landing sayfası isteniyorsa ayrı bir Next.js sitesi olarak kurulur, oyun oraya gömülür.

### 8.2 Katmanlar
```
engine/   saf TS, DOM ve Three bağımsız, deterministik (seeded RNG)
  state.ts        GameState tipi
  tick.ts         sabit adım: step(state, dtDays) → state
  economy.ts      §5 formülleri
  concepts.ts     tetik değerlendirme
  decisions.ts    kart seçimi ve efekt uygulama
  balance.ts      tüm sabitler
content/  kavramlar, kartlar, ofis sesleri, mobilya kataloğu (TS veri)
render/   R3F sahnesi: ofis, halkalar, slotlar, karakterler, NPC'ler
ui/       HUD, dock, paneller, balonlar
sim/      node denge simülatörü: engine'i doğrudan import eder
```

### 8.3 Kurallar
- **Engine render'dan habersiz.** Render sadece state'i okur ve bir aksiyon kuyruğuna yazar.
- **Tek tick fonksiyonu.** Oyun ve simülatör aynı `step()`'i çağırır. Eski projedeki sim–kod ayrışması bu şekilde yapısal olarak engellenir.
- **Deterministik.** Seed + aksiyon listesi aynıysa sonuç da aynı olur. Hata raporu tekrar üretilebilir.
- **Denge simülatörü** 4 arketip bot oynatır: Bootstrap, VC-Roket, Niş, Platform. Rapor üretir: her aşamaya varış süresi, iflas oranı, ilk 10 dakikadaki kavram sayısı.

---

## 9. Yol haritası

| Faz | Çıktı | Bitti sayılması için |
|---|---|---|
| **M0 Engine** | `engine/` + `balance.ts` + Vitest | Garaj → Pre-seed konsolda oynanabiliyor |
| **M1 Sim** | Arketip botları + rapor | 4 bot da Pre-seed'e ulaşıyor, süreler raporlanıyor |
| **M2 Garaj sahnesi** | İzometrik garaj, 1 halka, masa slotları, karakterler | İşe al → masa koy → çalışan oturup çalışıyor |
| **M3 HUD + ekonomi bağlantısı** | Kasa, kullanıcı, moral, hız kontrolü, dock | Garajda 10 dk oynanabiliyor |
| **M4 Öğretim sistemi** | Kavram motoru, balonlar, Defter, kitaplık, gösterge açılımı | Garaj kavramlarının 6'sı da doğru anda tetikleniyor |
| **M5 Kararlar + NPC** | Garaj ve Pre-seed kartları, ziyaretçi NPC'ler | Kart balonu → seçim → yansıma → Defter |
| **M6 Aşamalar + taşınma** | Tur mekaniği, 6 ofis, halka açma | Unicorn'a baştan sona ulaşılabiliyor |
| **M7 Denge + cila** | Sim ayarı, ses, animasyon, post-mortem | §10 kriterleri tutuyor |

---

## 10. Başarı kriterleri

- Garaj'dan Unicorn'a **60–90 dk**. Dört arketip arasında süre farkı ≤ 1.3×.
- İlk 5 dakikada en az 3 kavram öğreniliyor. Garajda dikkatsiz oynayan oyuncu 4 dakikadan önce batmıyor.
- İki anlamlı aksiyon arası **ölü süre ≤ 10 sn**.
- Aynı anda en fazla 1 blocking modal.
- Her aşama en az 1 yeni slot tipi, 3 yeni kavram ve 1 yeni gösterge açıyor.
- 60 fps orta segment dizüstünde, Series C ofisi ve 60 karakterle.

---

## 11. Açık sorular

1. **Dil:** v1 sadece Türkçe varsayıldı. Metinler yine de anahtarlı tutulacak. EN baştan gerekiyor mu?
2. **Oyun adı:** "Be Unicorn" korunuyor mu?
3. **Mobil web:** Dokunmatik ve dar ekran v1'de hedef mi, yoksa masaüstü öncelikli mi?
4. **Mobilya kataloğu:** Repodaki 70 eşyalık katalog slot tiplerine göre yaklaşık 30'a indirilecek. Özellikle korunmasını istediğin eşyalar var mı (helikopter pisti gibi)?
