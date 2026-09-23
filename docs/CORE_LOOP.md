# Be Unicorn — Core Loop Tasarımı: "Nabız Döngüsü + Sürüm Anı"

> Durum: öneri (henüz uygulanmadı, DECISIONS'a girmedi). Tarih: 2026-09-23.
> Temel: jürinin kazananı **feedback-juice** (toplam 119/150). Aşılananlar: **tycoon**'dan sürüm anı ve maaş günü, **decision-driven**'dan ufuk şeridi, tur büyüklüğü seçimi ve telegraflanan kriz, **teaching-first**'ten due-diligence listesi ve "Kararın → sonucu" satırı.
> İlgili: PLAN.md §1–§10, DECISIONS.md #12–#13, DESIGN.md `--color-speed-*`, CONTRACTS.md.

---

## 1. Teşhis özeti

### Kullanıcının söyledikleri
1. "Zaman ben karar verirken akmamalı. Focus problemi var. En başta direkt süre sayarak geliyor."
2. "Başladı mı, zaman akıyor mu, para eriyor mu hiç belli değil."
3. "Hızın durumu border renginden okunsun: kırmızı, sarı, turuncu, yeşil gibi."
4. "Oyunun core loop'unu sevmedim, orası iyi kurgulanmalı."

### Kodda bugün ne var (commit `0239776` sonrası)
1–3 numaralı maddelerin bir kısmı zaten yapıldı:
- Yeni oyun ve "Devam et" duraklı açılıyor (`gameStore.pausedStart`, `ui.runStarted`), sahnede "▶ Başlat" çağrısı var (`time.tsx StartCall`).
- Tek duraklatma mekanizması `ui.pauseReasons` (`modal | decision | concept`), panel ve overlay'den türetiliyor. Otomatik duraklatma `setSpeed` olarak yazılmıyor.
- Hız renk kodu HUD kartında, segmentlerde ve mobil butonda var (`SPEED_COLOR`). Duraklıyken sahneye `PauseVeil` iniyor. Kasa tween'li, "−$X/gün" ve günlük delta gösteriyor.

Kalan boşluklar:
- **Genişletilmiş karar balonu** (`DecisionBubble.tsx`, `expanded`) duraklatma sebebi sayılmıyor. Kart sahnede okunurken zaman akıyor.
- **Kavram balonu** 20 sn **gerçek zamanla** küçülüyor (`CONCEPT_MINIMIZE_MS`). Duraklıyken bile sayaç işliyor.
- **Karar ziyaretçisi** 20 oyun gününde gidiyor (`DECISION_VISITOR_DAYS = 20`, 1×'te 40 sn). Kart zamanlı sınav gibi hissettiriyor.
- Renk yalnızca HUD kartında. Ekranın kenarında **viewport çerçevesi** yok, oto-duraklatmada seçili hız ayrıca gösterilmiyor.
- `createGame.ts:22` hâlâ `speed: 1` (store eziyor ama sim ve engine tarafında tutarsızlık var).

### Sistemdeki kanıtlı sorunlar (sim ve analiz)
| # | Sorun | Kanıt |
|---|---|---|
| S1 | Garajda para erimesi görünmüyor | Net −$300/ay = −$10/gün. İdle oyuncu 30. dakikada hâlâ $21K'da. İlk batış 102. dakikada. |
| S2 | İlk turdan sonra para kısıt değil | 32/32 koşuda iflas %0. Series B'de kasa 24M, runway yüzlerce ay. |
| S3 | Kararlar sonucu değiştirmiyor | En iyi, en kötü, hep ilk ve hep son seçenek politikalarında Unicorn süresi neredeyse aynı (bootstrap 20–24 dk). 108 seçenekten 14'ünde gecikmeli etki var, gecikme 28–180 sn. |
| S4 | Baskın strateji: "Kullanıcı bul" spamı | niche'te 2735 kez, diğer tüm aksiyonların toplamından fazla. Cooldown 2 sn. |
| S5 | Değerleme çarpanı tavana yapışıyor | `clamp(4,30,6+150×MoM)`, MoM ≥ %16'da hep 30×. Tersine büyüme mutlak kalınca çöküyor (niche s3: MRR 5×, değerleme sabit). Oyuncuya açıklanmıyor. |
| S6 | Ölü süre hedefin çok üstünde | Anlamlı aksiyon aralığı medyanı 6–16 sn, en uzun boşluk 56–178 sn (tur beklemesi). Hedef ≤ 10 sn. |
| S7 | Garajda ölü başlangıç | Proje yok, çalışan yok, hedef yok. Masa gerektiğini oyuncu ancak `noDesk` hatasından öğreniyor. |
| S8 | Tempo kısa, aşamalar arası yeni fiil yok | Unicorn 18–25 dk'da (hedef 60–90). Her aşama "sayı dolsun, tur bas". |
| S9 | Ayın bir "anı" yok | Gider günlük dağıtılıyor (`tick.ts:54`). Ay kapanışı yalnızca log satırı. |

Kısacası kullanıcının 4. şikayeti haklı. Döngü şu an **"MRR büyüsün, bekle, tur bas"**. Oyuncunun yaptığı iş, cooldown'u dolan butona basmak.

---

## 2. Tasarım özü

Be Unicorn'da **zamanın sahibi oyuncudur**. Oyun duraklı açılır, oyuncu okurken ya da karar verirken zaman durur, akarken de zamanın ve paranın aktığı ekranın kenarından, kasadan ve sahneden okunur. Oyun üç ritimle çalışır. **Gün nabzı** (2 sn): kasa tık tık erir, kurucu hamlesi biter, kullanıcı kapıdan girer. **Ay vuruşu** (60 sn): ayın 1'inde maaş ve kira tek kalemde düşer, ay fişi hesabı gösterir, oyuncu parayı yeniden yatırır. Ayın ortasında bir **sürüm anı** gelir: ürün yayına çıkar, kullanıcı dalgası kapıdan girer. **Tur penceresi** (aşama başına 1–2 dk): değerleme hedefin %60'ına gelince "şimdi mi, biraz daha mı?" kararı açılır, haftalık canlı teklif ve pitch seçimiyle geçer. Tur parası yeni burn'e göre ~18 ay runway verecek şekilde ölçülür, böylece para her aşamada kısıt kalır. "Sıradaki adım" çipi ana zincirin bir sonraki halkasını, ufuk şeridi yaklaşan maaş gününü ve gecikmeli karar etkilerini gösterir. Kararlar azalır ama ağırlaşır. Her kavram, döngünün bir vuruşunda hissedilir, adı konur ve bir araca dönüşür.

---

## 3. Zaman modeli

### 3.1 Birimler (değişmiyor)
- 1× hızda 1 gün = 2 sn, 1 hafta = 14 sn, 1 ay = 60 sn. Engine sabit 0.25 günlük alt adımla ilerler (`tick.ts step`), sim ve oyun aynı fonksiyonu kullanır.
- Hızlar: ⏸ / 1× / 2× / 4×. 2× orta oyunun, 4× tur penceresinin ve sürüm beklemesinin hızıdır.

### 3.2 Kurallar
1. **Duraklı başlangıç.** Yeni oyun, "Devam et" ve her taşınmadan sonraki yeni ofis duraklı açılır (`time.speed = 0`, `ui.runStarted = false`). Tek çağrı "▶ Başlat" ve yanında sıradaki adım. Space, 1, 2, 3 tuşları da başlatır. Duraklıyken planlama serbesttir: proje seçmek, masa koymak, işe almak. `createGame` de `speed: 0` ile başlar, böylece sim ile oyun tutarlı olur.
2. **Odak duraklatma, tek mekanizma.** `ui.pauseReasons` şunlardan türetilir:
   - `modal`: taşınma, post-mortem, zafer, term sheet
   - `decision`: cevaplanmamış karar kartı panelde açık **ya da sahnedeki karar balonu genişletilmiş** (yeni)
   - `concept`: Defter kartı açık
   - `offer`: tur teklifi ya da pitch kartı açık (yeni, Faz 2)

   Etkin hız, sebep yoksa `time.speed`, varsa 0. Otomatik duraklatma `setSpeed` olarak yazılmaz, replay ve kayıt oyuncunun seçtiği hızı tutar. Kart kapanınca önceki hıza dönülür. Oyuncu elle duraklattıysa duraklı kalır.
3. **Durdurmayanlar.** Mağaza, Ekip, Projeler ve Büyüme panelleri zamanı durdurmaz. Bunlar "oynarken yönet" yüzeyleridir. Kurma işi zaman akarken yapılır, düşünme işi (karar, kavram, teklif) duraklıyken. Karar ya da kavram balonunun sahnede **belirmesi** zamanı durdurmaz, yalnızca dikkat animasyonu ve kısa ses verir.
4. **Zamanlı kart yok.**
   - Karar ziyaretçisi 20 günde gitmez, bekleme koltuğuna oturur. Başında altın "!" olur, sayaç olmaz.
   - En fazla 1 aktif ve 1 bekleyen kart bulunur. Cevaplanmamış kart diğer kartları süresiz kilitlemez. 2 ay cevapsız kalırsa kartta baştan yazılı olan varsayılan seçenek uygulanır ("Cevapsız kalırsa: A").
   - Kavram balonunun küçülme sayacı **oyun zamanıyla** sayılır (10 oyun günü). Duraklıyken küçülmez.
5. **4×'te önemli an.** Oyuncu 4×'teyse, sürüm anı, maaş gününde runway'in 3 ayın altına düşmesi ya da tur teklifi gibi olaylar hızı 1×'e indirir, durdurmaz. Bu davranış Ayarlar'dan kapatılabilir ("Önemli anda yavaşla", varsayılan açık).
6. **Kart açık bırakmak serbest.** Tek oyunculu, öğretici bir oyunda kartı açık tutup düşünmek meşrudur. Sim, ölü süre metriğinde duraklı süreyi saymaz. Kart panelde "Sonra karar ver" ile küçültülünce zaman akmaya devam eder.

### 3.3 Hız rengi (kullanıcının 3. maddesi)
| Durum | Renk | Token | İkon/etiket |
|---|---|---|---|
| Duraklı (elle ya da başlangıç) | Kırmızı `#E0483E` | `--color-speed-pause` | ❚❚ "DURAKLATILDI · Space" |
| Odak duraklatma | Kırmızı, **kesik çizgi** | aynı | "Karar veriyorsun, zaman durdu" / "Defter açık" + soluk seçili hız ("2×'e dönecek") |
| 1× | Sarı `#D6A100` | `--color-speed-1` | ▶ |
| 2× | Turuncu `#EE7A14` | `--color-speed-2` | ▶▶ |
| 4× | Yeşil `#1F9D63` | `--color-speed-4` | ▶▶▶ |

Renk üç yerde görünür: (a) hız kontrolünün aktif segmentinde dolgu ve 2 px kenar, (b) **viewport çevresinde 3 px çerçeve** (mobilde 2 px, `pointer-events: none`, safe-area uyumlu), (c) tarih çipindeki gün halkası. Renk hiçbir zaman tek sinyal değildir: ikon, etiket ve düz/kesik çizgi farkı renk körlüğü için korunur. Runway uyarı renkleri **yalnızca kasa widget'ında** kullanılır, hız rengiyle karışmaz.

---

## 4. Döngüler

### 4.1 Saniye döngüsü: gün nabzı (2 sn)
Her oyun gününde:
- Kasa akıcı sayaçla düşer ya da artar. $100K altında tam dolar gösterilir ($30,000 → $29,950), üstünde kısa biçim.
- Widget'tan küçük bir "−$50" (kırmızı) ya da "+$120" (yeşil) süzülür. Yanında sabit "−$X/gün" etiketi durur.
- Tarih çipindeki gün halkası dolar, ekran çerçevesinde ince bir parlama dolaşır (1×'te 2 sn, 4×'te 0.5 sn).
- Kurucu hamlesi bittiyse sonucu sahnedeki kaynağından patlar ("+5 kullanıcı" kapının üstünde).

Olay bütçesi: akan zamanda son 8 sn içinde anlamlı bir vuruş olmadıysa, store zamanlayıcısı hazır bekleyen bir olayı öne çeker (ziyaretçi, aday, kullanıcı geri bildirim balonu). **Yeni olay yaratmaz**, ödül vermez, yalnızca mevcut olasılıksal olayların zamanlamasını değiştirir. Aynı tip için cooldown uygulanır, böylece farm edilemez.

### 4.2 Dakika döngüsü: bir ay (1× = 60 sn)
Örnek: Seed, 9 kişilik ekip.

| Zaman | Vuruş | Oyuncu ne yapar |
|---|---|---|
| 0–4 sn | **Maaş günü.** Kira, maaş ve altyapı tek kalemde düşer ("−$38K"). Paralar kasadan masalara uçar, kasa 300 ms kırmızı flaş yapar. **Ay fişi** şeridi HUD'ın altından kayar: "Gelir +$29K · Maaş −$31K · Kira −$4K · Reklam −$3K · Net −$9K · Runway 14 ay · büyüme %11 → 22×". Engellemez, 4 sn'de kapanır, tıklanınca Büyüme paneli açılır. | Fişi okur, bütçe kararı alır. |
| 4–20 sn | **Yeniden yatırım.** Sıradaki adım çipi bağlama göre bir halka önerir ("Kapasite %92 → sunucu halkası aç"). Her gider aksiyonunun yanında "/ay" ve "/gün" karşılığı yazar ("Halka aç: +$1.2K/ay"). | İşe alım, halka, reklam bütçesi. |
| 20–45 sn | **Ay ortası.** Ortalama 90 sn'de bir karar ziyaretçisi gelir. Açılınca zaman durur. Anlık etki hemen oynar, gecikmeli etki ufuk şeridine "⏳ 1 ay" işaretiyle yerleşir. Kurucu hamlesi (konuş, satış görüşmesi) enerji ve doygunlukla sınırlı bir seçimdir. | Karar, kurucu hamlesi. |
| 45–60 sn | **Sürüm anı** (ürün bir olgunluk eşiğini geçtiğinde, bkz. §5). Pankart açılır, "+340 kullanıcı · MRR +$2.1K" etiketi çıkar, figürler kapıdan içeri yürür. | Sonucu görür, bir sonraki eşiği planlar. |

Tur açıksa dakikaya haftalık bir vuruş eklenir (14 sn'de bir): "Hafta 3/6 · yatırımcı MRR'ye baktı · teklif $2.4M → $2.52M". Her hafta bir pitch seçimi yapılır.

4× hızda ay fişi yalnızca HUD'da bir deltaya iner (15 sn'de bir şerit spam olmasın). Kararlar yine zamanı durdurur.

### 4.3 Aşama döngüsü (hedef 8–14 dk/aşama, toplam 60–90 dk)
1. **Yerleşme (0–1 dk, duraklı açılır).** Taşınma sahnesinden sonra yeni ofis duraklı gelir. Sağ panelde **Aşama Hedefleri** kartı olur: ★ zorunlu hedef (değerleme, örn. Seed → $3M) ve iki ☆ opsiyonel hedef. Biri aşamanın yeni fiilini kullandırır ("Fiyatı ayarla, churn %6 altında kal"), biri kaliteye bakar ("MVP'yi v2 olgunluğuna taşı"). Opsiyonel yıldızlar kozmetik, mobilya kilidi ya da "daha iyi term sheet" (−%2 hisse) kazandırır. Kaçırmak cezasızdır.
2. **Kurulum (1–4 dk).** Yeni turun parasıyla işe alım, halka ve yeni slot tipi. Burn görünür biçimde sıçrar, maaş günleri büyür. Karar: "Parayı nereye gömüyorum?"
3. **Büyüme (4–8 dk).** Ay vuruşları, sürüm anları ve kararlar. Kavramlar burada adlandırılır. Değerleme çubuğunun üstünde çarpan dökümü okunur: "MRR $22K × 12 × büyüme çarpanı 18×".
4. **Orta gerilim.** Aşamaya özgü bir kriz 2 hafta önceden ufuk şeridinde ⚠ ile haber verilir (örn. Seed'de sunucu çöküşü, A'da d7 retention düşüşü). Oyuncu hazırlanabilir. Rastgele ceza değil, önceden haber verilmiş bir sınav.
5. **Tur penceresi.** Değerleme hedefin %60'ına gelince "Tur başlat" açılır ve kendisi bir karardır:
   - Büyüklük: **Küçük** (12 ay runway, az hisse) / **Hedef** (18 ay) / **Büyük** (24 ay, çok hisse). Tutar = `max(tablo × 0.5, burn × ay)`, üst sınırlı.
   - Teklif = hedef tutar × (kapanıştaki değerleme / hedef), 0.6–1.2 aralığına sıkıştırılır. Erken başlarsan güvendesin ama teklif küçük, beklersen teklif büyür ama runway erir.
   - Tur 4–8 hafta sürer. Yatırımcı toplantı odasına yerleşir ve bir **due-diligence listesi** getirir ("Kapanışta: runway ≥ 3 ay · MoM ≥ %6 · moral ≥ 50"). Liste hedef çipine dönüşür. Her karşılanan madde teklifi +%5, karşılanmayan −%10 değiştirir (taban %50, tavan %130).
   - Her hafta bir pitch kartı gelir (zaman durur): "Metrik göster / Hikâye anlat / İkinci yatırımcı getir". Kart teklifi ya da süreyi etkiler. Kurucu kahvesi süreyi kısaltır ama enerji yer.
   - Kasa kritikse köprü kredisi kartı gelir (mevcut içerik).
6. **Kapanış (5 sn).** Hitstop, term sheet kartı (duraklı), hisse pastası dilimlenir, para kasaya yağar, ekip alkışlar. **Aşama karnesi** 3 satır: öğrenilen kavramlar, "Kararın → sonucu" (en etkili 2 karar), yıldız hedefler. Sonra taşınma.

**Oturum yayı.** Her aşamanın gerilim ekseni değişir: Garaj "hayatta kal, ilk sürümü çıkar" (nakit) → Pre-seed "ilk ekip ve odak" → Seed "fiyat ve kalıcılık" (kalite) → A "ücretli büyüme, birim ekonomi" (verimlilik) → B "ölçek, kurumsal, balina müşteri" → C "kontrol ve çıkış" (kontrol) → Unicorn finali ve Kurucu Karnesi.

### 4.4 İlk 3 dakikanın senaryosu (1×)
| t | Ne olur |
|---|---|
| 0:00 | "Yeni oyun". Kamera garaja 1.2 sn'de yaklaşır. **Zaman duraklı**: ekran çerçevesi kırmızı, tarih çipinde gri "Gün 0" ve "DURAKLATILDI · Space" hapı. Kasa **$15,000** sabit. Ortada "▶ Başlat" kartı ve üstünde hedef: "Pre-seed · değerleme $300K". Kartın altında sıradaki adım: "1. Bir ürün fikri seç". |
| 0:03 | Oyuncu çipe tıklar, Projeler paneli açılır (zaten duraklı). 3 hazır fikirden biri seçilir, her birinde takas yazar ("B2C: hızlı kullanıcı / düşük ARPU"). Kurucu masasında proje kutusu ve "MVP %0" halkası belirir. |
| 0:08 | Çip: "2. Zamanı başlat ▶ (Space)". Oyuncu basar. Çerçeve 300 ms'de kırmızıdan **sarıya** geçer, "tık" sesi. Gün halkası her 2 sn'de dolar. Kasa "$15,000 → $14,950", yanında "−$50/gün", her gün kırmızı "−50" süzülür (kira + kurucunun yaşam gideri). Ufuk şeridinde tek işaret: "Gün 30 · Maaş günü −$1.5K". |
| 0:12 | Kurucu kodlar, MVP halkası belirgin adımlarla dolar. Çip: "3. Elle kullanıcı bul". Butonda getiri önizlemesi: "+3–6 kullanıcı · 1 gün · bu ay 3 tam hak". |
| 0:14 | Basılır. Kurucu kapıdan çıkar, 2 sn sonra 4 figürle döner. Figürler "beta" rozetiyle kapı önünde bekler (ürün yok, gelir yok). Kullanıcı sayacı 1.15 ölçekte zıplar. |
| 0:14–0:30 | Bul / konuş / dinlen arasında seçim. "Konuş" MVP halkasına +%3 dilim ekler. 4. "bul"da önizleme "Tanıdık çevren tükeniyor: +2–3" der. |
| 0:20 | Kapıda aday NPC belirir. Çip: "4. Ekip için önce masa → Mağaza". Mağaza butonu nabız atar, boş slot sahnede yeşil hayaletle parlar. |
| 0:25–0:40 | Masa alınır (−$400 tek parça, kasadan slota para uçar). Çip: "5. İşe al". Aday kartında maaş "/gün" karşılığıyla yazar: "−$40/gün". İşe alınca günlük delta −$50'den −$90'a çıkar ve bir kez **turuncu** yanar ("burn ↑"). Ufuk şeridindeki maaş günü işareti "−$2.7K" olur. |
| 0:40 | **Sürüm anı**: MVP %20 eşiğini geçer. Konfeti, "Yayında! MVP" pankartı. Bekleyen beta figürleri içeri yürür, kullanıcı +4 → +12. Çip: "6. Fiyat koy, ilk gelir". |
| 1:00 | **Maaş günü.** Kasa titrer, büyük kırmızı "−$2.7K" düşer, paralar masalara uçar. Ay fişi: "Gelir $0 · Kira −$300 · Kurucu −$1.2K · Maaş −$1.2K · Net −$2.7K · Runway 4.3 ay". Kasa widget'ı runway < 6 ay olduğu için kehribar olur. |
| 1:04 | Muhasebeci balonu: "Bu parayla kaç ay dayanırız?" Zaman **durmaz**, balon sallanır. Oyuncu tıklar, Defter kartı açılır ve zaman **durur**: çerçeve kırmızı **kesik**, hap "Defter açık · 1×'e dönecek". "Sen nerede gördün?" satırı: "Az önce $2.7K ödedin, $11.6K var: 4.3 ay." Kapatınca çerçeve yeniden sarı olur, runway widget'ı karttan HUD'a uçup yerleşir (Kullan). |
| 1:20 | İlk ödeme: kasada ilk kez yeşil "+$" süzülür. Değerleme çubuğu dolmaya başlar, üstünde "büyüme — → 6×" etiketi. |
| 1:40 | Karar ziyaretçisi (early-sidegig) kapıdan girip koltuğa oturur, başında "!". Tıklanınca zaman durur. Seçenekler: "Yan iş al: +$1.5K/ay, kurucu verimi −%30" / "Hayır: tam odak". Seçim sonrası yansıma satırı çıkar, gecikmeli etkisi ufuk şeridine "⏳ 1 ay" olarak yerleşir. Zaman kaldığı hızdan devam eder. |
| 2:00 | İkinci maaş günü. Fişte yeni satır: "MRR +$60". Burn kavram balonu gelir (ilk fiş + ikinci fişin karşılaştırması tam hissedildiği an). |
| 2:20 | Pazarlamacı adayı gelir. Çip: "Organik akış için pazarlamacı". |
| 2:40 | Sürüm anı: "v1.1" (olgunluk %40). "+18 kullanıcı · MRR +$90". |
| 3:00 | Oyuncu 2×'e geçer, çerçeve **turuncu**. 3 dakikada: 6 zincir halkası, 2 kavram, 1 karar, 2 maaş günü, 2 sürüm. Hiçbir aralık 8 sn'yi geçmedi. |

---

## 5. Mekanik değişiklikleri

### Yeni
| Mekanik | Özet | Çözdüğü |
|---|---|---|
| **Maaş günü** | Kira, maaş ve altyapı ayın 1'inde tek kalemde düşer, gelir günlük akar. Kasa grafiği testere dişi olur. İflas sayacı "ay sonu kasa < 0" ya da "maaş ödenemedi"ye bağlanır, anlık eksiye düşüş sayacı başlatmaz. | S1, S9 |
| **Ay fişi** | Engine `monthEnd` olayını kalem kırılımıyla yayar (gelir, maaş, kira, reklam, net, MoM, çarpan, runway). UI 4 sn'lik engellemeyen şerit gösterir. Satırlar kavram öğrenildikçe eklenir. | S9, öğretim |
| **Sürüm anı** | Faz 1'de sadece olgunluk eşikleri (%20 MVP, %40, %60, %80, %100) bir "sürüm" olayı üretir: pankart, kullanıcı dalgası, MRR sıçraması. Faz 4'te isteğe bağlı olarak 3 odaklı sprint (Özellik / Kalite / Büyüme) ve 1–5★ deterministik puan eklenir, varsayılan "aynı odakla devam". | Core loop, S7 |
| **Sıradaki adım çipi** | Saf `nextStep(state)` seçicisi (derive.ts). Sıra: fikir → başlat → kullanıcı bul → masa → işe al → fiyat → halka → tur. Tıklanınca ilgili paneli ve sahnedeki hayalet slotu açar. `noDesk` hatası tuzak olmaktan çıkar. | S7 |
| **Aşama hedef kartı** | ★ zorunlu değerleme + 2 ☆ opsiyonel hedef (içerik: `content/goals.ts`). Cezasız, ödülü nakitsiz. | S8 |
| **Ufuk şeridi** | Saf `horizon(state)` seçicisi: önümüzdeki 4–6 haftadaki maaş günü, `decisions.pending` gecikmeli etkiler (kaynak kartla), tur kapanışı, aday ayrılışı, ⚠ kriz. Etki gerçekleşince kaynağıyla düşer: "early-sidegig seçiminden: +$1.5K". | S3 |
| **Canlı tur penceresi** | %60'tan erken başlatma, büyüklük seçimi (12/18/24 ay), due-diligence listesi, haftalık pitch kartı, canlı teklif göstergesi. | S2, S6 |
| **Çarpan göstergesi** | Değerleme çubuğunun üstünde "büyüme %X → Y×", çarpan düşünce turuncu ok. | S5 |
| **Olay bütçesi** | 8 sn boşlukta hazır bir olayı öne çeker, yeni olay yaratmaz. | S6 |
| **Kalıcı politika çipleri** (Faz 4) | Bazı kart seçenekleri geçici modifier yerine kalıcı şirket politikası bırakır (Uzaktan çalışma, Hızlı işe alım, Reklamsız büyüme). HUD'da durur, ilgili kartta tekrar gündeme gelir. | S3 |

### Değişen
| Mekanik | Önce | Sonra |
|---|---|---|
| Garaj burn'ü | Kira $300/ay, net −$10/gün | Kurucu yaşam gideri ~$1.2K/ay eklenir, START_CASH $15K. Net ≈ −$1.5K/ay, runway ≈ 10 ay, ilk işe alımla ≈ 4–5 ay. |
| Tur tutarı | Sabit tablo | `max(tablo × 0.5, burn × seçilen ay)`, üst sınırlı. |
| Tur süresi | 4–8 hafta pasif bekleme | Aynı süre, ama haftalık pitch ve canlı teklifle. |
| Tur başlatma | Değerleme ≥ hedef | Değerleme ≥ hedefin %60'ı, teklif kapanış değerlemesine göre 0.6–1.2. |
| Değerleme çarpanı | `clamp(4,30,6+150×MoM)`, anlık MoM | 3 aylık ortalama MoM (`finance.mrrHistory`), aşamaya göre düşen tavan (30 → 25 → 20 → 15 → 12 → 10). DECISIONS #12 testi güncellenir. |
| Kullanıcı bul | 1 gün cooldown, sınırsız | Ay içinde ilk 3 tam getiri, sonrakiler yarı ("tanıdık çevren tükeniyor"), getiri önizlemesi. `manualThisMonth` bayrağı zaten var. Kullanıcı > 100 olunca getiri yarıya iner. |
| Karar sıklığı | ≈2 kart/dk, ≈40–48 kart/oyun | ≈1 kart/90 sn, ayda en fazla 1. Her seçenek anlık görünen bir etki taşır. Gecikmeler ≤ 30 gün ve ufukta görünür. |
| Karar ziyaretçisi | 20 günde gider | Koltukta bekler. 2 ay sonra baştan yazılı varsayılan uygulanır. |
| Kavram balonu küçülmesi | 20 sn gerçek zaman | 10 oyun günü, duraklıyken durur. |
| Genişletilmiş karar balonu | Zaman akar | `decision` duraklatma sebebi. |
| `createGame` | `speed: 1` | `speed: 0`. |

### Kaldırılan
- `DECISION_VISITOR_DAYS` sayacı (ziyaretçinin gitmesi).
- Gerçek zamanlı `CONCEPT_MINIMIZE_MS` zamanlayıcısı (oyun zamanına taşınır).
- Günlük gider tahakkuku (`tick.ts:54` içinde giderin payı; gelir günlük kalır).
- "Sayı dolana kadar bekle" tur kapısı (yerine erken tur penceresi).

---

## 6. Öğretim entegrasyonu (Hisset → Adlandır → Kullan)

Her kavram döngünün bir vuruşuna bağlanır, böylece kavramı döngünün kendisi öğretir.

| Vuruş | Hisset | Adlandır | Kullan |
|---|---|---|---|
| Maaş günü | Kasa ayın 1'inde sert düşer | Muhasebeci: "kaç ay dayanırız?" → **runway**, **burn** | Runway widget'ı, fişte "Runway" satırı, işe alımda "−X ay" önizlemesi |
| Ay fişi | Net ilk kez pozitif olur, şerit yeşile döner | **default-alive** | Fişte kâr projeksiyonu çizgisi |
| Sürüm anı | Düşük olgunlukla gelen kullanıcıların bir kısmı birkaç gün sonra kapıdan geri çıkar | "Geliyorlar ama kalmıyorlar" → **churn**, **pmf** | Tutunma göstergesi, Kalite sprint'i (Faz 4) |
| Kullanıcı bul doygunluğu | 4. hamlede getiri yarıya iner | **dont-scale** | Önizlemede "bu ay doydu", pazarlamacı ipucu |
| Çarpan göstergesi | MRR artar ama değerleme düşer | "Yatırımcı büyümeyi fiyatlar" → **trough** | Çarpan etiketi, 3 aylık büyüme dökümü |
| Tur penceresi | Tur haftaları kasayı yer, runway yarıdan azken başlayan tur köprü kararına götürür | **fundraise-time** | Erken tur butonu, due-diligence çipi |
| Term sheet | Hisse pastası dilimlenir | **dilution** | Büyüklük seçiminde "hisse ↔ runway" önizlemesi |
| Aşama ☆ hedefi | Seed ☆: "Fiyatı değiştir, churn %6 altında kal" | **pricing** | Fiyat ayarı |

İlkeler:
- **Tek doğru yok.** Erken ya da geç tur, bul ya da konuş, küçük ya da büyük tur, hızlı ya da seçici işe alım hep takastır.
- **Rastgele ceza yok.** Krizler 2 hafta önceden ⚠ ile haber verilir. Cevapsız kartın varsayılanı baştan yazılıdır. Olay bütçesi yalnızca fırsat üretir. Kaçırılan hedefin bedeli yoktur.
- **Okurken zaman akmaz.** Defter, karar ve teklif kartı her zaman duraklatır.
- Kart metinleri PLAN §2 limitlerini korur. Defter kartındaki "Sen nerede gördün?" satırı fişteki gerçek rakamı anar. Aşama karnesindeki "Kararın → sonucu" satırı yansımayı kapatır.

---

## 7. Geri bildirim ve his

**Zaman**
- Viewport çerçevesi (3 px, mobilde 2 px) + hız kontrolü dolgusu + gün halkası, hep aynı renk kodu.
- Başlat ve hız değişiminde 300 ms renk süpürmesi ve "tık".
- Duraklıyken `PauseVeil` desatürasyonu, donan karakterler, hap. Odak duraklatmasında kesik çizgi ve soluk seçili hız.
- Akarken gün halkası dolar, ay dönümünde "tık" eder, çerçevede gün başına ince parlama dolaşır.

**Para**
- Akıcı kasa sayacı ($100K altında tam dolar), "−$X/gün" etiketi, her gün süzülen delta.
- Maaş günü: 0.6 sn titreme, büyük "−$X", kasadan masalara uçan 6–12 para, 300 ms kırmızı flaş.
- Gelir anında (sürüm, satış görüşmesi, tur kapanışı) yeşil "+$" ve kasaya akan paralar.
- Runway rengi yalnız kasa widget'ında: >12 ay nötr, 6–12 kehribar yazı, 3–6 turuncu, <3 kırmızı nabız.
- Her gider aksiyonunun yanında "/ay" ve "/gün" karşılığı. Uygulanınca günlük delta bir kez turuncu yanar.

**Aksiyon ve dünya**
- Kurucu hamlesinde buton sıkışır (0.94) ve yaylanır, cooldown halkası döner. Kurucu sahnede kapıdan çıkar ya da toplantı odasına girer, sonuç kaynağından patlar.
- Sürüm anı: masa üstünde pankart, kapıdan içeri yürüyen figürler (sayaçla senkron), "+N kullanıcı · MRR +$X". Düşük sürümde konfeti yok, sakin bir "öğrendik" balonu.
- Kilometre taşları (ilk kullanıcı, 100/1000 kullanıcı, ilk $, ilk kârlı ay, tur kapanışı): tek konfeti, ekip alkışı, Defter'e bir satır. Blocking modal açmaz.

**Popup bütçesi.** Engelleyen tek şey panelde açılan kartlar (karar, Defter, teklif) ve taşınma/term sheet modalıdır. Fiş, çip, ufuk, pankart ve rozetler engellemez, ≤ 4 sn görünür. Mobilde çip ve ufuk tek satıra birleşir, fiş ince bir toast olur.

**Ses** (src/audio başka oturumda, yalnızca öneri): maaş günü için yazar kasa, sürüm için yükselen arpej, duraklatmada düşük geçiren filtre.

---

## 8. Engine / UI etkisi

### İzinli dosyalar
| Dosya | Değişiklik | Faz |
|---|---|---|
| `src/store/gameStore.ts` | `pauseReasonsOf`: genişletilmiş karar balonu için `ui.decisionExpanded` → `decision`. Faz 2'de `offer`. Olay bütçesi zamanlayıcısı. "Önemli anda yavaşla". | 0, 2 |
| `src/store/types.ts` | `PauseReason` birliğine `offer`, `decisionExpanded` bayrağı. | 0, 2 |
| `src/engine/createGame.ts` | `speed: 0`. Faz 3'te `finance.mrrHistory`. | 0, 3 |
| `src/ui/time.tsx` | Yeni `ScreenFrame` (viewport çerçevesi, kesik çizgi, soluk seçili hız). | 0 |
| `src/ui/GameUI.tsx` | `ScreenFrame` mount, fiş şeridi, çip, ufuk. | 0–1 |
| `src/ui/bubbles/DecisionBubble.tsx` | `expanded` durumunu store'a bildir. | 0 |
| `src/ui/bubbles/ConceptBubble.tsx` | Küçülmeyi oyun günüyle say. | 0 |
| `src/ui/Hud.tsx` | Sıradaki adım çipi, ufuk şeridi, çarpan etiketi yeri. | 1 |
| `src/ui/widgets.tsx` | Tam dolar sayaç, maaş günü flaşı, runway renk eşikleri, çarpan göstergesi. | 1 |
| Yeni `src/ui/MonthReceipt.tsx`, `NextStepChip.tsx`, `Horizon.tsx`, `panels/GoalsCard.tsx`, `panels/RoundOffer.tsx` | Fiş, çip, ufuk, hedef kartı, tur teklif/pitch kartı. | 1–2 |
| `src/ui/FounderActions.tsx` | Getiri önizlemesi, doygunluk etiketi. | 2 |
| `src/engine/derive.ts` | Saf `nextStep(state)`, `horizon(state)`, `valuationBreakdown(state)`. Sim de kullanır. | 1 |
| `src/engine/tick.ts`, `world.ts` | `monthEnd` kalem kırılımı olayı. Faz 3'te giderin ayın 1'ine taşınması ve iflas kuralı. | 1, 3 |
| `src/engine/founder.ts` | findUsers aylık doygunluk ve kullanıcı > 100 yarı getiri. | 2 |
| `src/engine/round.ts` | %60 erken başlatma, büyüklük seçimi, due-diligence, haftalık teklif, `roundPitch` aksiyonu. | 2 |
| `src/engine/economy.ts` | 3 aylık ortalama MoM, aşama tavanı. | 3 |
| `src/engine/types.ts`, `actions.ts` | `roundPitch`, `setRoundSize`, `releases`, (Faz 4) `setSprintFocus`. | 2–4 |
| `src/engine/save.ts` | Şema versiyonu ve migrasyon (mrrHistory, round alanları, releases). | 3 |
| Yeni `src/content/goals.ts` | Aşama hedefleri ve metinleri (strings.ts yasak olduğu için geçici olarak burada). | 1 |
| `sim/` | Botlara tur büyüklüğü ve pitch seçimi. Rapora anlamlı aksiyon aralığı, maaş günü sonrası runway, iflas oranı (dikkatsiz / iyi), sürüm başına kullanıcı dalgası. | 2–3 |
| `docs/DECISIONS.md`, `CONTRACTS.md` | Yeni kararlar (#14+), aksiyon sözleşmeleri. | her faz |

### Yasak dosyalar (openIssues, sahip oturumla koordine)
| Dosya | Gereken |
|---|---|
| `src/engine/balance.ts` | `START_CASH ≈ 15000`, `FOUNDER_LIVING_COST ≈ 1200` (Garaj–Pre-seed), `ROUND_RUNWAY_MONTHS = [12,18,24]`, `ROUND_EARLY_RATIO = 0.6`, `ROUND_OFFER_CLAMP = [0.6,1.2]`, `DILIGENCE_*`, `VALUATION_MULT_CAP_BY_STAGE`, `FIND_USERS_FULL_PER_MONTH = 3`, `CARD_DAILY_CHANCE` ↓ ve `CARD_COOLDOWN_DAYS ≈ 45`, `DECISION_VISITOR_DAYS` kaldırma, `DECISION_DEFAULT_AFTER_DAYS = 60`, `CRISIS_TELEGRAPH_DAYS = 14`. |
| `src/engine/decisions.ts` | Ziyaretçinin gitmemesi, 1 aktif + 1 bekleyen, varsayılan seçenek, gecikmeler ≤ 30 gün, `pending` kaynak kart id'si, telegraflanan kriz, (Faz 4) `policy` efekt tipi. |
| `src/content/strings.ts` | Çerçeve hapları, fiş, çip, ufuk, hedef, pitch, sürüm pankartı metinleri. |
| `src/ui/shortcuts.ts` | Pitch/teklif kartında Enter, "Sonra karar ver" kısayolu. |
| `src/engine/__tests__/engine.test.ts` | Maaş günü ve çarpan formülü testleri (DECISIONS #12). |
| `src/render/Office.tsx`, `Npc.tsx`, `Character.tsx`, `walker.ts` | Ziyaretçinin koltukta beklemesi, kurucunun kapı yürüyüşü, para uçuşu ve figür akışı için ayrı `src/render/Juice.tsx` katmanının tek satırlık mount'u. |
| `src/ui/panels/SettingsPanel.tsx` | "Önemli anda yavaşla" ve "Ay fişini göster" tercihleri. |

---

## 9. Açık karar noktaları (kullanıcıya sorulacak)

**S1. Garajda para ne kadar sıkışsın?**
- a) Yumuşak: $30K + yaşam gideri $1.2K/ay → runway ≈ 20 ay, erime görünür ama tehdit yok.
- b) **Orta (öneri)**: $15K + $1.2K/ay → runway ≈ 10 ay, ilk işe alımla ≈ 4–5 ay. Dikkatsiz oyuncu ≈ 8 dk'da zorlanır.
- c) Sert: $10K + $1.5K/ay → runway ≈ 6 ay, garaj bir hayatta kalma bölümü olur.

**S2. Maaş ne zaman düşsün?**
- a) **Ayın 1'inde tek kalem (öneri)**: testere dişi kasa, belirgin "maaş günü" anı.
- b) Günlük akmaya devam etsin, sadece ay fişi eklensin: daha sakin ama erime daha az hissedilir.
- c) İki haftada bir (1 ve 15): daha sık ama daha küçük vuruş.

