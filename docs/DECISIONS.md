# Kararlar (PLAN §11 açık soruları)

1. **Dil:** v1 yalnızca Türkçe. Tüm oyuncu metinleri yine de anahtarlı (`content/` altında id → metin), ileride EN eklenebilir.
2. **Oyun adı:** "Be Unicorn" korunuyor.
3. **Mobil web:** Asıl hedef masaüstü web. Mobil tarayıcıda da oynanabilir olmalı: dokunmatik (tap = tıkla, pinch/buton zoom), dar ekranda HUD sıkışır, dock alt çubuk olur, detay paneli alttan açılan sheet olur. Sabit ortografik kamera korunur.
4. **Mobilya kataloğu:** ~30 eşya, slot tiplerine göre (masa / ortak alan / oda / özel).

# Uygulama kararları (review düzeltmeleri)

5. **Maaş işe alımda sabitlenir.** PLAN §5.6 `maaş = temelMaaş × 1.5^aşama` işe alım anındaki aşamayla hesaplanır, sonra değişmez (yalnızca "Zam" ile artar). Garajda alınan kişi Series A'da 3.4× maaşa çıkmaz: gerçek hayatta tur kapanınca herkesin maaşı otomatik artmaz ve bu, erken ekibin ucuz ama değerli olduğunu hissettirir. Burn yine yeni işe alımlarla büyür. (`Employee.salary`, `people.ts`)
6. **Ekip sıfır: 14 günlük ek süre.** PLAN §5.10 "ekip sıfıra inerse oyun biter". Kural yalnızca ilk işe alımdan sonra işler (garajda tek başına başlamak oyun sonu değildir) ve 14 gün (`TEAM_ZERO_GRACE_DAYS`) içinde yeniden işe alım yapılmazsa oyun biter. Son kişinin istifası anlık ceza olmasın diye (PLAN "rastgele ceza yok"). 60 günlük iflas sayacı PLAN'la birebir.
7. **İşe alım masa ister.** PLAN §4.2 / M2: boş bir masa slotunda masa eşyası yoksa `hire` / `assignDesk` `noDesk` hatası döner. Masası satılan çalışan masasız kalır (verim × 0.6) ve slot detayında "Buraya oturt" ile yeni masaya geçirilir.
8. **Mola (PLAN §7.2).** Masasının aura menzilinde ortak alan eşyası olan, yorgun olmayan çalışan her 5 günde bir günü (kişiye göre kaydırılmış, deterministik) "Molada" geçirir: ortak alana yürür, kahve içer. Verimi düşürmez (aura bunu karşılar).
9. **Gösterge açılımları.** `pricing` kavramı fiyat ayarını ve ARPU göstergesini açar (Seed'e varınca araç artık otomatik açılmaz; Hisset → Adlandır → Kullan sırası korunur). Tetik: kullanıcı > 500, fiyat ≤ 1, ortalama olgunluk ≥ 0.5 ve churn < %8 (değerli ürün, çekingen fiyat). `cap-table-health` "Kurucu kontrolü" göstergesini açar. İtibar göstergesi, itibarı ilk kez oynatan karar veya tur kapanışıyla açılır (PLAN'da itibar için ayrı kavram yok). `morale-compounds` ekranda "Moral haritası" çipini ve ofis zemininde masa başına moral renklendirmesini açar.
10. **`dilution` ve `fundraise-time` aşama 0.** İlk teklif (Garaj → Pre-seed) garajda geldiği için PLAN §6.2 tetikleri ("İlk yatırım teklifi", "İlk tur başlatılınca") ancak aşama 0'da doğru anda çalışır.
11. **Sayı biçimi.** Her yerde PLAN §2 örneğindeki kısa biçim: `4.2K`, `$1.2M`, `2.6 ay`, `%12.5`, oran `3.2×`. Yerel binlik ayırıcı kullanılmaz; böylece `.` her zaman ondalıktır.
12. **Denge: PLAN başlangıç değerlerinden sapmalar** (`balance.ts`, `[DENGE ≠ PLAN]` işaretli). Değerleme çarpanı PLAN §5.8 ile birebir: `clamp(4, 30, 6 + 150 × MoM)` (testle sabitlendi). Diğer sapmalar:

| Sabit | PLAN | Kod | Neden (sim) |
|---|---|---|---|
| `CAPACITY_PER_ENG` | 1500 | 4000 | PLAN değerleriyle 4 arketip de Pre-seed'de takılıyor (3 seed, 150 dk: 0/12 Seed). |
| `ORGANIC_PER_MARKETING` × `BASE_OUTPUT.marketing` | 25 × 1 | 45 × 3 | Aynı: organik akış churn dengesine erken oturuyor, MoM → 0, değerleme hedefe çıkmıyor. |
| `CAC_BASE` / `CAC_STAGE_GROWTH` | 8 / 1.3 | 20 / 1.4 | PLAN CAC'ı ile reklam her aşamada LTV:CAC ≫ 3, reklam dersi anlamsızlaşıyor. |
| `ARPU_STAGE_GROWTH` / `ARPU_SALES_PER` | 1.15 / 0.04 | 1.3 / 0.06 | 1.15 ile Series B–C hedefleri ($75M/$300M) kullanıcı artışıyla yakalanamıyor (D denemesi: 0/8 Unicorn). |

Sim sonucu (8 seed, `sim/REPORT.md`): Unicorn medyanları 23.5 / 19.0 / 20.7 / 21.8 dk, arketip farkı 1.24× (hedef ≤ 1.3× ✓), iflas %0, 6/32 koşu 150 dk'da Unicorn'a ulaşamadı. **60–90 dk hedefi henüz tutmuyor** (M7 denge işi): PLAN çarpanı büyüyen şirketi hızla 30×'e taşıdığı için geç aşamalar kısa sürüyor.