**S3. Core loop'un ana vuruşu ne olsun?**
- a) **Sürüm anı, olgunluk eşikleriyle (öneri, Faz 1)**: yeni seçim yok, ama her eşikte pankart ve kullanıcı dalgası.
- b) Tam sprint sistemi (Faz 4 öne alınır): her sürümden önce Özellik / Kalite / Büyüme seçimi ve 1–5★ puan. Daha çok karar, daha çok iş.
- c) Haftalık kurucu odağı (decision-driven): her pazartesi odak seçilir, "Kullanıcı bul" butonu kalkar.

**S4. Oyun ne sıklıkla kendi kendine dursun?**
- a) **Yalnızca kart açılınca (öneri)**: karar/Defter/teklif kartına tıklayınca durur, balonun belirmesi durdurmaz.
- b) Kart gelir gelmez otomatik dursun: hiçbir şey kaçmaz ama akış sık kesilir.
- c) Hiç otomatik durmasın, sadece 4×'te 1×'e yavaşlasın.

**S5. Tur nasıl olsun?**
- a) **Erken pencere + büyüklük seçimi + haftalık pitch (öneri)**: en çok gerilim ve öğretim, en çok iş.
- b) Sadece erken pencere ve canlı teklif göstergesi, pitch kartı yok: daha az karar.
- c) Mevcut hali (hedefe ulaşınca bas, bekle), sadece tur tutarı runway'e göre ölçülsün.

---

## 10. Uygulama planı

Sıra kuralı: her faz tek başına oynanabilir bir iyileşme verir. Yasak dosyalara bağlı işler sahip oturum serbest bırakana kadar openIssue olarak bekler, faz o kısım olmadan da kapanabilir.

### Faz 0 — Odak (yalnızca store/UI, küçük) — kullanıcının 1. ve 3. maddesi
- Genişletilmiş karar balonu `decision` duraklatma sebebi olur.
- Kavram balonu küçülmesi oyun zamanına taşınır (`ConceptBubble.tsx`; `render/WorldBubbles.tsx` yasak değil ama `render/constants.ts` yasak, sabit UI tarafına taşınır).
- `ScreenFrame`: viewport çerçevesi, odak duraklatmasında kesik çizgi ve soluk seçili hız.
- `createGame` `speed: 0`.

**Bitti kriteri:** Store testleri: balon genişleyince `pauseReasons = ['decision']`, kapanınca önceki hız. Tarayıcıda: yeni oyun kırmızı çerçeveyle açılır; balon genişletilince zaman durur; Defter açıkken kavram balonu küçülmez; 1×/2×/4× çerçeve sarı/turuncu/yeşil; masaüstü ve 400 px mobilde ekran görüntüleri `docs/screenshots/`. `npm test` ve `tsc` temiz.

### Faz 1 — Nabız ve yön (izinli engine + UI) — 2. madde ve 4.'nün ilk katmanı
- Engine: `monthEnd` kalem kırılımı olayı, `nextStep`, `horizon`, `valuationBreakdown` seçicileri, olgunluk eşiklerinde `release` olayı.
- UI: ay fişi şeridi, sıradaki adım çipi (panel ve hayalet slot açar), ufuk şeridi, aşama hedef kartı (`content/goals.ts`), sürüm pankartı (HUD tarafında), tam dolar kasa, runway renk eşikleri, gider aksiyonlarında "/gün", çarpan etiketi.
- openIssue: strings.ts metinleri, `Juice.tsx` mount'u.

**Bitti kriteri:** `nextStep` ve `horizon` için engine testleri (garaj senaryosu: proje yok → fikir, masa yok → mağaza, …). Projesiz bir garajdan başlayan yeni oyuncu ilk 3 dakikada `noDesk` hatası görmeden ilk işe alıma ulaşır (tarayıcıda elle doğrulanır). Sim: ilk 5 dk'da anlamlı aksiyon aralığı medyanı ≤ 10 sn.

### Faz 2 — Aktif pencere (izinli engine) — ölü süre ve spam
- `round.ts`: %60 erken başlatma, büyüklük seçimi, due-diligence, haftalık teklif, `roundPitch`. Store: `offer` duraklatma sebebi.
- `founder.ts`: findUsers doygunluğu, getiri önizlemesi.
- Olay bütçesi, "Önemli anda yavaşla".
- Sim botlarına tur büyüklüğü ve pitch politikası.

**Bitti kriteri:** Sim: tur penceresinde en uzun boşluk ≤ 20 sn (önce 56–178 sn). findUsers artık hiçbir arketipte en sık aksiyon değil. Arketip farkı ≤ 1.3×. Round testleri: teklif clamp, due-diligence ±%.

### Faz 3 — Para kısıt (yasak balance/decisions ile, sahip oturumla birlikte) — 2. maddenin sistem tarafı
- Maaş günü (gider ayın 1'inde), iflas kuralı "maaş ödenemedi → kurtarma kartı → 60 gün".
- Yaşam gideri, START_CASH, tur tutarı = burn × ay, 3 aylık MoM ve aşama tavanı.
- Kartlar: sıklık ↓, ziyaretçi bekler, varsayılan seçenek, gecikmeler ≤ 30 gün ve kaynak id'si, telegraflanan kriz.
- Save migrasyonu, engine.test.ts güncellemesi, DECISIONS #12 revizyonu.

**Bitti kriteri:** Sim: dikkatsiz bot iflas %10–25, iyi bot ≤ %3; garajda < 4 dk'da iflas yok; Unicorn medyanı 45–90 dk; ölü süre medyanı ≤ 8 sn; karar politikaları arasında Unicorn süresi ya da iflas oranı anlamlı fark gösterir (en iyi ile en kötü arasında ≥ %15). Eski kayıtlar migrasyonla açılır.

### Faz 4 — Derinlik (oyun testine göre seçilir)
- Seçenek A: Sprint odağı (Özellik / Kalite / Büyüme) ve 1–5★ sürüm puanı, "aynı odakla devam" varsayılanı, aynı odakta azalan getiri.
- Seçenek B: Kalıcı politika çipleri.
- Seçenek C: Haftalık kurucu odağı.

**Bitti kriteri:** Oyun testinde kullanıcı "core loop" için olumlu geri bildirim verir. Sim'de tek bir odak ya da politika tüm arketiplerde baskın değildir. Seçilmeyen seçenekler PLAN'a "v2" olarak yazılır.

---

## Ek A — Jüri puan tablosu

Puanlar 1–10. Toplam = üç jürinin beş eksenindeki puanların toplamı (en fazla 150).

| Öneri | Jüri | Eğlence | Netlik | Öğretim | Kullanıcı düzeltmesi | Yapılabilirlik | Jüri toplamı |
|---|---|---|---|---|---|---|---|
| **feedback-juice** | player | 7 | 9 | 7 | 9 | 8 | 40 |
| | educator | 7 | 9 | 7 | 9 | 8 | 40 |
| | producer | 7 | 9 | 7 | 8 | 8 | 39 |
| | **Toplam** | 21 | 27 | 21 | 26 | 24 | **119** |
| tycoon | player | 8 | 8 | 8 | 9 | 5 | 38 |
| | educator | 8 | 7 | 8 | 9 | 5 | 37 |
| | producer | 8 | 7 | 7 | 9 | 4 | 35 |
| | **Toplam** | 24 | 22 | 23 | 27 | 14 | **110** |
| decision-driven | player | 7 | 8 | 8 | 9 | 4 | 36 |
| | educator | 6 | 8 | 8 | 9 | 4 | 35 |
| | producer | 7 | 8 | 8 | 8 | 4 | 35 |
| | **Toplam** | 20 | 24 | 24 | 26 | 12 | **106** |
| teaching-first | player | 6 | 8 | 9 | 8 | 4 | 35 |
| | educator | 6 | 7 | 9 | 8 | 4 | 34 |
| | producer | 6 | 7 | 9 | 7 | 5 | 34 |
| | **Toplam** | 18 | 22 | 27 | 23 | 13 | **103** |

**Neden feedback-juice temel:** Kullanıcının 1–3. maddelerini en doğrudan ve en ucuz çözen öneri bu, büyük kısmı izinli dosyalarda. Zayıf yanı (4. madde, yeni fiil yok) tycoon'un sürüm anı ve maaş günüyle, decision-driven'ın ufuk şeridi ve tur büyüklüğü seçimiyle, teaching-first'ün due-diligence listesi ve "Kararın → sonucu" satırıyla kapatıldı. Eğlencede en yüksek puanı alan tycoon sprint sistemi bilerek Faz 4'e bırakıldı: kapsamı büyük ve her ay tekrarlanan seçimin angaryaya dönme riski var.

## Ek B — Aşılanan fikirlerin kaynağı
| Fikir | Kaynak |
|---|---|
| Gün nabzı, ay fişi, olay bütçesi, erken tur penceresi, findUsers doygunluğu, getiri önizlemesi | feedback-juice |
| Maaş günü (tek kalem), sürüm anı, aşama ☆ hedefleri, "önemli anda yavaşla", sprint odağı (Faz 4) | tycoon |
| Ufuk şeridi, tur büyüklüğü (12/18/24 ay), telegraflanan ⚠ kriz, varsayılan seçenekli cevapsız kart, politika çipleri (Faz 4) | decision-driven |
| Due-diligence listesi, "Kararın → sonucu" / aşama karnesi, "Sen nerede gördün?" satırında gerçek fiş rakamı, kavram tetiğinin vuruşa bağlanması | teaching-first |
