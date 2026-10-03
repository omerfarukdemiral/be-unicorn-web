# GAMEPLAY V2 — Kasa gerilimi, geç oyun, merak, oyun hissi

Durum: **uygulandı** (dalga 1–12, Faz I kapanışı 2026-10-03; kararlar `DECISIONS.md` #21–#30, nihai sim `sim/REPORT.md`). Eleştiri turu işlendi (bkz. son bölüm). Bu belge beş alan planını (kasa/karar matematiği, geç oyun, merak, oyun hissi UI, merkez istatistik ekranı) tek tutarlı plana indirger. Uygulama dalgaları §16'da; her görev bu belgenin `##` başlıklarına referans verir. Belge zincirindeki yeri: `PLAN.md` (v1 kapsamı) → `DECISIONS.md` (#1–#20) → **`GAMEPLAY_V2.md`** (bu belge, v2 kararları) → `CORE_LOOP.md` (Faz 0–3 uygulandı; Faz 4 burada yeniden tanımlanır) → `LAYOUT.md` / `DESIGN.md` / `VOICE.md`. Çelişen yerlerde bu belge kazanır; hangi eski kararın değiştiği §17'de listelenir.

Tüm yollar repo köküne görelidir. Sayısal değerler `[DENGE]` başlangıç değeridir; ilgili dalganın sim kapısında ayarlanır ve `DECISIONS.md`'ye işlenir. **Nihai `[DENGE]` değerleri (Faz I):** `GROWTH_FULL_K` 0.35, `ROUND_RUNWAY_MONTHS` 8 / 12 / 16, `ROUND_AMOUNT_TABLE_MIN` 0.25, `ROUND_NEW_BURN_MULT` 1, `INFRA_MRR_SHARE` [0, .06, .18, .16, .16, .22, .22], `RAISE_YEARLY` 0.08, `MARKET_SIZE_SCALE` 2.5, `STAGE_TARGET_VALUATION` ve `MULTIPLE_MAX_BY_STAGE` değişmedi; `MIN_DAY_FOR_STAGE` 0 / 70 / 100 / 245 / 450 / 670 / 1205 (DECISIONS #21).

---

## 1. Teşhis

Sim (`sim/REPORT.md`, 12 seed) ve kod okuması birbirini doğruluyor: oyun Seed'den sonra **kendi kendine kazanılıyor**.

| Belirti | Kanıt | Kök neden (kod) |
|---|---|---|
| İflas yok | İyi botlar %0, careless %0; en kötü karar politikası iyi politikayla aynı sürede Unicorn (%7 fark) | Kart etkileri kelepçeli ve süreli (`effects.ts:11`, `tick.ts:103`), kalıcı hiçbir şey yok |
| Kasa ekseni ölü | Seed sonrası maaş günü runway medyanı 99 ay; koşuların %99-100'ünde >24 ay | Giderler ölçeklenmiyor: maaş işe alımda sabit (`people.ts:21`), altyapı $0.01/kullanıcı (`balance.ts:122`), kira yalnız aşamada zıplar |
| Tek fiil: "reklamı 2×" | A'da CAC ≈ $147, LTV ≈ $1000 → LTV:CAC ≈ 7, her zaman kârlı | `cac` harcamadan ve pazardan bağımsız (`economy.ts:60-66`), `AD_BUDGET_MAX` 50M, pazar büyüklüğü yok |
| Otopilot Unicorn | Kâra geçen şirket bekleyerek $1B'a ulaşır | Değerleme MRR'de monoton: çarpan tabanı 4 + pre-revenue tabanı her zaman (`economy.ts:179, 216-223`); sürüm dalgaları otomatik (`loop.ts:95-105`) |
| Kredi bedava | vcRocket 12/12 koşuda kredi alıp batmıyor | Faiz, vade, covenant yok; `debt` turdan sessizce düşer (`round.ts:336`) |
| Tur hiç düşmez | Üç DD kalemi de tutmasa teklif tabana çarpar (0.5×) ve aşama atlanır | `closeRound` her zaman `enterStage` (`round.ts:328`) |
| Bildirim gürültüsü | Aynı olay 3-5 kanaldan anlatılıyor (şerit + rozet + balon + konfeti + ofis lafı); `founderActionDone` ~200/koşu | `stripRules.ts:102-105`, `Moments.tsx:41-44`, `NotificationStrip.tsx:167-187` |
| "Şuna tıkla" yönlendirmesi | NextStepChip 8 adımın hepsinde panel adı yazan düğme; RoundSection 8 paragraf; GoalsCard ~60 kelime düz yazı | `NextStepChip.tsx:79-85`, `RoundSection.tsx`, `GoalsCard.tsx` |
| Web sitesi hissi | 11 panel türü aynı 400px çekmecede, aynı başlık ritmi; `ul divide-y` listeler, `<input type=range>` slider, Tailwind varsayılan buton, Inter paragraflar | `RightPanel.tsx:110-119`, `TeamPanel.tsx:105-127`, `GrowthPanel.tsx`, `primitives.tsx:44-67` |
| Merak yok | Sıradaki aşamanın ne açtığı gizli ama siluet yok; rakip tek skaler; NPC'ler hafızasız | `stages.ts:4-51`, `world.ts:47-50`, `types.ts:739-749` |

Sonuç: sorun içerik azlığı değil, **kasa kısıtının Seed'de ölmesi**. Takvim, politika, kredi ve maaş masası ancak kasa gerçekten kısıt olduğunda ısırır; bu yüzden denge tabanı (§4) her şeyden önce gelir.

## 2. Tasarım özü

Oyuncu her aşamada **tarihi bilinen bir fırtınaya** doğru sınırlı hamle, sınırlı kasa ve sınırlı ekiple hazırlanır; kâr bir aşamanın çıkışı, sonraki aşamanın girdisidir ve her yeni turla birlikte yeni bir kısıt, yeni bir fiil ve kasayı harcamaya değer yeni bir yatırım açılır — böylece "reklamı ikiye katla ve bekle" hiçbir aşamada kazandırmaz. Gerilim rastgele cezadan değil, önceden görünen sınavlardan (kriz takvimi, kurul çeyreği, maaş günü, due diligence) ve geri alınamaz kalıcı seçimlerden (politikalar, kredi, segment açma, satın alma) doğar; oyuncu her zaman toparlanma kapısı bulur ama bedelini öder. Arayüz bu matematiği **sayı, ikon ve nesne vurgusuyla** anlatır: ekranda aynı anda okunacak tek cümle, gerisi tabular sayı ve görsel; yönlendirme metinden sisteme, kazanımlar şeritten tek ikona taşınır, gidişat merkezdeki canlı istatistik ekranında görünür. Frostpunk'tan alınan yalnızca **sistemik kurgudur** (bilinen fırtına, kanun kitabı, sınırlı işgücü, umut/hoşnutsuzluk dengesi); görsel veya animasyon taklidi (buz, soğuma, kar) yoktur ve reddedilmiştir.

## 3. Ortak kurallar ve mimari kısıtlar

Bu kurallar tüm bölümlere uygulanır; görevler bunlara uymayan kod üretmez.

1. **Engine saf ve deterministik** (`CONTRACTS.md §3`, `PLAN.md §8.3`): `step`/`applyAction` girdiyi klonlar, RNG yalnız `Rng`, `Math.random`/`Date.now` yasak. Her yeni mekanik = `GameState` alanı + `balance.ts` sabiti + `types.ts` **yalnız-ekleme**. `derived` her step sonunda yeniden hesaplanır.
2. **Sim = oyun**: sim `step()`'i aynen çağırır (`sim/bots.ts:509`). Her yeni `Action` için bot politikası yazılır, yoksa sim ölçemez. Sim kriter satırları `sim/run.ts:262-293` §15 tablosuyla yeniden yazılır.
3. **UI formül hesaplamaz** (`CONTRACTS.md §1`): önizleme, projeksiyon, radar normalizasyonu, tur riski — hepsi engine saf seçicisidir (`loopSelectors.ts`); UI çağırır ve çizer.
4. **Tek kayıt migrasyonu**: `SAVE_VERSION` 3 → **4** (`types.ts:16`), `save.ts:11 MIGRATIONS[3]` tek fonksiyon; §3.1'deki tüm alanları varsayılanlar. Engine tarafında her yeni alan `??=` ile tembel varsayılanlanır (`money.test.ts:83-107` deseni), böylece dalgalar birbirinden bağımsız inebilir ve eski kayıt hiçbir dalgada kırılmaz. Bulut kaydı ≤160 KB (`DECISIONS.md #20`); §14'teki fiş geçmişi dahil toplam ek yük hedefi <30 KB.
5. **Metin yalnız `src/content/`**, anahtarlı, TR (#1). Bütçeler (`VOICE.md`'ye eklenir): balon ≤12 kelime, kart sorusu ≤12, seçenek etiketi ≤5, yansıma ≤10, panel cümlesi ≤12, tooltip ≤8, ufuk öğesi ≤6, teaser ≤6, buton ≤2, boş durum ≤4. Açıklama paragrafı eklenmez; sayı `derived`'dan gösterilir.
6. **Zaman oyuncunun** (#13, #14): `ui.pauseReasons` türetilir, engine `setSpeed` yazmaz. Yeni pause sebebi yalnız `payday`: maaş masası **açıkken** durdurur; oyuncu masayı "Sonra" ile kapatabilir, o zaman zaman akar ve 3 günlük geri sayım işler (§6.1; bot ile oyuncu aynı akışı yaşar). Ortadaki `CenterFrame` ekranları (istatistik, Kanun Kitabı, Pazar haritası) durdurmaz (§14). Store `afterStep`: `decisionShown | paydayShort | crisis | roundWindow | payrollMissed | roundFailed | loanCalled` olaylarından biri gelirse açık `CenterFrame` overlay'i kapanır ve hız 4× → 1× (`IMPORTANT_EVENT_KINDS` genişler, `gameStore.ts:50-54` yalnız aşamanın ilk kartında yavaşlatan kural kalkar) — ortadaki ekran hiçbir karar balonunu örtmez, "kaçırdım" hissi oluşmaz.
7. **Tek kırmızı kuralı** (`LAYOUT.md §4.1`): `--color-negative` yalnız runway<3 / iflas / maaş kaçtı / moral<28 / ölüm noktası. Hız çerçevesinin kırmızısı ayrı token ve kesik çizgi (§13); ikisi karışmaz.
8. **Teslim kapısı** her dalgada: `npm run typecheck && npm test && npm run build`; engine'e dokunan dalgada ek `npm run sim -- --seeds 12 --quick 1 --days 3000` (Unicorn 60-90 dk = 1800-2700 gün, 3000 yeter; quick mod `coaster`/`idleAfterProfit`/`greedyGood`'u da `runMany` ile koşturur, `sim/run.ts:62-66 extra()` yalnız idle/random'ı bootstrap'tan yeniden kullanır); oran kriterleri için `--seeds 24` (12 seedde sd ≈ 14 puan, oran kriterleri gürültüde kalır; kriterler koşu sayısı + tolerans olarak yazılır, ör. "iflas 0-1/24"). Denge dalgaları sonunda `npm run sim -- --seeds 24 --days 4500`, `sim/REPORT.md` yeniden üretilir; kapı süresi (~15-20 dk) görev özetine yazılır. **Erken aşamayı etkileyen her denge dalgasında (B1, B2)** `npx tsx sim/minStageDays.ts` koşar; ölçülen min gün `src/net/stageRules.ts:22 MIN_DAY_FOR_STAGE[i]`'nin altına düşerse aynı dalgada `stageRules.ts` + `stageRules.test.ts` güncellenir (#20) — ara dalga deploy edilirse dürüst oyuncu sunucuda reddedilmez. Faz I nihai ölçümü yine yapar.
9. **Tam `Record<Union, …>` tabloları** (`strings.ts:60 TOOL_TEXT`, `:92 ACTION_ERROR_TEXT`, `:112 DECISION_CATEGORY_TEXT`, `text.ts ACTIVITY_TEXT`) union'a eklenen her üyeyi zorunlu kılar: `ToolId` / `ActionErrorCode` / `DecisionCategory` / `ActivityKind` genişleten her engine dalgası `src/content/strings.ts` (ve `ActivityKind` için `src/content/text.ts`) dosyasını kendi listesine alır. Engine dalgaları tercihen yalnız `GameEventKind` ekler (Partial tüketilir), `ActivityKind` eklemez. `EngineContent`'e yeni koleksiyonlar (`crises?`, `policies?`, `markets?`, `threads?`) **opsiyonel** girer; `src/engine/__tests__/fixtures.ts fakeContent` ilk ekleyen dalgada (C1) güncellenir.
10. **Test ortamı**: `vite.config.ts:53-56` include deseni `'src/**/*.test.{ts,tsx}'` olur (A1 dalgası, dosya listesine girer). Ortam `node` kalır; jsdom / testing-library eklenmez. DOM assert'leri `react-dom/server renderToStaticMarkup` ile string üzerinden yapılır; `type="range"` / `<p>` sayımı gibi kontroller kaynak dosya grep'i olarak `.ts` testte de yazılabilir. Yalnız sabit test eden dosyalar (`SPEED_COLOR`) `.ts`'tir.
11. **Kart bütçesi sabittir** (kullanıcı isteği 4: daha az popup): `CARD_DAILY_CHANCE` 0.1 → **0.08**; yönetmen kart *sıklığına* dokunmaz (yalnız ağırlık ve şiddet, §5.2). Kriz/kurul/`landlord-notice`/`board-review` kartları normal kart kotasından düşer: `CARD_COOLDOWN_DAYS` (25) paylaşılır, aynı gün ikinci kart yok (kriz/kurul kartı öncelikli, sıradaki normal kart cooldown'a itilir); yalnız `angel-lifeline` ve maaş masası anlıktır. İplik kartları eklenirken mevcut havuzdan eşdeğer sayıda zayıf kart emekliye ayrılır: **`CONTENT.decisions` toplamı ≤ 65** (bugün 52), kart/koşu artışı ≤ 0 ve mutlak kart/koşu ≤ 45 (§15).

### 3.1 Save v4 alan envanteri (tek migrasyon)

| Alan | Varsayılan (eski kayıt) | Bölüm |
|---|---|---|
| `finance.receipts: MonthReceipt[]` | `mrrHistory/usersHistory`'den kısmi fişler | §14 |
| `finance.netHistory: number[]` | `[]` | §4 |
| `finance.pendingPayday?`, `finance.deferred?` | `undefined`, `0` | §6 |
| `finance.loan?` | `debt > 0` ise `{principal: debt, balance: debt, rateMonthly: 0.02, monthsLeft: 12, covenantRunway: 1, covenantFromDay: day + 90, interestOnlyUntil: day + 180, breaches: 0}` | §6 |
| `calendar: CalendarEntry[]` | `[]`; bekleyen giriş yoksa ilk `daily()`'de tembel `scheduleCrisis` (migrasyonda rng kullanılmaz) | §5 |
| `director: {pressure, graceUntil, angelUsed?}` | `{pressure: 0.3, graceUntil: 0}` | §5 |
| `founder.moves: {left, weekStart}` | `{left: MOVES_PER_WEEK[stage], weekStart: day}` (Garaj'da bütçe uygulanmaz, §7.1) | §7 |
| `policies: {adopted: PolicyId[], lastSignedDay}` | `{adopted: [], lastSignedDay: -999}` | §7 |
| `market: {segments: MarketSegment[]}` | aşamaya göre otomatik segmentler açık | §8 |
| `rivals: Rival[]` | aşama ≥ Seed ise 1 rakip doğar | §8, §9 |
| `board?: BoardState` | aşama ≥ A ise çeyrek başlar | §8 |
| `cast: Record<NpcRole, string>` | her rol için `NPC_NAMES[role][0]` | §9 |
| `stageReports: StageReport[]` | `[]` | §9 |
| `round.strikes?`, `round.ddStart?` | `0`, `undefined` (aktif turda strike ölçümü ilk `weekPassed`'da snapshot alır) | §6 |
| `Employee.raises?` | `0` (`hiredDay` zaten zorunlu ve her işe alımda yazılıyor — `types.ts:229`, `people.ts:119`; migrasyon gerekmez) | §4 |
| `DecisionsState.history[].optionIndex` | zaten var ve yazılıyor (`types.ts:322`, `decisions.ts:86`); migrasyon yok. Not: `history` sınırsız büyür (~150 giriş/koşu), cap gerekmez, kayıt boyutu ölçümüne dahil | §9 |

## 4. Kasa ekonomisi: değerleme, gider, kanal

Bu bölüm diğer her şeyin ön koşuludur (§16 Faz B). Saf formül değişikliği; UI'sız test edilir.

### 4.1 Değerleme: kafa sayısı çıkar, büyüme ve verimlilik girer

`VAL_PER_TEAM` **silinir** (`balance.ts:158`, `economy.ts:174-175`, `derive.ts:154`, `loopSelectors.ts:62`, `loopUi.ts:72`, testler `economy.test.ts:110`, `round.test.ts:34`, `review.test.ts:157`, `loop.test.ts:183`). Onaylı fikir (2); `DECISIONS.md #12/#17` değişir.

```
pre  = VAL_PER_LAUNCHED(150K) × yayındaki ürün
     + VAL_PER_USER(400) × users
     + VAL_PER_RELEASE(15K) × min(5, releaseCount)
```
Garaj → Pre-seed penceresi (300K = 0.6 × 500K): 1 yayın + 5 sürüm + ~190 kullanıcı ile açılır (bugün 3 kişi + 500 kullanıcı). Pre-revenue tabanı (`VALUATION_KEEP_PRE_REVENUE_FLOOR`) **yalnız aşama ≤ 1** için geçerli (`economy.ts:216-223`'e `stage` parametresi); Seed'den sonra değerleme yalnız gelir çarpanıdır.

```
burnMultiple = Σ(son 3 ay net burn, pozitif) / max(1, (mrr[n] − mrr[n−3]) × 12)   // net ≥ 0 → 0
growthScore  = clamp(0, 1, momAvg / (GROWTH_FULL_K(2) × DILIGENCE_MOM[stage]))    // tavan için aşamanın DD beklentisinin 2 katı MoM
multiple     = (MIN[stage] + (MAX[stage] − MIN[stage]) × growthScore)
               × bmPenalty × idlePenalty × boardPenalty
bmPenalty    = stage ≥ 3 ? 1 − 0.1 × min(3, max(0, burnMultiple − DILIGENCE_BM[stage])) : 1   // Seed/A'da yalnız DD kalemi; üst sınır 3
idlePenalty  = (stage ≥ 3 && cash > IDLE_CASH_MONTHS(36) × aylık brüt gider
                && day − lastRoundCloseDay > IDLE_GRACE_DAYS(180)) ? 0.9 : 1        // büyük tur kapatan hemen cezalanmaz
boardPenalty = flags.boardCapPenalty ? 0.8 : 1                                       // §8.3
MULTIPLE_MIN_BY_STAGE = [4, 4, 3, 2.5, 2, 1.5, 1.5]      // eski MULTIPLE_MIN = 4 sabiti yerine
MULTIPLE_MAX_BY_STAGE = [30, 30, 15, 10, 7, 5.15, 5.15]  // değişmez. Unicorn SÜRESİ ayarı GROWTH_FULL_K'dan yapılır,
                                                          // MAX'tan DEĞİL: MAX'ı yükseltmek coaster'ı da güçlendirir
```
Eski taslak (`5 + 100 × momAvg − ceza`) reddedildi: taban 5, B (7) ve C (5.15) tavanlarının %70-97'siydi; kâra geçmiş coaster'da BM = 0 ve momAvg = 0 → çarpan tavana yakın kalır, sıfır büyüme MIN'e inmezdi. Yeni formülde **sıfır büyüme her aşamada gerçekten MIN verir** (Series C: MRR × 18, bugün × 48; coaster kârda olsa bile tabanda kalır), B'de tavan için ≈ %8 MoM, C'de ≈ %6 MoM gerekir — büyüme B'den sonra da çarpanla ödüllenir, "yakmanın getirisi yok" teşviki ortadan kalkar. Büyüme kesilince değerleme **düşer**; "3 saat bekle" imkânsız. `finance.netHistory` ay sonunda (`world.ts:28 monthEnd`) snapshot alır; `derived.burnMultiple` ve gösterge amaçlı `derived.ruleOf40 = momAvg × 12 × 100 + marj%` eklenir.

**Uygulama notu (dalga 2, B1):** `GROWTH_FULL_K` **2 → 1** indirildi: K=2'de iyi botlar Series C'de (MoM %1-4) takıldı (48 koşunun 2'si 100 dk içinde Unicorn). K=1 ile Unicorn medyanları 73.1 / 60.4 / 82.5 / 66.9 dk (bootstrap / vcRocket / niche / platform), iyi bot medyanı 68 dk. **Açık madde (B2'ye):** arketip farkı 1.37× (hedef ≤ 1.3×, §15); B2 (gider + kanal) sonrası `GROWTH_FULL_K` / `STAGE_TARGET_VALUATION` ile yeniden ölçülür (`STAGE_TARGET_VALUATION` değişirse `content/stages.ts` ve `net/stageRules.ts` birlikte). Seed'den sonra pre-revenue tabanı bir uçurumla düşmez: `post + pre × (1 − blend)` ile gelir $1K MRR'a çıkarken söner.

Due diligence (`round.ts:95 diligenceNow`) 4. kalem: `{id: 'burn', target: DILIGENCE_BM[stage], met: bm ≤ target}`, `DILIGENCE_BM = [99, 99, 3, 2.5, 2, 1.5, 1.5]`; `DiligenceItem.id` union'a `'burn'`. `nextStep 'team'` halkası → `'traction'` ("N kullanıcı + sürüm", `loopText.ts:25` cümlesi silinir).

### 4.2 Giderler ölçeklenir (organizasyon entropisi)

| Kalem | Formül / kural | Dosya |
|---|---|---|
| Yıllık zam | `payday()` içinde `day − hiredDay ≥ 360 && raises < floor((day − hiredDay) / 360)` olan çalışana `salary ×= 1 + RAISE_YEARLY(0.08)`, `raises++` (`raises` tek gerçek kaynak; eski `% 360 < 30` taslağı ilk maaş gününde zam yapıyordu). `money.test` üçlüsü: ilk maaş gününde zam yok, 361. günde ×1.08, 391. günde tekrar yok. `DECISIONS.md #5` bilinçli revizyon: "işe alımda sabit, yılda bir piyasa zammı" | `loop.ts:37`; `hiredDay` zaten yazılıyor (`people.ts:119`) |
| Tur büyüklüğü | `ROUND_RUNWAY_MONTHS` {12,18,24} → **{small 8, target 12, large 16}**, `ROUND_AMOUNT_TABLE_MIN` 0.5 → **0.3** (turların %76'sı tablo tabanında kapanıyordu; tutar gerçekten burn × ay'ı izler, small/large seçimi gerçek olur, tur sonrası runway kısalır, aşama süresi değişmez). Kasa psikolojisinin kaynağı gider formülü değil turun ne kadar nefes verdiğidir (Frostpunk: jeneratör sabit kapasite). `DECISIONS.md #16` revizyonu: "tur 8-16 ay nefes" | `balance.ts:189-202`, `round.ts:46-58` |
| Altyapı | `infra = max(users/1000 × INFRA_PER_1000_BY_STAGE[stage], mrr × INFRA_MRR_SHARE[stage]) × infraMult`; `INFRA_PER_1000_BY_STAGE = [10,10,15,25,40,60,60]`, `INFRA_MRR_SHARE = [0,.05,.08,.12,.15,.18,.18]` | `economy.ts:111`, `balance.ts:122` |
| Koordinasyon | `COORDINATION_TEAM_FREE` 6 → 10, `PER_PERSON` yarıya; toplantı odası cezayı sıfırlamaz, yalnız azaltır; 25+ kişide yalnız `management` politikası (§7.2) düşürür | `economy.ts:19-22` |
| Teknik borç | A'dan itibaren her güncelleme sürümü `techDebt += TECH_DEBT_PER_UPDATE(0.4)` (1.5 değil: aşama başına 15-52 otomatik güncelleme var, 1.5 ile borç vergiye dönüşürdü); ay sonunda doğal amortisman `techDebt −= TECH_DEBT_AMORT_PER_ENG(0.05) × eng` (mühendis tutmanın nedeni); `TECH_DEBT_PER_POINT` 0.05 → **0.02** (hız tabanı 0.5'e 25 puanda); churn `× (1 + techDebt/200)`. **Sink aynı dalgada** (B2): `refactorSprint` (A'dan; `FounderActionKind` yalnız-ekleme, `ToolId 'refactor'` → §3 md.9): `production 0.7 / 30g` + `techDebt −(8 + eng)`, 90 gün cooldown (`flags.refactorUntil`), 2 hamle (§7.1); bot `founder()` techDebt ≥ 30'da çağırır. Sim: iyi botta techDebt C medyanı 20-40, hız çarpanı ≥ 0.7 | `loop.ts:107`, `derive.ts:64,125`, `founder.ts`, `balance.ts:82-83` |
| Pazar genişleme gideri | Açılan segmentin aylık `upkeep`'i deftere (`MonthLedger.expansion`) | §8.1 |
| Kredi faizi / amortisman | `MonthLedger.interest`, `loanRepay` | §6.2 |

Kabul (sim, iyi botlar): aşama min-runway medyanı Seed 3-6 / A 4-8 / B 5-9 / C 6-10 ay; oyun süresinin runway<3 ay payı %15-25. **Otopilot ölçümü** ("B'den önce kâra geçen koşu ≤ %20" kriteri kaldırıldı: kullanıcının niyeti kârı yasaklamak değil "kâra geç, bekle" otopilotunu kırmaktır; eski kriter bootstrap arketipini ve `no-single-path` kavramını silerdi): (a) `coaster`/`idleAfterProfit` 0 Unicorn + tepe sonrası değerleme ≥ %30 düşüş; (b) iyi botlarda **kârda geçirilen ay payı ≤ %35** (koşu değil süre); (c) bootstrap arketipi için ayrı bant (kârda ay payı ≤ %50) ve bootstrap Unicorn süresi diğerlerinin ≤ 1.3×'i; (d) `burner`/`frugal` bot çifti aynı seedlerde: runway'e bakarak yakan Unicorn'a ≥ %15 daha hızlı, runway'e bakmadan yakan ≥ %40 iflas. "Kâra geçen koşu" raporda bilgi satırı olarak kalır.

**İki ayrı ayar kolu** (açık soru 3'ün cevabı): önce **zorluk bantları** (min runway, yakın ölüm) — `ROUND_RUNWAY_MONTHS`, `ROUND_AMOUNT_TABLE_MIN`, `ROUND_NEW_BURN_MULT`, `INFRA_MRR_SHARE`, `RAISE_YEARLY` ile; sonra **süre** (55-95 dk toleransı, ikinci öncelik) — `GROWTH_FULL_K` ve `STAGE_TARGET_VALUATION` ile. `MULTIPLE_MAX_BY_STAGE` ayar noktası değildir. Kademeli uygulama (§18): önce altyapı + CAC doygunluğu + tur sabitleri, ölç; sonra zam + koordinasyon + teknik borç, ölç.

> **B2 uygulama notu (dalga 3):** `ROUND_NEW_BURN_MULT` 1.25 → **1**, `INFRA_MRR_SHARE` → **[0, .06, .10, .16, .20, .24, .24]** (zorluk kolu). `GROWTH_FULL_K` 1 → **0.35** (süre kolu). `refactorSprint` cooldown'u ayrı bayrak (`flags.refactorUntil`) değil genel `cooldowns` girişi; borç < 1 iken `notFound`. Bot refactor eşiği techDebt ≥ 30 değil **≥ 10** (hız ×0.8); 30'da hiç tetiklenmiyordu. Eski kayıtta `raises` tembel varsayılanı hizmet yılıdır (`e.raises ??= years`), geriye dönük zam ödenmez. **Açık karar:** kârlı şirket kasa biriktirdiği için min-runway, runway<3 ve runway>24 bantları kollarla tutmadı (ölçüm: Seed 11.6 / A 6.1 / B 6.6 / C 12.4 ay; runway<3 %5; runway>24 %56; bootstrap kârda ay %54); yapısal kasa çıkışı (§6, §8.1 upkeep) ya da bant revizyonu gerekir.

> **Faz I notu (dalga 12, T20):** §6 ve §8.1 indikten sonra da bantlar kollarla oturmadı. Zorluk kolu `INFRA_MRR_SHARE` → [0, .06, .18, .16, .16, .22, .22], `ROUND_AMOUNT_TABLE_MIN` 0.25 (`RAISE_YEARLY` 0.10 denendi, etkisiz); süre kolu `MARKET_SIZE_SCALE` 2.5. 24 seed: min-runway Seed 7.3 / A 5.2 / B 3.9 / C 6.0 ay, runway<3 %6, runway>24 %49, kârda ay %39 (bootstrap %44), Unicorn 77.9–92.2 dk (1.18×). Öneri DECISIONS #21'de (gider gelirle ölçeklensin + §4.3 doygunluk eğrisi, ya da bant revizyonu).

### 4.3 Ücretli kanal doyar, organik ve churn pazara bağlanır

```
pen     = users / tam                                   // tam = Σ açık segment büyüklüğü (§8.1)
cac     = 45 × 1.7^stage / (0.5 + mat)
          × (1 + CAC_SPEND_K(1) × (adBudget / max(mrr, CAC_SPEND_FLOOR[stage]))^CAC_SPEND_EXP(1.5))   // harcama doygunluğu: süper-lineer → asimptot değil TEPE
          × (1 + CAC_SATURATION_K(3) × pen²)                                       // pazar doygunluğu
CAC_SPEND_FLOOR = [500, 2K, 10K, 50K, 250K, 1M, 1M]
paid    = adBudget / cac × (1 − pen)
organic = marketing × 42 × (0.5 + rep/100) × mat × max(0.1, 1 − pen) × (1 − Σ rival.share × RIVAL_ORGANIC_SHARE(0.2))   // Σshare ≤ RIVAL_SHARE_TOTAL_MAX(0.25)
churn   = max(CHURN_MIN(0.025), 0.06 × (1 − min(0.6, ops×0.02)) × (1 + overload) × (1.5 − mat))
          × (1 + CHURN_SATURATION(0.5) × pen) × (1 + techDebt/200) × modifiers
arpu    = arpu_base × (1 − Σ rival.share × RIVAL_ARPU_SHARE(0.05))                  // fiyat baskısı (dalga 5 sim: 0.5/0.2 C'de 400+ gün yaktı)
```
Reklam bütçesi MRR'ye eşitken CAC 2× → "reklamı 2×" içbükey; üs 1.5 sayesinde `paid`in tepesi vardır (ads ≈ 2×MRR'de düşmeye başlar) — lineer taslakta `paid → mrr/cac0` asimptotu ve `MRR_eq = MRR × arpu/(cac0×churn)` C'de 3.4 > 1 olduğundan doygunluğa rağmen sınırsız büyüme kalıyordu. Yine de coaster'ı nihai durduran doygunluk değil, gerçek TAM (§8.1) ve büyüme-ölçekli çarpandır (§4.1); bu yüzden `coaster 0/N` kriteri E1'de kesinleşir (§16). Pazar %70 dolunca reklam fiilen boşa gider ve ufukta `'saturation'` öğesi çıkar. Pazar ve rakip terimleri §8'de tanımlanır; §4 dalgası onlar gelmeden `pen = users / MARKET_FALLBACK_TAM[stage]` (§8.1 tablosunun büyüklükleri) ve `Σshare = 0` ile çalışır.

> **B2 sapması (dalga 3, kullanıcı onayı bekliyor):** `CAC_SPEND_K` 1 → **0.75** (1'de C'de en iyi ücretli büyüme ≈ %3.7/ay churn'ün altında kaldı, 1/24 Unicorn); ücretli tepe hâlâ ≈ 1.92×MRR, "2×MRR'de düşer" korunur. `MARKET_FALLBACK_TAM` §8.1 büyüklüklerinin **×4**'ü (ara değer, E1'e kadar): §8.1 değerleriyle iyi botlar 0/48 Unicorn'a ulaştı (pen 0.7'de kanal gücü ≈ 0.12). E1 `openSegment` öne çekilmezse bu değer açık karardır.

### 4.4 Harcama önizlemesi (onaylı fikir 6, Into the Breach telegrafı)

`loopSelectors.ts`'e saf `previewSpend(s, {cashDelta = 0, burnDelta = 0}): {runwayNow, runwayAfter, deathDay: number | null, paydayShort: boolean}`; `deathDay` = `cash − owed + cashDelta + (net − burnDelta) × t < 0` olan ilk gün (maaş günü granülerliğinde). Aynı çekirdek `cashProjection(s, months)` (§14.2) tarafından kullanılır. UI her *commit* butonunda (İşe al, Satın al, Reklam kademesi, Segment aç, Satın alma) `runway 9 → 7 ay` çipini bundan çizer (§10.2 D3).

## 5. Kış takvimi ve yönetmen

Bilinen fırtına en ucuz gerilimdir: tarih kesin, içerik 30 gün kala açığa çıkar (Frostpunk fırtına tahmini + Loewenstein bilgi boşluğu). `PLAN.md` "rastgele ceza yok" ilkesiyle uyumlu.

### 5.1 Takvim

`GameState.calendar: CalendarEntry[]`, `CalendarEntry {id: CrisisId | null, day, revealDay, fired?: true}`. Takvim **aşamaya değil zamana** bağlıdır (aşama başına tek kriz reddedildi: Pre-seed medyanı ~110 gün → kriz yarı koşuda aşama bittikten sonra düşerdi, Series C 26 ay → 2 yıl tek fırtına, sonrası otopilot). İlk kriz Pre-seed'e girişte `stageStartDay + rng.int(30, 80)`; her kriz ateşlenince sıradaki `day + CRISIS_INTERVAL_DAYS[stage] + rng.int(−30, 30)` ile planlanır, `CRISIS_INTERVAL_DAYS = [—, 150, 180, 210, 240, 270, 270]`. Aşama değişince bekleyen kriz **iptal edilmez, tarihi korunur**; kimlik (`id`) `revealDay`'de o anki aşamanın havuzundan seçilir (`CRISIS_POOL[stage]`, aynı kriz iki kez gelmez; havuz bitince önceki krizin hafif varyantı, `severity × 0.7`). Ufuk için iki eşik: `CRISIS_HORIZON_DAYS(60)` — tarih "?" olarak görünür (kimlik gizli; 60 gün, tur süresine eşit: oyuncu turu krizden önce ya da sonraya planlayabilir); `CRISIS_TELEGRAPH_DAYS(30)` — `revealDay`'de kimlik + ikon, event `crisisRevealed`. `tick.ts:96 daily()` → `fireCalendar`: `day`'de `applyEffects(effects(severity))` + `bringCardNow(cardId)` (o gün başka kart varsa kriz kartı öncelikli, §3 md.11) + event `crisis`, ardından sıradaki kriz planlanır.

**RNG zinciri** (`enterStage`/`closeRound`/`progressRound`'da `Rng` yok; `s.rng`'den yerel `new Rng` açmak canlı rng ile aynı diziyi tekrarlar — gizli determinizm hatası): C1'de tek seferde `progressRound(s, content, dt, roundSpeed, rng)` → `closeRound(s, content, rng)` → `enterStage(s, stage, rng?)`; `winRun` (`endgame.ts:59`) rng'siz çağırır (Unicorn'da kriz/rakip yok); `src/engine/endgame.ts` C1 dosya listesine girer. Migrasyonda rng kullanılmaz: `calendar ??= []`, bekleyen giriş yoksa ilk `daily()`'de planlanır (tembel; "aynı seed → aynı takvim" testi bu yolla da geçer).

İçerik `src/content/crises.ts` (`ContentBundle.crises`, opsiyonel — §3 md.9), havuz aşamaya göre; erken krizler **kasaya dokunur** (yüzde şoklar kasa-zengin şirkette hissedilmiyordu):

| Aşama | Kriz | Etki (süreli modifier, `1 + (v−1) × severity`) | Hafifletme kartı (2 seçenek, `category: 'crisis'`) |
|---|---|---|---|
| Pre-seed | `lease-hike` | kira ×1.8, 90 gün **+ depozito `−rent × 3` tek sefer** | Kabul et / uzaktan çalışmaya geç (`remote-first` politikasını açar) |
| Seed | `cac-war` | cac ×1.6, 90 gün; adlı rakibin ilk kampanyası (§9) **fiyat kırar: arpu ×0.9, 90 gün** | Fiyatı koru (arpu korunur, churn ×1.2) / indirime eşlik et (arpu ×0.9 kalıcı 180 gün, churn ×0.8) |
| Series A | `key-account-renewal` | en büyük 2 kurumsal sözleşme kriz gününde yenilemeye düşer, `hold` olasılığı −0.2 (§8.4) | Yeniden pazarlık / SLA yatırımı (kasa −burn×0.5, olgunluk +) |
| Series B | `investor-winter` | `multipleCap ×0.6`, `DILIGENCE_MOM ×1.5`, 120 gün | Tur ertele / köprü kredi (§6.2) |
| Series C | `market-correction` | churn ×1.4 + yatırımcı kışı, 90 gün | Kesinti (maaş ×0.9, moral −8) / nakit yak (segment upkeep ×1.5 sürdür) |

`severity = CRISIS_SEVERITY_BASE(0.5) + CRISIS_SEVERITY_PER_PRESSURE(0.4) × director.pressure` (dalga 5: taslaktaki 0.7 + 0.6p C'de baskı 1'de 1.3 verip iyi botu ~300 gün geciktirdi; yeni değer C'de eski 0.9'u korur). Ufuk: `HorizonKind` += `'crisis'`, `HorizonItem.hidden?: boolean`; `HORIZON_DAYS` 42 diğer öğeler için kalır, kriz için `CRISIS_HORIZON_DAYS` 60 → kriz 60 gün kala **"? · 58g"**, 30 gün kala adı ve ikonuyla görünür. `derived.nextCrisis?: {day, id | hidden}` ufuk şeridi geri sayımı için. Ay fişine tek satır teaser: "→ 12g · Yatırımcı kışı" (§11). Kabul: koşuda krizler arası boşluk 150-300 gün; C'de ≥ 2 kriz; aşama değişiminde bekleyen kriz kaybolmaz ve üst üste binmez (test).

**Bot hazırlığı** (bilinen fırtınanın bütün değeri hazırlıktır; hazırlanmayan bot ölçümü sahteleştirir): iyi bot tarih "?" göründüğü andan itibaren **hazırlık modu** — işe alım durur, `adBudget ×0.5`, tür açığa çıkınca türe göre rezerv (`lease-hike`: `rent×3` nakit; `cac-war`: reklam kes, fiyatı koru; `key-account-renewal`: SLA yatırımı; `investor-winter`/`market-correction`: `fundraise` `nextCrisis.day − day < weeksMax×7 + 14` ise turu krizden önce kapatmaya başlar ya da krizden sonraya erteler; runway < 4 ise yine başlatır — oyuncunun ikilemi). `careless` hazırlanmaz. Sim kriteri: hazırlanan botun kriz sonrası min runway'i hazırlanmayanın ≥ +2 ayı; hazırlanmayan botlarda kriz sonrası payday runway<2 ≥ %40. Kriz kartı seçimi `scoreOption` ile.

### 5.2 Yönetmen (RimWorld adaptasyonu; baskı servete ölçeklenir)

`GameState.director: {pressure, graceUntil, angelUsed?}`; `world.ts` günlük `updateDirector`:
```
raw      = 0.2 + 0.1×stage + 0.25×[runway null veya >12] + 0.2×[profitMonths ≥ 3]
           + 0.1×[momAvg > 0.15] − 0.4×[day < graceUntil]
pressure = clamp(0.1, 1, raw)
```
`payrollMissed` → `graceUntil = day + DIRECTOR_GRACE_DAYS(180)`. Kullanım: **kart sıklığına dokunmaz** (`CARD_DAILY_CHANCE` sabit 0.08, §3 md.11 — eski `× (0.5 + pressure)` taslağı kârlı oyuncuda popup'ı 1.5×'e çıkarıyordu, kullanıcı isteği 4'ün tersi); kriz/rakip kartı *ağırlığı* `× (1 + pressure)` (`decisions.ts:61` havuz seçiminde), kriz şiddeti (§5.1), rakip `strengthTarget` (§8.2). Kâra geçince baskı yükselir — daha sert fırtına ve daha güçlü rakip, daha çok popup değil; yakın ölümden sonra oyuncuya nefes verir (spiral değil toparlanma).

**Tek seferlik melek:** `missedPayroll` (`loop.ts:74`) içinde `stage ≤ 2 && !director.angelUsed` → `RESCUE_CARD_ID` yerine `bringCardNow('angel-lifeline')`: seçenek 0 `cashBurnMonths: 2` (yeni `EffectBundle.cashBurnMonths`), `equity −0.05`, `director.angelUsed = true`; seçenek 1 normal kurtarma. Bir daha gelmez.

## 6. Karar masaları: maaş günü, kredi, tur düşmesi

Krizin indiği yerde oyuncuya **seçim** verilir; hiçbir masa otomatik ölüm değildir ama her seçim iz bırakır.

### 6.1 Parası yetmeyen maaş günü (Papers Please masası)

`FinanceState.pendingPayday?: {day, ledger: MonthLedger, deferredBefore}`, `FinanceState.deferred: number`; `MonthLedger/MonthReceipt` += `deferred?, interest?`. `payday()` (`loop.ts:37`): `paid = ledgerCosts + deferred × (1 + DEFER_INTEREST(0.05))`; `cash ≥ paid` → eskisi gibi tek kalem (#15 korunur). Değilse `pendingPayday` yazılır, event `paydayShort` (value = açık), ledger sıfırlanmaz.

**Zaman akışı (tek tutarlı kural):** masa ortada açılır ve **açıkken** durdurur (`PauseReason 'payday'` = `pendingPayday && overlay.kind === 'payday'`). Oyuncu "Sonra" ile kapatabilir: zaman akar, ufuk şeridinde kırmızı **`3g`** geri sayım (tek sayı, cümle yok; yalnız masa kapalıyken görünür — duran zamanda akmayan sayaç yok), maaş ikonu tıklanınca masa yeniden açılır. Cevapsız `PAYDAY_DECIDE_DAYS(3)` → deterministik sıra maaş → altyapı → kira → kurucu → reklam, kasa bitene kadar öde, kalanı ertele; tek P0 şerit öğesi "Maaş yarım ödendi". Bot aynı `resolvePayday` fiilini kullanır ya da 3 günü bekler (sim = oyun, §3 md.2).

Action `{type: 'resolvePayday', choice: PaydayChoice}`, `PaydayChoice = {salaries: 'full'|'half'|'defer', rent: 'pay'|'defer', infra: 'pay'|'defer', ads: 'pay'|'cut', founder: 'pay'|'skip'}`:

| Kalem | Erteleme sonucu |
|---|---|
| Maaş `half` | tüm çalışan `morale −8`; `defer`: `−15`; **`deferred > 0` iken moral hedefi −10** (`MoraleTargetInput` terimi; ödenince kalkar — tek seferlik delta yetmez, `approachMorale` %5/gün ile 14 günde eritir ve RESIGN 28'e inmezdi); `people.ts:90` istifa yolu doğal işler; tutar `deferred`'a |
| Kira `defer` | `flags.rentDeferredMonths++`; 2 → kriz kartı `landlord-notice` (kira ×1.5 / 6 ay ya da taşınma cezası); **3 → `eviction`**: `capacity ×0.5` + zorunlu taşınma bedeli `RING_OPEN_COST` |
| Altyapı `defer` | 1. → `modifiers.push({kind: 'capacity', value: 0.7, untilDay: day+30})` (yeni `ModifierKind 'capacity'`); **2. ardışık → `capacity 0.4`** (churn patlar) |
| Reklam `cut` | reklam **ertelenemez** (tüketilmiş gider bedava tedarikçi kredisi olmaz): `pay` bu ayı öder, `cut` bu ayı öder ve gelecek ay `adBudget = 0` |
| Kurucu `skip` | `energy −20` |

`deferred` **`owedCosts`'a ve runway'e katılır** (runway yalan söylemez; `derived.owedCosts`). İflas saati (`endgame.ts:69 payrollMissed`, sayacı aynen): `salaries !== 'full'` **veya** kasa yine <0 **veya `deferred > DEFER_CAP_MONTHS(1) × aylık brüt gider`** — maaşı tam ödeyip kira+altyapı+kurucuyu her ay erteleyen şirket ölümsüz değildir. Bot: iyi bot `salaries: 'full'` mümkünse, sonra `infra`, `rent: 'defer'`, `ads: 'cut'`, `founder: 'skip'`; careless rastgele. Regresyon: kâra geçmiş koşuda `paydayShort` hiç ateşlenmez.

### 6.2 Kredi = şeytanla anlaşma

`FinanceState.loan?: {principal, balance, rateMonthly, monthsLeft, covenantRunway, covenantFromDay, interestOnlyUntil, breaches}`; `debt` = `loan.balance` (geriye uyum, `round.ts:336` tur kapanışı bakiyeyi kapatır). `EffectBundle.loan?: {burnMonths, months, rate, covenantRunway?}` (`covenantRunway` varsayılanı `burnMonths × 0.5`); `effects.ts:97-103` `LOAN_FLAGS` yerine: `amount = max(burn × burnMonths, LOAN_MIN[stage])`, `cash += amount`. **Tek kredi:** `loan` varken kredi seçenekleri kart `condition`'ında kapanır. `emergency-bridge` sabit `+$15K` (`decisions.ts:1249`) → `emergency-loan {burnMonths: 3, months: 12, rate: 0.03, covenantRunway: 1}`; `vc-bridge-loan {burnMonths: 4, months: 9, rate: 0.02, covenantRunway: 2}` + `equity −0.03`.

Eski sayılar (covenant 2/3, ilk aydan amortisman, 2 ihlalde tam çağrı) kendi covenant'ını otomatik ihlal ediyordu: gelirsiz şirkette 3G kredi, 0.34G/ay servis → runway 2.2 ay → 1. ayda ihlal, 2. ayda 2.5G çağrı, kesin ölüm; 8-12 haftalık tur çağrıdan önce kapanamazdı. Yeni akış: `payday()`: `interest = balance × rate`; `day < interestOnlyUntil = takenDay + LOAN_INTEREST_ONLY_MONTHS(6) × 30` → amortisman yok (servis 0.09G), sonra `amort = balance / monthsLeft` → ledger satırları. Covenant yalnız `day ≥ covenantFromDay = takenDay + LOAN_COVENANT_GRACE_DAYS(90)` sonra ay sonunda ölçülür: `runway < covenantRunway → breaches++`; **1. ihlal** → event `loanWarning` (ufukta 30 gün sayacı); **2.** → `callLoan` bakiyenin %50'si çekilir + `rate ×1.5`; **3.** → tam çağrı, `loan = undefined`, event `loanCalled` (kasa <0 → maaş masası / iflas yolu). Test: kredi alan gelirsiz şirket tur kapatmadan ≥ 90 gün yaşar. Bot `scoreOption` (`bots.ts:153`): `runway < 3 && !loan && stage ≤ 3 ? +cash×w×0.5 : −∞`; careless her zaman alır. Hedef: iyi botların ≤ %30'u kredi alır; **kredi alan iyi botların ≥ %50'si 12 ay sonra hayatta**.

### 6.3 Tur kaybedilebilir

`RoundState.strikes`, `RoundState.ddStart` (tur başında DD snapshot'ı), `flags.roundFailedDay`. `weekPassed` (`round.ts:275`): strike yalnız **tur başında met olup sonradan bozulan** kalemler için sayılır (yatırımcı bildiği sayıya kızmaz; eski "≥ 2 unmet" kuralı Seed'de `burn` kalemi hep unmet olduğu için 3 haftada her turu düşürürdü): bozulan ≥ 2 → `strikes++`, değilse `max(0, strikes−1)`. `strikes ≥ ROUND_FAIL_STRIKES(3)` **veya ≥ 4. haftada** `metricsFactor === ROUND_OFFER_FLOOR` (kapanışta değil — 8-12 hafta boşa harcatıp öldürmez) → `failRound`: `active = false`, `reputation −10`, `applyMorale(−8)`, `flags.roundFailedDay = day`, event `roundFailed`; `enterStage` çağrılmaz. `canStartRound` (`derive.ts:202`) += `day − roundFailedDay ≥ ROUND_RETRY_DAYS(14)` (45 değil: 45 + yeni tur 56-84 gün ≈ 4 ay ≥ hedef min runway → düşen tur = ölüm olurdu). Düşen turdan sonra tek seferlik **down round** (`roundView.downRound`, `startRound({down: true})`: tutar ×0.7, hisse ×1.5, `metricsFactor` tabanı kalkar) hayatta kalma kapısıdır. `roundView` += `risk: strikes/3` (üst bar tur çipi renkle taşır). `investor-winter` DILIGENCE_MOM ×1.5 → düşme oranı doğal artar. Bot `fundraise` (`bots.ts:373`): DD ≥ 3/4 met değilse tur başlatmaz (runway < 4 hariç); `strikes ≥ 1` → coinvestor pitch (hafta kısaltır) + moral/burn onarımı; `roundFailed` → 14 gün sonra down round ya da onarım. Hedef: turların %10-20'si düşer (24 seedde 5-10 tur). `DECISIONS.md #16` "tur her zaman kapanır" değişir.

## 7. Kurucu hamle bütçesi ve şirket politikaları

### 7.1 Haftalık hamle bütçesi (onaylı fikir 3; sınırlı işgücü)

`FounderState.moves: {left, weekStart}`. Bütçe **Pre-seed'den** başlar (`MOVES_FROM_STAGE = 1`, `MOVES_PER_WEEK = [—, 3, 3, 4, 4, 5, 5]` + politika bonusu): Garaj'ın tek fiili findUsers'tır, orada mevcut enerji/cooldown sistemi aynen kalır — 3/hafta bütçe Garaj'ı yarıya indirip Pre-seed varışını (bugün 4.2-4.4 dk, M1) uzatırdı. Kabul: Pre-seed varış medyanı ≤ 5 dk, 5 dk'da ≥ 3 kavram (F1 kapısında ölçülür). Pre-seed'den itibaren **tek bağlayıcı kısıt hamle bütçesidir** (enerji 12 / regen 8 zaten haftada 4-5 aksiyon veriyordu; iki gösterge tek kısıt = gerilim yok): aksiyon enerji maliyetleri 0, `cooldownDays` 0, doygunluk kalır; `energy` yalnız `rest` ile dolan, kurucu `skip` (§6.1) ve `crunch-culture`/`founder-burnout` (§7.2, §9.2) ile eksilen sağlık göstergesi olur (bar'da kalır, aksiyon kilitlemez; 0'a inince `founder-burnout` tetiklenir). `FounderActionDef` += `moves` (findUsers 1, talkToUsers 1, motivateTeam 1, investorCoffee 1, salesCall 2, rest 0); **geç fiiller de bütçeden düşer**: `roundPitch` 1 (tur haftasında kurucu satışa gidemez — gerçek gerilim), `renewContract` 1, `refactorSprint` 2, `acquireRival` 2, `adoptPolicy` 1, `openSegment` 1; `answerDecision` düşmez. `founderActionError` (`founder.ts:74`) → `moves.left < def.moves` → `ActionErrorCode 'noMoves'` (`strings.ts ACTION_ERROR_TEXT` aynı dalgada, §3 md.9); `daily()` `day % 7 === 0` → yenilenir. `derived.moves: {left, total, resetDay}` → alt barda slotların yanında `3/4` sayacı. Bot `founder()` (`bots.ts:332`) öncelik sırasıyla harcar; salesCall ≤ 80/koşu ve `topActionShare ≤ 0.3` bütçe rekabeti + bot önceliğinden gelir; asıl sim kriteri **C'de hamle kullanım payı ≥ %70** (`movesUsedShare`; kalabalık aşamada bütçe gerçekten dolu).

**Uygulama notu (dalga 8, T13):** istifa kartındaki "konuş" cevabı da bütçeden düşer (`MOVE_COST.talkResignation = 1`; bedava konuşma zamdan iyi olmasın). Pre-seed'e girişte (`enterMoveBudget`) enerji dolar, Garaj cooldown'ları silinir, tam hafta verilir. **Açık karar (kullanıcı):** `refactorSprint` bütçe altında da 90 g cooldown'unu korur (etkisi bir ay sürer, cooldown'suz üst üste biner; §4.2 / B2 ile tutarlı) — bu paragraftaki "`cooldownDays` 0" kuralına tek istisna; 0'a çekilecekse `founder.ts cooldownDays` tek satır. Açık sim kriterleri: salesCall ≤ 80/koşu (en kötü koşu ~280, Unicorn'a varamayan uzun koşular) ve `topActionShare ≤ 0.3` (%32) geç fiiller (T15/T17/T19) bütçeye girince yeniden ölçülür.

### 7.2 Şirket politikaları / Kanun Kitabı (creeping normality)

`GameState.policies: {adopted, lastSignedDay}`; içerik `src/content/policies.ts`:
```ts
Policy { id, tree: 'growth'|'craft'|'survival', tier: 1|2|3,
  unlock: (s) => boolean, excludes?: PolicyId[], effect: PolicyEffect }
PolicyEffect { mult?: Partial<Record<PolicyKind, number>>, moraleTarget?: number, movesBonus?: number }
PolicyKind = ModifierKind | 'salary' | 'rent' | 'infra' | 'energyRegen' | 'coordination'
```
v1 seti (12). Etkiler **keskin ve iz bırakan** (±%10 düğmeler reddedildi: survival yığını burn'ü ×0.85 yapıp runway 3 → 3.5 ay verirdi, yakın ölümün kapısı olamazdı; `crunch-culture`/`profit-share`/`quality-gate` baskın strateji, `management` zorunluydu):

| Ağaç | Politika | Kilit | Kalıcı etki |
|---|---|---|---|
| survival | `salary-freeze` | runway<8 | yıllık zam yok **+ işe alım kalitesi tavanı 1.0**, moral −4 |
| survival | `founder-no-pay` | runway<5 | kurucu gideri 0, enerji regen ×0.7 |
| survival | `lean-office` | runway<6 | kira ×0.8, capacity ×0.9 |
| survival | `deferred-pay` | runway<3 | **maaş ×0.6, istifa riski ×2**, moral −10, tur kapanışında fark ödenir |
| survival | `layoff-round` (yeni) | runway<3 | **anında ekip −%30** (kıdem 0), rep −15, moral hedefi −20 / 90g; tek seferlik ama politika kalır (bir daha kıdem yok) |
| growth | `hire-fast` | stage≥1 | aday havuzu +2, maaş ×1.1 |
| growth | `ads-first` | stage≥3 | cac ×0.9, organic ×0.9 |
| growth | `crunch-culture` | stage≥2 | production ×1.2, +1 hamle, **techDebt +1/ay, enerji regen ×0.7, `founder-burnout` gizli kartını açar**, moral −6 |
| craft | `quality-gate` | stage≥2 | churn ×0.85, production ×0.85, **sürüm aralığı ×1.5** |
| craft | `remote-first` | `lease-hike` krizi veya stage≥2 | kira ×0.6, koordinasyon cezası ×1.3 |
| craft | `profit-share` | profitMonths≥3 | moral +6, maaş ×1.12, **burn multiple DD kalemi +0.5 tolerans** |
| — | `management` | ekip ≥ 20 | koordinasyon cezası ×0.5, kira ×1.1, **hamle −1** (yönetim toplantısı) |

Her survival imzası **creeping normality'yi görünür kılar**: tur hisse bedeline kalıcı `+0.005` ekler (`roundEquity`) ve `companyProfile.team` eksenini −0.1 düşürür (radar §14.5'te fark anında görünür). Tier 2 growth ↔ craft karşılıklı `excludes`. Action `{type: 'adoptPolicy', policyId}` (1 hamle, §7.1); hatalar `cooldown` (`POLICY_SIGN_COOLDOWN_DAYS = 30`), `notUnlocked`, `invalid`. **Geri alınamaz.** `policyMult(s, content, kind)` (`util.ts:38` yanı); `derive.ts:118-137` her çarpan `× policyMult`, `economy.ts:148 moraleTargetRaw` `+ policies`, `people.ts:21` maaş çarpanı, `founder.ts` enerji. `derived.policies: {available, adopted, nextSignDay}`. Runway düştükçe survival ağacı açılır: sertleşen politika oyuncunun "normal"ini kaydırır (Frostpunk Kanun Kitabı kurgusu, görseli değil).

**UI:** Kanun Kitabı bir çekmece sekmesi değil, `CenterFrame`'de açılan ekrandır (`Overlay {kind: 'lawbook'}`, pause sebebi değil, `y` kısayolu (yasa; `l` Liderlik'in), zaman akar; §14.3): 3 ağaç × kart, kilitli siluet + kilit koşulu sayı olarak, imza cooldown halkası, tek `commit` "İmzala" + `CostPreview`, geri alınamaz uyarısı tek cümle. Büyüme panelinde yalnız tek satır özet ("3 politika · sıradaki 12g") + "›". Bot: iyi bot survival'ı runway<6'da imzalar (`layoff-round` yalnız runway<2 ve kriz yaklaşırken), growth/craft arketipe göre; careless imzalamaz.

## 8. Geç oyun: pazar, rakipler, kurul, yenileme

Her turda bir yeni kısıt + bir yeni fiil + kasayı harcamaya değer bir yatırım. Rakip yapısı §9 ile ortaktır (tek `rivals` dizisi).

### 8.1 Sonlu pazar: segmentler ve doygunluk

`GameState.market.segments: MarketSegment[]`, `MarketSegment = {id, size, openedDay?, upkeep}`; `content/markets.ts`:

| Segment | Büyüklük (mutlak kullanıcı) | Açılış | Bedel (tek sefer) + aylık upkeep | Ek koşul |
|---|---|---|---|---|
| `early` | 2K | Garaj, açık | — | — |
| `smb` | +10K (uygulanan +14K) | Seed'e girişte otomatik | — | — |
| `midmarket` | +50K (uygulanan +68K) | Series A, **fiil** | $250K + $8K/ay | — |
| `enterprise` | +200K (uygulanan +250K) | Series B, fiil | $1.5M + $40K/ay | `enterpriseSales` açık |
| `global` | +450K (uygulanan +700K) | Series C, fiil | $8M + $150K/ay | `ops ≥ 3` (compliance kavramı) |

Büyüklükler eski taslağın (30K / 300K / 1.5M / ×2 / ×3) yerine **aşama çıkışında pen ≈ 0.7** verecek şekilde türetilir — mevcut sabitlerden aşama çıkış kullanıcıları Seed ≈ 7K, A ≈ 37K, B ≈ 143K, Unicorn ≈ 450K (MRR 16.2M / ARPU ≈ 36); eski TAM'la pen A'da 0.11, B'de 0.43 kalır, doygunluk ve `saturation` hiç çıkmazdı. `content/markets.ts` değerleri şu formülle testte doğrulanır: `Σsize(≤stage) ≈ STAGE_TARGET_VALUATION[stage+1] / (12 × MULTIPLE_MAX_BY_STAGE[stage] × ARPU[stage]) / 0.7 × 1.15` (satış sözleşmeleri kullanıcısız MRR getirir, ×1.15 pay); sabitler değişince `market.test` tabloyu yeniden ister. `MARKET_FALLBACK_TAM[stage]` (B2) aynı kümülatif değerlerdi; E1'de silindi (aşağıdaki sapma notu).

> **E1 sapması (dalga 10, T17, kullanıcı onayı bekliyor):** `MARKET_FALLBACK_TAM` ve tek argümanlı `marketTam(stage)` silindi; `derived.tam = Σ açık segment × rampa(60g)`. Tablonun 2K/10K/50K/200K/450K segment büyüklükleri güncel sabitlerle kendi formül testini geçmedi; `content/markets.ts` segment başına **2K / 14K / 68K / 250K / 700K** kullanır (kümülatif 2K/16K/84K/334K/1.03M; aşama 1–5'te formülün ±%25'i). Ayrıca `balance.MARKET_SIZE_SCALE = 2`: engine her segmenti içerik büyüklüğünün iki katı sayar (B2'nin ×4'ünün yerine geçen ara düğme; ×1'de iyi botlar 1/48 Unicorn). Bunun bedeli: aşama çıkış pen'i A/B'de ≈ 0.15 (hedef 0.5–0.9) ve ufukta `saturation` koşu başına 0. **Açık karar (kullanıcı / T20):** §4.3 doygunluk eğrisini yumuşatmak (`CAC_SATURATION_K`, `CHURN_SATURATION` ya da (1 − pen) terimi) ya da çıkış-pen bandını düşürmek; platform arketipinin Unicorn düşüşü (12/12 → 2/12) ayrıca incelenir.

Action `{type: 'openSegment', id}` (1 hamle, §7.1); 60 gün rampa (`RAMP_DAYS`, penetrasyona kademeli girer); geri kapatılamaz. `derived.tam`, `derived.penetration`; formüller §4.3. Ufuk `'saturation'` öğesi `pen ≥ 0.7`. **UI:** Pazar haritası `CenterFrame`'de (`Overlay {kind: 'market'}`, `h` kısayolu (harita; `m` Mağaza'nın), zaman akar; §14.3): segment karoları açık/siluet + kilit + aşama pill'i, `pen` halkası "68%", "Aç $250K" commit + `CostPreview`; rakip satırları ve `acquireRival` bedeli aynı ekranda (§8.2). Büyüme panelinde yalnız tek satır özet + "›".

### 8.2 Adlı rakipler: pay çeker, yutar, yutulur

`GameState.rivals: Rival[]`, `Rival = {id, name, bornDay, strength 0-1, share 0-1, mrr, valuation, momentum: -1|0|1, adaptUntilDay?}`; adlar `content/names.ts RIVAL_NAMES` (8). Seed'e girişte 1 (**baş rakip**, değerleme yarışı ve iplik §9.2), A'da 2., B'de 3. Aylık (`monthEnd`):
```
strengthTarget = clamp(0.2, 0.9, 0.3 + 0.1×stage + 0.2 × (oyuncu MRR / aşama hedef MRR) + 0.1 × director.pressure)
adaptUntilDay içinde ×0.6 (payrollMissed sonrası 180 gün nefes)
başRakip.valuation: doğuşta / aşama girişinde oyuncuDeğerleme × RIVAL_START_RATIO(0.75);
                    aylık × (1 + RIVAL_TEMPO_ASK[stage] × ask × (1 + 0.5 × director.pressure))   // yatırımcının beklediği tempo
RIVAL_TEMPO_ASK = [1, 1, 1, 1, 1, 0.5, 0.5]   // B'ye kadar tam ask (durgun şirket ~4 ayda geçilir); C'de yarım
başRakip.mrr: değerlemeyle aynı anda oyuncu MRR × 0.75'e çapalanır, aynı tempoyla büyür
```
**MRR yarışı (dalga 5):** `rivalPassed` ve 1.05 sıfırlama değerleme değil **MRR** karşılaştırır; C'de çarpan büyümeyi izlediği için oyuncu değerlemesi ±%40 salınıyor, düzgün büyüyen rakip her iyi botu geçiyordu.
Eski `STAGE_TARGET_VALUATION[stage+1] × clamp(...)` taslağı reddedildi: rakip Seed'de 10.5M vs oyuncu 1.5-3M, A'da 60M vs 15M doğar → her aşama girişinde 4-7× öndeydi, `rivalPassed` durgunluğa değil formüle bağlı tetiklenir, gölge çentik hep turuncu kalırdı. Yeni kurguda rakip **tempo belirleyicidir** (DD ile aynı dil): oyuncu ask'ın üzerinde büyüdükçe önde kalır, 3+ ay ask'ın altında kalınca rakip geçer → `rivalPassed` yalnız `rival.valuation > oyuncuDeğerleme` **geçişinde** (bir kez; tekrar geçince yeniden), ilerleme çubuğunda gölge çentik turuncuya döner. Test: iyi bot Seed'de ilk 90 gün `rivalPassed` üretmez; durgun 3 ay → bir kez.

Pay: doğuşta `share = RIVAL_BORN_SHARE(0.10)`; haftalık `share += 0.03 × (strength − oyuncuGüç) + (momAvg < ask ? 0.005 : 0)`, `clamp(0, 0.5)`; `oyuncuGüç = 0.5×avgMaturity + 0.3×rep/100 + 0.2×(1−pen)`; share tek yönlü artmaz (olgunluk 1 + rep 80 → düşer). Eski `0.01 × fark` yılda ±0.016 veriyordu, B medyanı 0.15-0.35 ulaşılamazdı. `flags.rivalPressure = clamp(0, 1, Σ strength×share + 0.2 × başRakip.valuation / oyuncu değerleme)` — 3 mevcut rakip kartı aynen çalışır, daha anlamlı tetiklenir.

**Fiiller (B'den):** `{type: 'acquireRival', id}` (2 hamle): bedel `rival.mrr × 12 × derived.valuationMultiple × 0.8`; kasa yeterse `users += share × tam × 0.6`, `share → 0`, `techDebt += 15`, `morale −8`, `production 0.85 / 60g`. Karşı yön: `acquisition-offer` kartı (`decisions.ts:1073`) `condition: rivals.some(r => r.strength > 0.7)`; kabul → `gameOver.kind = 'acquired'` (alt-bitiş, XP = aşama). **Liderlik tablosu:** `src/net/cloud.ts:362-365 runStatus` bugün `kind !== 'unicorn'` her bitişi `'bankrupt'` gönderir — `'acquired'` için gönderim yapılmaz (son `'playing'` satırı korunur; `contract.ts RunStatus` ve `api/` değişmez), `src/ui/ModalHost.tsx:11 gameOverOverlay` parametresi `GameOverState['kind']` olur ('acquired' → geçici `postMortem`, H6'da kendi ekranı). `cloud.ts` ve `ModalHost.tsx` E2 dalgasının dosya listesine girer; aksi halde E2 typecheck kapısı geçemez. Bot Unicorn oynar (`−∞`), careless rastgele.

### 8.3 Yönetim kurulu çeyrek hedefi (A'dan)

`GameState.board: {quarterStart, targetMrr, missed, streak}`. A'ya girişte ve her 90 günde `targetMrr = mrr × (1 + growthAsk(s))^3` (`round.ts:69`). Çeyrek sonu: tuttu → `streak++`, `reputation +3`, sonraki turda `roundEquity −0.005`; kaçırdı → `missed++`, event `boardMissed`; 2 ardışık → `flags.boardCapPenalty` (çarpan ×0.8, §4.1; hedef tutunca kalkar) + kriz kartı `board-review` ("CEO değişimi mi, plan revizyonu mu?": `equity −0.02` ya da `production 0.9 / 60g`). Ufuk `'board'`: "Kurul $X · 23g" — önceden bilinen sınav. Kaçırma öldürmez, toparlanma kapısı bırakır.

**Uygulama (dalga 11, DECISIONS #25):** hedef formülü aynen; bir çeyrek kaçınca sonraki hedef `growthAsk × BOARD_REVISED_ASK (0.5)` ister [DENGE] (tam ask'ta iyi botlar çeyreklerin %47'sini kaçırıyor, ×0.8 tavanı Unicorn'u 35/48 → 23/48'e düşürüyordu). Kurul kredisi (en çok 4 × 0.005) tur **kapanınca** harcanır; başarısız tur krediyi korur.

### 8.4 Kurumsal sözleşme yenileme (A'dan; B'de balina)

`expireContracts` (`founder.ts:59`) yerine: `untilDay − 30`'da `HorizonItem 'renewal'` + event `renewalDue`; Action `{type: 'renewContract', id, offer: 'hold'|'discount'}` (1 hamle): `hold` → başarı `0.5 + 0.5×avgMaturity − 0.3×Σshare` (rng; `key-account-renewal` krizi −0.2), başarıda **mrr ×1.1** (fiyat artışı); `discount` → mrr ×0.85 kesin **ve `contract.discounted = true`: sonraki yenilemede taban zaten ×0.85, `hold` şansı −0.1** (indirim iz bırakır; eski EV'de `hold` 0.77 < `discount` 0.85 hep indirim baskındı). Cevapsız → düşer (mevcut davranış). Yenilenen sözleşme 360 gün. `refactorSprint` B2'de tanımlandı (§4.2); burada yalnız `ToolId 'refactor'` açılışı A'dadır.

**Uygulama (dalga 11, DECISIONS #25):** her sözleşme değil, bildirim gününde en büyük `RENEWAL_KEY_ACCOUNTS = 4` sözleşme yenilemeye düşer (karar bildirim gününde bir kez verilir); küçükler eskisi gibi süresi dolunca düşer [DENGE] (her sözleşme yenilenince koşu başına ~320 yenileme, `renewContract` en sık fiil oluyordu). Series C hedefi `c-profit` yerine `c-reach`: toplam 2 pazar (en az 1'i C'de açılmış) + C'de 1 yenileme; eski kayıtta kazanılmış `c-profit` → `c-reach`. `acquired` XP'si `XP_PER_STAGE × (1 + stage)` (aynı aşamadaki iflasla eşit); bulut skoru `acquired` koşusunu göndermez.

### 8.5 Aşama fiil tablosu

| Aşama | Baskın kısıt | Yeni fiil | Kasa yatırımı | Bilinen fırtına |
|---|---|---|---|---|
| Garaj | Nakit, ilk sürüm | findUsers / talkToUsers | Masa | — |
| Pre-seed | Ekip/odak, hamle bütçesi | motivateTeam / investorCoffee, ilk politika | Halka | `lease-hike` |
| Seed | **Baş rakip belirir**, fiyat/kalıcılık, smb açılır | salesCall + fiyat, survival politikaları | Toplantı odası, ilk pazarlama kadrosu | `cac-war` |
| Series A | **Pazar doygunluğu**, teknik borç, **kurul çeyreği** | `openSegment('midmarket')`, `refactorSprint`, `renewContract` | $250K segment, refactor ayı | `key-account-renewal`, kurul |
| Series B | **Balina yenilemesi**, 3 rakip, zam dalgası, tur düşebilir | `acquireRival`, `openSegment('enterprise')` | $1.5M segment, satın alma $5-30M | `investor-winter`, kurul |
| Series C | **Rule of 40 sıkışması**, boşta nakit cezası, tüm segmentler dolar | `openSegment('global')`, M&A, ikinci ürün (`c-full`) | $8M global | `market-correction`, kurul |
| Unicorn | Bitiş; kurucu karnesi | — | — | — |

`content/stages.ts unlockTools` += `'segments'`, `'refactor'`, `'renewal'`, `'mna'` (`TOOL_IDS`; `strings.ts TOOL_TEXT` aynı dalgada, §3 md.9); `roadmap.ts` satırları ≤6 kelime. Kilitli fiiller alt barda gri siluet (§9.4); kilitli **Dock araç sekmesi** siluetleri (`segments`/`mna`) E dalgalarından sonra H5'te yapılır, H3'te değil (H3 E'ye bağlı değildir).

## 9. Merak senaryosu: kadro, iplikler, siluetler

Merak = kısmi bilgi + kapatılabilir boşluk + yaklaşınca artan gerilim. Üç kaynak: aşama açılışları (zaten var, siluet yok), rakip (§8.2 ile ortak), tekrar eden karakterler. Yeni metin yalnız teaser (≤6) ve kart sorusu (≤12). Yeni Action yok; iplikler `answerDecision` üzerinden ilerler.

### 9.1 Sabit kadro

`GameState.cast: Record<NpcRole, string>` — `createGame`'de `rng.pick(NPC_NAMES[role])` ile bir kez; tüm balon/kart konuşmacıları bu adı kullanır (bugün UI roldan türetiyor, `worldBubble.tsx`, `DecisionBubble.tsx`). Aynı seed → aynı kadro (test).

### 9.2 Kart iplikleri

`DecisionCard.thread?: {id: ThreadId, step, after?: number[]}`, `ThreadId = 'mentor'|'investor'|'customer'|'rival'|'press'`. `isCardEligible` (`decisions.ts:20`): `step > 1` ise `history`'de aynı ipliğin `step−1` kartı olmalı; `after` verilmişse o adımın `h.optionIndex`'i listede olmalı (`optionIndex` zaten yazılıyor, `decisions.ts:86`; migrasyon yok). İplik kartları `weight: 3`, **iplik başına aşama başına en fazla 1 kart** (`flags.threadShownStage: Partial<Record<ThreadId, StageIndex>>`; eski "aşama başına 1 iplik kartı" kuralıyla koşuda en fazla 6 iplik kartı görülür, 5/5 tamamlama matematiksel olarak imkânsızdı) ve normal `CARD_COOLDOWN_DAYS` kotasını tüketir (§3 md.11), yeni `DecisionCategory 'thread'` (`strings.ts DECISION_CATEGORY_TEXT` aynı dalgada; balonda iplik ikonu). Save değişmez, replay bozulmaz.

`content/threads.ts` ≈ 22 kart, 5 iplik:

| İplik | Adımlar |
|---|---|
| Mentor (Nevin) | Garaj → C her aşamada 1; son adım Unicorn'da "senin yolun" |
| Yatırımcı (Bora) | Pre-seed tur → A kurula girer (kriz haberlerini o verir) → B büyüme hedefi → C çıkış (mevcut `acquisition-offer`/`ipo` `step: 5`'e bağlanır) |
| Müşteri (Aylin) | Garaj ilk kullanıcı → Seed ücretli → A kurumsal SLA → B yenileme/churn (`key-account-renewal` ile aynı gün) |
| Rakip | Pre-seed `rival-rumor` (adsız) → Seed doğuş → A fiyat savaşı (mevcut 3 kart `step: 3`) → B `rival-buy-them` / `rival-buys-you` → C `rival-ipo-race` |
| Basın (Tuna) | Seed ilk haber → A kötü haber → B kapak |

**Gizli kartlar** (`secret?: true`, 4): `viral-spike` (**`users ≥ 2000 && stage ≥ 2` ve** tek ayda kullanıcı ×2 ve rep ≥70 — tabansız hali Pre-seed sürüm dalgasıyla her koşuda tetiklenirdi), `team-mutiny` (moral < 35 ardışık 60 gün, ekip ≥ 6), `rival-dies` (rakip strength < 0.25 ardışık 3 ay), `founder-burnout` (enerji 0 ya da `crunch-culture` + 6 ay); nadir ama deterministik, 24 seedde her biri 2-12 koşu. İplik kartları eklenirken havuzdan eşdeğer sayıda zayıf kart emekliye ayrılır (`CONTENT.decisions` ≤ 65, §3 md.11). Merak kriteri: `threadsDone ≥ 3/5` iyi bot ≥ %60 (5/5 yerine). Keşif sayacı **engine dışı**: store `be-unicorn:codex` `{seenCards, threadsDone}` (`afterStep` `decisionShown` olaylarından; try/catch). PLAN §1 meta-ilerleme yasağı delinmez.

### 9.3 Aşama karnesi

`closeRound` → `stageReports.push({stage, days, roundsClosed, goalsDone, threadSteps, rivalRatio, minRunway})` (≤7 kayıt). Taşınma ve zafer ekranları bundan sayı çizer (§10.6).

### 9.4 Aşama tablosu: açık / siluet / iplik / teaser

| Aşama | Açık (HUD) | Siluet (gri, kilit + aşama pill'i) | Gerilim / iplik | Teaser (`content/teasers.ts`, ≤6 kelime) |
|---|---|---|---|---|
| Garaj | Bul / Konuş / Dinlen | Motive, Kahve, Ekip sekmesi | Nevin ilk kez gelir; Aylin ilk kullanıcı | "Pre-seed: ekip masası açılır" |
| Pre-seed | + Motive, Kahve, cap table, politikalar | Satış, Fiyat | Bora ilk turda; `rival-rumor`; ilk kriz "?" | "Seed: rakibin adı öğrenilir" |
| Seed | + Satış, fiyat, smb | Reklam, Pazar | Baş rakip doğar (çentik); Aylin ücretli; Tuna ilk haber | "A: reklam, pazar, kurul" |
| Series A | + Reklam, LTV:CAC, segment, refactor, yenileme, kurul | Kurumsal, M&A | Bora kurulda; fiyat savaşı; teknik borç | "B: kurumsal satış, balina müşteri" |
| Series B | + Kurumsal, M&A, enterprise segment | Global, özel slotlar | Al ya da alın; Tuna kapak; yatırımcı kışı | "C: çıkış penceresi açılır" |
| Series C | + Global, özel slotlar | Kampüs | Çıkış kartları; Bora'nın son kartı; son fırtına | "Unicorn: kurucu karnesi" |
| Unicorn | Karne | Denenmemiş 3 arketip silueti (`ARCHETYPES`) | — | "4 yoldan 1'i yürüdün" |

UI yüzeyleri: kilitli fiil siluetleri (`FounderActions.tsx`, `Dock.tsx`, `TopMetrics.tsx`), `StageProgressLine` sağ ucunda sıradaki açılışın %40 opak hayaleti + tooltip teaser, aynı çizgide baş rakibin **gölge çentiği** (`ink-3`, geçince turuncu, rakip kartı gelince 1 kez `animate-attention`), ufukta "?" → ikon, ay fişinde teaser satırı, Defter'de **Keşif** ızgarası ("23/64", §12), taşınma ve zafer karneleri. Şeride ve bildirime **hiçbir kazanım** yazılmaz. Ofis lafları da sahnede balondur: bütçe **günde ≤1** (`stripRules.dailyBudget` ile aynı sayaç) ve yalnız `hire/fire/resign/crisis` tetikleri; `rivalMove`/`rivalPassed` için balon yok — `rivalPassed` tek P2 şerit öğesi (dedupe 30 gün), `threadStep` hiçbir bildirim üretmez (kart zaten gelir). Eski "+6 ofis lafı" taslağı kaldırıldı. 3D sahnede bir sonraki ofis paletinin soluk hacmi **opsiyonel** (engine dokunmaz).

## 10. Oyun hissi UI: HUD grameri

Kaynak teşhis §1 son satır. Alt/üst barlar iyi çünkü yatay, sıkı, ikon+sayı, tek satır; açılan yüzeyler bu grameri terk edip dikey doküman gramerine geçiyor. Aşağıdaki dokuz kural tüm UI dalgalarını bağlar; hafıza kuralları (nötr kart yüzeyi + gösterge renkleri + tek marka rengi `#6b4ef0`, Oxanium UI/sayı, Inter uzun metin, canlı sıcak 3D sahne) korunur.

### 10.1 Dokuz kural

| # | Kural | Somut değer |
|---|---|---|
| D1 | **Sayı > etiket.** Her yüzeyde en büyük tipografik öğe bir sayıdır | Oxanium `tabular-nums`; panel birincil sayı 22-28px, ikincil 15px; etiket 10.5px uppercase altında |
| D2 | **Paragraf yok.** Panelde aynı anda okunacak tek cümle (≤12); açıklama tooltip/uzun basış | Inter yalnız o cümlede; bütçeler §3.5 |
| D3 | **Buton kademesi.** *commit* (para/hisse harcar: dolgu + **maliyet çipi** `−$4.2K/ay` / `runway 9→7`), *routine* (Anladım, Kapat: hairline küçük), *danger* (İşten çıkar: negative hairline) | `Button` tone → `commit|routine|danger|ghost|onInk`, `cost?: string`; commit basılınca 120 ms scale 0.96→1 + `confirm` cue |
| D4 | **Yüzey.** Kart nötr kalır; panel kabı üstte 3px **durum şeridi** (panel türü rengi), radius 14→10, blur kaldırılır (%100 opak); kart-içi-kart yasağı kalır | `.ui-card`, `--radius-card 10`, `--shadow-panel` 2 katman |
| D5 | **Yoğunluk.** Satır 44→36px, gövde `px-3 pt-2`; `divide-y` yerine 4px boşluk; kalıcı HUD ≤ %25 viewport | `RightPanel.tsx:120`, panel listeleri |
| D6 | **Hareket.** Panel açılış 180 ms ease-out + scale 0.96→1, kapanış 100 ms; sayı tween 300-600 ms tüm göstergelerde (`useTween`); saniyede >3 flaş yok; `prefers-reduced-motion` keyframe'leri kapatır | `index.css` keyframe `breathe|pop-once|rise|count` |
| D7 | **Ses rolleri.** tap, confirm, cashIn, cashOut/warn, milestone, crisis. Kazanım = yalnız milestone cue | `src/audio/index.ts:122-127` deseni, sentez, dosya yok |
| D8 | **Yönlendirme = nesne vurgusu.** "Şuna tıkla" metni sıfır: Dock ikonu nefes alır (1.6 s, aynı anda ≤2 nesne), hayalet slot, göstergede hedef çentiği; tek cümle yalnız *neden*'i söyler | §11 |
| D9 | **Bildirim bütçesi.** Aynı anda 1 şerit öğesi; oyun günü başına ≤2 P2; `dedupeKey` 30 gün; ≥3 aynı tür → digest ("3 sürüm"); kazanım/hedef/kilometre taşı/yeni gösterge şeride girmez | §12 |

Mobil: bottom sheet kalır, buton min-h 44, `ViewControls` compact, nabız/hayalet slot dokunmatikte ≥44px.

### 10.2 Tokenlar ve primitives

`index.css @theme`: radius, blur, shadow, keyframe'ler, hız tokenları (§13). `primitives.tsx`: `Button` (D3), `Stat` (22px tabular değer + etiket altta + `delta`/`tween`), `SectionTitle` (renk şeridi), `Chip` → segment kontrol (ikon+sayı), yeni `CostPreview` (`runway a→b` okuyla; veri `previewSpend`, §4.4). `ramp()`/`Legend` `theme.ts`'e taşınır (§14 grafikler kullanır).

### 10.3 RightPanel kabı

Başlık: 3px tür şeridi + ikon 20px + başlık 13px uppercase + **sağda o panelin birincil sayısı** (Ekip `N kişi · −$X/ay`; Mağaza kasa; Büyüme MRR; Projeler olgunluk %). Saf `panelHeadline(state, panel)` (`src/ui/panelHeadline.ts`, testli). Karar paneli ve kavram kartı şeridi mağazadan farklı hue — mağaza ile karar aynı yerde yaşamaz. `animate-slide-left` → `animate-rise`. PANEL_W aynı.

### 10.4 Alt bar: yetenek slotları, uçuşan sayı

6 aksiyon → kare slot 44×44 (mobil 48): ikon 22px, sol alt enerji maliyeti, sağ üst hamle maliyeti (§7.1), cooldown yerine hafta sayacı `3/4`, etiket yalnız tooltip (≤2 kelime). Kilitli aksiyon = gri siluet + kilit + aşama pill'i. Tamamlanınca `founderActionDone` → slot üstünde 700 ms **uçuşan sayı** (`+3 kullanıcı`, `+$1.2K`; `src/ui/FloatingNumber.tsx`, 4×'te ≤3 kuyruk) ve ilgili gösterge `pop-once`. Dock 5 sekme (journal çıkar, §12), ikon 20px + rozet, etiket yalnız ≥1280. `BAR_H 56` ve `useSceneInset` ölçümü değişmez.

### 10.5 Panel içerikleri

Kullanıcı "açılan panellerin **yapısı** web sitesi tadında" dedi; yalnız başlık şeridi/satır yüksekliği değiştirmek kozmetiktir. Yapısal karar: **karar verdiren büyük yüzeyler çekmecede değil ortada** (`CenterFrame`, §14.5: istatistik, Kanun Kitabı, Pazar haritası; zaman akar); çekmece yalnız kısa listeler ve tek fiil için kalır, Büyüme paneline 5 alt bölüm yığılmaz.

`TeamPanel` satır → 36px kişi kartı; `GrowthPanel` `<input type=range>` → **kademeli buton dizisi** 0/½/1×/2× (her kademede `CostPreview`; slider "form" hissinin ana kaynağı, grep testi: hiçbir panelde `type="range"` kalmaz) + tek satır özetler: Pazar ("68% · 2 segment ›" → `market` overlay), Politikalar ("3 politika · 12g ›" → `lawbook` overlay), **Kurul** satırı (hedef sayı + gün); `ShopPanel` fiyat büyük + commit; `RoadmapPanel` dikey → yatay ray, gelecek aşamalar siluet; `MetricsPanel` satır = ad + sayı + `Spark`, pin uzun basış; **Kredi** durumu Kasa dökümünde (bakiye, faiz, covenant ışığı, `loanWarning` sayacı); `RoundSection` 8 paragraf → çarpan `Stat`, "tur sonu runway" kırmızı sayı, DD satırlarında `+5/−10` pill + **strike göstergesi** (§6.3) + down round commit'i; `GoalsCard` formül → `StackBar`, `hint` **render edilmez** (alan `StageGoal.hint` zorunlu tipte kalır — silmek `content/types.ts`'i F2 ile çakıştırır; `textBudget.test` hint ≤8 kelime), ödül → `−1% hisse` pill. `PoliciesSection` ve `MarketSection` `CenterFrame` sekmeleri olarak kurulur (H5b). Her panelde Inter `<p>` ≤1.

### 10.6 Overlay'ler, masalar, kavram kartı

`OverlayFrame` ortadan scale-in 180 ms, backdrop `bg-ink/45`. `PostMortem` → 3 büyük sayı (gün, zirve MRR, ölüm nedeni tek cümle) + `commit` "Yeniden". `Victory` → 4 `Stat` + 7 karne satırı mini bar + arketip rozeti + 3 gri arketip silueti + keşif sayacı. `MoveScene` → `StageReport` 3 sayı + yeni fiil büyük ikon + sonraki ofisin `OfficeGlyph` silueti + teaser tek cümle (tagline/eski ofis/moveBody silinir). **Maaş masası** (§6.1) yeni overlay `{kind: 'payday'}` (açıkken blokan, `PauseReason 'payday'`): fiş satırları kalem kalem, her satırda öde/yarı/ertele segmenti, altta kasa sonrası sayı ve ertelemenin bedeli ikon+sayı, tek commit "Onayla" + routine "Sonra". Masa açıkken sayaç **yok** (zaman durur); "Sonra" ile kapatılınca ufuk şeridinde kırmızı `3g` geri sayım ve maaş ikonu masayı yeniden açar. Saf `paydayView(state, choice)` yalnız engine sayılarını sıralar. Kendi dalgası H6a (H6'nın geri kalanından ayrı). `NotebookCard` → tek kural cümlesi (≤10) + ilgili sayı önizlemesi + "Açıldı: X" pill; Ne?/Nerede? "▸ daha" ile katlı; açılışta görünen kelime ≤20.

## 11. Yönlendirme metinden sisteme

Guidance haritasının §4 tablosu uygulanır:

| Bugün (metin) | Yerine |
|---|---|
| NextStepChip metni + "Panel ›" düğmesi | Bayrak + "6/8" + ≤6 kelimelik *neden*; hedef Dock sekmesi `animate-breathe`, `findUsers` → "Bul" slotu nefes, `users/revenue/grow` → göstergede hedef çentiği (`WidgetChip goal` prop); Garaj sonrası çip kapanır |
| Tur penceresi üçlemesi (adım + moment + aktivite) | Yalnız üst bardaki "Tur başlat" pop-in; moment + aktivite silinir |
| `goal` moment, `newMetric`, `milestone` şerit | §12 |
| `founderActionDone` şerit | Uçuşan sayı (§10.4) |
| `roundWeek` moment | Üst bar tur çipi teklif deltasını renk+ok ile; pitch bekliyorsa nefes |
| Kavram balonu (ziyaretçi + balon + "Kazanımlara bak ›", 27/koşu) | **Sahnede balon çıkmaz** (§12): yalnız sağ üst ikon `pop-once` + rozet; ziyaretçi sahnede sessiz durabilir, tıklanınca kart açılır |
| Yansıma cümlesi (108) + "Kavram: X" | `effectSummary` sayıları + kitap ikonu; cümle tooltip |
| `time.startHint`, `shop.autoHint`, `round.moveBody`, MoveScene tagline/from, `goals.reward`, `metrics.intro` | **Silinir** — anahtarla birlikte kullanım satırları **aynı dalgada** silinir (`time.tsx:248`, `Overlays.tsx:45`, `ShopPanel.tsx:124`, `MetricsPanel.tsx:96`, `GoalsCard.tsx:57,64`; `t()` eksik anahtarda ham anahtarı döndürür, typecheck yakalamaz — iki dalga boyunca ekranda "round.moveBody" görünürdü). `goal.hint` silinmez, render edilmez (§10.5) |
| Uzun tooltip'ler (`top.cashTitle` 20, `hud.burnTitle` 21, `metrics.cash.note` 19, `cash.availableTitle` 18) | ≤8 kelime ya da Kasa dökümü sayıları |
| Ön koşul hataları ("önce masa koy") | Hayalet slot parlaması + Mağaza rozeti; hata tek kelime, 2.6 s |
| Boş durumlar | İkon + fiil butonu (≤4 kelime) |
| Ölü anahtarlar (`goals.toast`, `receipt.open`, `round.takesWeeks`, `decision.reflection`, `time.frame.focus`, `horizon.title`, gölgelenen `round.notReady/metricsMatter/preMoney`) | Silinir |

Korunanlar (kasa psikolojisi): ay fişi (sayı ağırlıklı, +teaser satırı), runwayLow/bankrupt P0, ufuk metni, karar sorusu + kazanç/bedel çipleri, Defter kartı içeriği, ofis lafları (günde ≤1, §9.4). Test: `src/content/__tests__/textBudget.test.ts` — `step.*` ≤6, `*Title|*Hint|*note` ≤8, `*.intro|*.reward` yok, `goal.hint` ≤8, kart soruları ≤12, teaser ≤6; **`src/ui` içinde `t('x')` ile çağrılan her anahtar `UI_TEXT`'te var** (grep testi).

## 12. Kazanım ikonu ve bildirim bütçesi

**Sağ üst tek ikon:** `ViewControls.tsx`'e `AchievementsButton` (`IconButton icon="book"`, kupanın yanında) + rozet = `concepts.minimized.length + (goalsDone − seenGoals)`. Tık → mevcut `journal` paneli; panel üç şerit: ☆ hedefler (GoalsCard buraya taşınır, Büyüme'den çıkar), kavram rafı, **Keşif** ızgarası (gizli/iplik kartları siluet, "23/64"). Açılınca rozet sıfırlanır (`ui.seenGoals`, localStorage `be-unicorn:ui`, `keptUi`'de korunur). Yeni hedef/kavram gelince ikon **tek** 600 ms `pop-once` + `milestone` cue; **başka bildirim yok — kavram balonu da yok.** Oyundaki "Kazanımlar" = kavram kartları + hedefler; kullanıcının "kazanım bildirimi durmadan geliyor" şikâyeti doğrudan sahnedeki kavram balonudur (27 kavram/koşu × ziyaretçi + balon + CTA). `ConceptBubble` kaldırılır (`bubbles/index.tsx` filtre, `momentRules.ts` `concept` moment silinir, `concepts.minimized` mantığı rozete taşınır); kavram kartı ikondan (ya da sahnede sessiz duran ziyaretçiye tıklayarak) açılır ve **yalnız o zaman** `PauseReason 'concept'` devreye girer (`gameStore.ts:139`). Hedef tamamlanması da aynen yalnız rozet. Dock'tan **K sekmesi kalkar** (5 sekme), `k` kısayolu ikona taşınır. Store `IMPORTANT_EVENT_KINDS` += `paydayShort`, `crisis`, `roundFailed`, `loanCalled` (§3 md.6).

**Şerit diyeti (D9):**
- `goalDone` moment üretmez; `momentRules.ts` `goal` kind silinir.
- `newMetric` şerit öğesi silinir; Dock metrics rozeti + gösterge kartına 1 kez parlama kalır.
- `STRIP_ACTIVITY`'den `milestone`, `founderActionDone`, `roundStarted`, `roundWindow` çıkar. Kilometre taşı = **konfeti + `milestone` cue**, ofis lafı yok (4 kanal → 2; ofis lafları günde ≤1 ve yalnız `hire/fire/resign/crisis`, §9.4).
- `roundWindow`/`roundWeek` moment silinir.
- `release` moment kalır; `Juice.tsx` dünya pankartından sayılar kaldırılır (tek kanal sayı).
- `stripRules.ts` `dailyBudget(day)`: P2 gün başına 2 kota, `dedupeKey` 30 gün, aşımda `digest`. P0 bütçeyi delip geçer. Yeni P1: `paydayShort`, `crisis`, `loanCalled`, `roundFailed`, `boardMissed` (kasa gerilimi şeride girer, kazanım girmez).

Kabul: `stripRules.test.ts`/`momentRules.test.ts` güncellenir; "goalDone şerit öğesi üretmez", "günde 3. P2 digest'e düşer", "aynı dedupeKey 30 gün içinde ikinci kez girmez". Görsel: 4× hızda 1 oyun ayı boyunca şerit ≤2 P2 + 1 fiş.

## 13. Hız renkleri

Karar: **duraklı = KIRMIZI, oynarken = YEŞİL; 1×/2×/4× aynı yeşil**, ayrım ikon ve dolgu yoğunluğuyla. Eski "pause nötr gri, 1× sarı, 2× turuncu, 4× yeşil" (`DECISIONS.md #13/#14`, `DESIGN.md:101-120`, `LAYOUT.md §4.2`) geçersiz; `CORE_LOOP.md §3.3`'teki "duraklı kırmızı" tablosu artık kodla uyumlu olur.

| Öğe | Değer |
|---|---|
| `--color-speed-pause` | `#c94a3f` (sakin kırmızı; `--color-negative`'den daha düşük doygunluk → runway/tehlike kırmızısıyla karışmaz) |
| `--color-speed-run` | `#1f9d63` (= `--color-positive`) |
| `SPEED_COLOR` (`time.tsx:19-25`) | `{0: pause, 1: run, 2: run, 4: run}` |
| `ScreenFrame` (`time.tsx:154-192`) | Duraklı: kırmızı **kesik** çizgi (tehlike değil bekleme; renk körlüğü); akan: yeşil düz; `data-state` değerleri (`1x/2x/4x/focus/paused`) korunur (`LAYOUT.md:560`) |
| `SpeedControl` (`SpeedControl.tsx:105-116, 68-80`) | `v===0` özel dalı kaldırılır; aktif pause `soft(pause,18)` + `inset 2px pause`; aktif hız `soft(run, 18/24/32)` + ikon ▶ / ▶▶ / ▶▶▶ (`icons.tsx` +`play2`, `play3`); `2×`/`4×` metni ve `aria-pressed` kalır |
| Korunan sinyaller | solid/dashed, `useStatusLabel`, ▶/⏸ ikon, ses cue'ları (`audio/index.ts:122-127`) |

Tek kırmızı kuralına istisna `DESIGN.md`'ye yazılır: "hız çerçevesi kırmızısı tehlike değildir; kesik çizgi + ⏸ ikonu ayırır". Test: yeni `src/ui/time.test.ts` (yalnız sabit test eder, `.tsx` gerekmez) — `SPEED_COLOR[0] !== SPEED_COLOR[1]`, `SPEED_COLOR[1] === SPEED_COLOR[2] === SPEED_COLOR[4]`; aynı dalgada `vite.config.ts` include `'src/**/*.test.{ts,tsx}'` (§3 md.10; bugünkü desen `.test.tsx` dosyalarını hiç çalıştırmaz); `gameStore.test.ts` hız testleri renkten bağımsız, geçmeye devam eder. Ekran görüntüleri `docs/screenshots/speed-{pause,1x,4x}.png`.

## 14. Merkez istatistik ekranı ve zaman kararı

### 14.1 Zaman kararı: ekran açıkken zaman **AKAR**

Öneri nettir: istatistik ekranı zamanı durdurmaz, yavaşlatmaz, `setSpeed` yazmaz; Space/1/2/3 çalışır. Gerekçe: (a) `CORE_LOOP.md §3.2` ilkesi — yalnız *düşünme işi* (karar, kavram, teklif) duraklıyken; bu ekran karar vermez, gösterir; Metrikler sekmesi aynı gerekçeyle durdurmuyor (#13, `gameStore.test.ts:739`). (b) Çizginin gözünün önünde uzaması ekranı **canlı gösterge** yapar; duran grafik = web dashboard (Anno/Cities: Skylines istatistik pencereleri durdurmaz; Frostpunk Kanun Kitabı durdurur çünkü karar verdirir). (c) `ScreenFrame` z-55 ekranın üstünde kalır → yeşil/kırmızı çerçeve görünür, "durdu mu?" karışıklığı olmaz. (d) Okurken durdurmak isteyen Space'e basar; çerçeve kırmızıya döner, ekran açık kalır. Maaş masası (§6.1) ise karar verdirir, bu yüzden **durdurur** — iki ekranın farkı ilkeyi netleştirir.

### 14.2 Engine: aylık snapshot ve saf seçiciler

`MonthReceipt` (`types.ts:503`) yalnız-ekleme: `team?, morale?, valuation?, equity?, reputation?, debt?, adBudget?, usersDelta?, stage?, burnMultiple?, penetration?` (mevcut `cashAfter, runwayAfter, mrr, users, revenue, salaries, rent, infra, ads, founder, net` + §6 `deferred, interest, loanRepay` + §8 `expansion`). `FinanceState.receipts: MonthReceipt[]`, `HISTORY_MAX_MONTHS = 120`. Tek yazma noktası `payday()` sonu. **Yuvarlama:** `receipts`'e yazılan para/kullanıcı alanları `Math.round`, oran alanları (`mom`, `multiple`, `burnMultiple`, `penetration`) 3 ondalık (yuvarlanmamış 28 float × 120 ay ≈ 60 KB tek başına ederdi, bugünkü 36 KB'lık Unicorn kaydıyla ~95 KB); `lastReceipt` aynen kalır (UI onu okur). Hedef ≈ 25-30 KB ek yük; `sim/run.ts`'e kayıt boyutu satırı (medyan <70 KB, maks <120 KB; bulut sınırı 160 KB `api/_lib/save.ts:10`; `docs/BACKEND.md:86`). Tutmazsa `HISTORY_MAX_MONTHS` 120 → 96.

`loopSelectors.ts`: `cashProjection(s, months = 12)` (ölüm ayı; `previewSpend` ile aynı çekirdek), `companyProfile(s): {product, growth, efficiency, team, morale, cash}` (0–1.5, `null` = kilitli/gelir öncesi) ve `targetProfile(stage)` (DD beklentisi). `derived`'a eklenmez; UI `useMemo` ile çağırır.

### 14.3 Store ve kısayol

`Overlay` += `{kind: 'stats', tab?: 'money'|'growth'|'team'|'profile'} | {kind: 'lawbook'} | {kind: 'market'}` (üçü `CENTER_KINDS`, hepsi `CenterFrame`'de); `pauseReasonsOf` (`gameStore.ts:136`): `if (ui.overlay && !CENTER_KINDS.has(ui.overlay.kind)) r.push('modal')`. `openPanel` center overlay'i kapatır; `openOverlay(center)` paneli kapatır (tek yüzey; mobilde şart). `requestOverlay` (`modalQueue.ts:29`): center açıkken kuyruklama yok, taşınma/post-mortem/maaş masası onu ezer. `afterStep`: `IMPORTANT_EVENT_KINDS` (`decisionShown | paydayShort | crisis | roundWindow | payrollMissed | roundFailed | loanCalled`) gelince center overlay kapanır + 4× → 1× (§3 md.6). `shortcuts.ts:27 blocking = overlay && !CENTER_KINDS.has(kind)`; `i` stats, `y` lawbook, `h` market toggle (mevcut kısayollarla çakışma testi; planın ilk `l`/`m` önerisi Liderlik ve Mağaza ile çakıştığı için Dalga 1'de değişti). Yan etkiler: `PauseVeil`/`StartCall` `blockingOverlay` seçicisi; şerit saati, `NextStepChip`, hız sesi center'da akar. Testler: "center overlays never pause; moveScene still does", `openOverlay(stats)` sonra `tick` gün ilerler, `openPanel` kapatır, stats açıkken `decisionShown` → stats kapanır ve tick devam eder, `i/y/h` çakışmaz. A4 yalnız `stats`'ı bağlar; `lawbook`/`market` union'a girer, içerikleri F2/E1 sonrası H5b.

### 14.4 Grafikler (elle SVG, bağımlılık yok)

`src/ui/charts/`: `scale.ts` (saf, testli: `linear`, `niceTicks ≤4`, `polar`, `stackParts`), `LineChart` (çoklu seri, son nokta dolu + değer, kesik `projection`, dikey `marks` maaş günü/kriz/kurul, yatay `targetLine`, tıkla-seç ay; ilk açılışta 400 ms `stroke-dashoffset` çizim), `BarChart` (gruplu/yığılmış, `ramp()`), `PieChart` (halka, dilim ≥%3, legend yanda), `RadarChart` (6 eksen sabit sıra, iki poligon, `null` eksen gri + kilit), `LockedTile` (ikon + ad, kesik çerçeve, cümle yok). Renk: seri = gösterge hue'su, ≤4 hue/grafik, uyarı yalnız `--color-negative` (ölüm noktası, runway<3 bölgesi). Sayılar Oxanium tabular; hover tooltip yok (dokunmatik), tıkla-seç + başlıkta seçili ayın değer satırı.

### 14.5 Ekran: `CenterFrame` + `StatsScreen`, 4 sekme

`CenterFrame`: **çoklu içerik kabı** (`stats` | `lawbook` | `market`; H7'de stats, H5b'de diğer ikisi), `fixed`, `sceneInset` içinde (üst bar altı ↔ alt bar üstü), maks 960px, z-45 (BottomStack 41 < 45 < ModalHost 50 < ScreenFrame 55); barlar dışarıda ve tıklanır; dışa tık/Esc kapatır; başlıkta içerik türü şeridi. Erişim: `ViewControls`'e `trend` ikonu (kupa solunda); Büyüme panelindeki "›" satırları lawbook/market'i açar. Metin: sekme adı, eksen etiketi (1 kelime), sayılar; tek cümle yalnız "Kasa biter · Gün 412".

**Performans** (zaman aktığı için kalıcı): `step()` her çağrıda `structuredClone` yapar → `receipts` referansı 4×'te saniyede ~8 kez değişir. `StatsScreen` fiş serilerini `useShallow((s) => ({n: receipts.length, lastDay: receipts.at(-1)?.day}))` anahtarına memo'lar, canlı ucu (`cash, mrr, users, day`) ayrı küçük seçiciyle alır; `statsData(receipts)` yalnız `n/lastDay` değişince koşar; `stroke-dashoffset` çizim animasyonu `useRef(firstOpen)` ile bir kez. Kabul: stats açıkken 4× hızda 1 oyun ayı boyunca `statsData` çağrı sayısı ≤ ay sayısı + 1 (sayaç testi).

| Sekme | Çizgi | Çubuk | Pasta / Radar |
|---|---|---|---|
| **Para** (varsayılan) | Kasa (+canlı uç, kesik projeksiyon, ölüm noktası kırmızı) ve Runway (∞ ise çizilmez); marks: maaş günleri, kriz takvimi, kurul | Son 12 ay gelir vs yığılmış gider (maaş/kira/altyapı/reklam/kurucu/genişleme/faiz) | Bu ayın gider dağılımı (`burnBreakdown` kilidi) |
| **Büyüme** | MRR ve Kullanıcı; Değerleme + `STAGE_TARGET_VALUATION[stage+1]` hedef çizgisi ve %60 pencere çizgisi; baş rakip değerlemesi ince gri çizgi (§8.2) | Aylık yeni kullanıcı (`usersDelta`) | Kanal payı (`channelBreakdown` kilidi); pazar doluluğu halkası (`penetration`) |
| **Ekip** | Ekip büyüklüğü ve Moral | Departman başına kişi/çıktı | Hisse: kurucu vs yatırımcılar (`capTableView` kilidi) |
| **Profil** | — | — | Radar 6 eksen: Ürün, Büyüme, Verim (burn multiple'dan), Ekip, Moral, Nakit; ikinci poligon = DD beklentisi (`targetProfile`) — fark anında görünür |

Mobil portre: kart barlar arası tam alan, sekme çipleri yatay kaydırılır, grafikler tek sütun, her biri ≥200px; landscape 2 sütun. Kilitli seri karo olarak görünür (#9-#10 Hisset→Adlandır→Kullan bozulmaz). `DECISIONS.md #19` "tek sağ panel" bilinçli istisnası: overlay listesi `moveScene/postMortem/victory/stats/lawbook/market/payday`.

## 15. Sim hedef tablosu ve yeni ölçümler

`sim/bots.ts:96 BotRun` yeni alanlar: `stageMinRunway[]`, `nearDeathPaydays[]` (runway<2, aşama başına), `daysRunwayBelow3`, `profitBeforeB`, `loansTaken`, `loanCalled`, `roundsFailed`, `crisesFired`, `crisisNearDeath`, `survivedNearDeath` (ilk yakın ölümden ≥180 gün sonra hayatta), `policiesAdopted`, `paydayDeferrals`, `movesUsedShare`, `segmentsOpened`, `rivalsAcquired`, `boardQuarters {hit, missed}`, `renewals {offered, kept}`, `refactors`, `peakValuation`, `valuationDropAfterPeak`, `penetrationByStage[]`, `rivalPassedDays`, `threadSteps`, `secretsSeen`, `saveBytes`. Olay taraması (`bots.ts:509-537`): `roundFailed | crisis | crisisRevealed | paydayShort | loanCalled | boardHit | boardMissed | renewalDue | rivalAcquired | rivalPassed | decisionShown`.

Yeni bot türleri: `coaster` (kâra geçince yalnız `housekeeping` + 90 günde `setAdBudget ×2`), `idleAfterProfit` (kârdan sonra hiçbir aksiyon), **`greedyGood`** (iyi politika ama runway 4'te işe alır, large tur, krediyi 3 ayda alır, krize hazırlanmaz — "riskli ama akıllı" oyuncu; ölçülebilir zorluk bu botta okunur), **`burner`/`frugal`** çifti (aynı seed; runway'e bakarak yakan vs bakmadan yakan). Mevcut botlara yeni politikalar: maaş masası kalem seçimi, kredi kabul/ret, DD-fail tepkisi ve tur başlatma eşiği (DD ≥ 3/4), kriz hazırlık modu (§5.1), hamle bütçesi önceliği, politika imzası, `openSegment`/`refactorSprint` (`growth()`), `boardroom()` (yenileme, `acquireRival`), `acquisition-offer` reddi. `careless`: masada rastgele, krediyi hep alır, politika imzalamaz, bütçeyi ilk aksiyona harcar, teklifi rastgele kabul eder, krize hazırlanmaz. Karar politikası karşılaştırması (`POLICY_ARCH`) 2 arketipte koşar: bootstrap + vcRocket.

**İyi bot iflası hedef değildir.** İyi bot = geliştiricinin yazdığı doğru karar politikası; onun ölmesi kararla değil zarla ölmek demektir ve kullanıcının "acımasız zorluk değil, doğru karar verdirten challenge" isteğiyle çelişir; oran zaten bot politikasıyla istenen değere "ayarlanabilir", ölçüm sahteleşir. Zorluk üç yerden okunur: `greedyGood` iflası, careless iflası ve yakın ölüm sıklığı. Oran kriterleri **24 seed** ve koşu sayısı + tolerans olarak yazılır (§3 md.8).

| Kriter (`sim/run.ts` satırı) | Hedef | Bugün |
|---|---|---|
| İyi bot iflas | **≤ %5 (0-1/24)**; her ölümde `trace.ts` son 180 günde tanımlı bir kötü KARAR göstermeli (kredi, geç tur, kriz kartında pahalı seçenek); yoksa denge değil bot politikası düzeltilir | %0 |
| `greedyGood` iflas | %15-30 (4-7/24) | — |
| Careless iflas | %40-60 (10-14/24) | %0 |
| Kötü karar politikası iflas farkı (bootstrap + vcRocket) | ≥ +25 puan | 0 |
| Yakın ölüm iyi bot (payday runway<3) Seed/A/B koşuların | ≥ %40 | ~0 |
| Yakın ölüm careless (payday runway<2) Seed/A/B | ≥ %50 | ~0 |
| Kriz hazırlığı | hazırlanan botun kriz sonrası min runway'i hazırlanmayanın ≥ +2 ayı; hazırlanmayanlarda kriz sonrası payday runway<2 ≥ %40 | — |
| Aşama min runway medyanı Seed / A / B / C | 3-6 / 4-8 / 5-9 / 6-10 ay | 99 |
| Oyun süresinin runway<3 payı | %15-25 | ~%3 |
| Otopilot: kârda geçirilen ay payı | iyi ≤ %35; bootstrap ≤ %50 ve süresi diğerlerinin ≤ 1.3×; `burner` Unicorn'a `frugal`'dan ≥ %15 hızlı, dikkatsiz `burner` iflas ≥ %40 | — |
| B'den önce kâra geçen koşu | bilgi satırı (kriter değil) | %100 |
| İyi botlarda kredi alan / kredi alanların 12 ay sonra hayatta | ≤ %30 / ≥ %50 | vcRocket 12/12 |
| Düşen tur payı | %10-20 (24 seedde 5-10 tur) | 0 |
| Yakın ölüm yaşayanların hayatta kalma | ≥ %60 | — |
| Krizler arası boşluk / C'de kriz sayısı | 150-300 gün / ≥ 2 | — |
| `idleAfterProfit` Unicorn (4500 gün) | 0/N; değerleme tepe sonrası ≥ %30 düşer (B1'den itibaren) | — |
| `coaster` Unicorn (4500 gün) | B1: süresi iyi bottan ≥ %25 uzun (bilgi); B2: 0/N ara; **E1: 0/N nihai** | — |
| Teknik borç iyi bot C medyanı / hız çarpanı | 20-40 / ≥ 0.7 — **çelişkili, karar bekliyor**: 0.02/puan ile 20-40 → hız 0.6-0.5; hız ≥ 0.7 borç ≤ 15 demek (ya bant ya `TECH_DEBT_PER_POINT` değişir) | B2: 6.0 / 0.88 |
| İyi bot Unicorn öncesi `segmentsOpened` / `rivalsAcquired` (medyan) | ≥ 2 / ≥ 1 | — |
| Penetrasyon A/B | 0.5-0.9 bandı (§8.1 TAM'ıyla) | — |
| Kurul çeyrek kaçırma B/C | iyi %30-50, coaster ≥ %80 | — |
| Yenileme kararı B/C koşu başına / yenilenen | 4-10 / ≥ %60 | — |
| `refactorSprint` iyi bot koşu başına | 3-8 | — |
| Rakip oyuncuyu geçen koşu | iyi %10-30, careless ≥ %50; iyi bot Seed ilk 90 gün 0 | — |
| Rakip `share` B medyanı | 0.15-0.35 | — |
| `acquired` bitişi | iyi 0, careless %10-30 | — |
| İplik tamamlama (`threadsDone ≥ 3/5`) | iyi ≥ %60, careless ≥ %20 | — |
| Her gizli kart tetiklenme (24 seed) | 2-12 koşu | — |
| Kart sayısı / koşu | artış ≤ 0 (mutlak ≤ 45); `CONTENT.decisions` ≤ 65 | — |
| `topActionShare` / salesCall per koşu / C'de hamle kullanım payı | ≤ 0.3 / ≤ 80 / ≥ %70 | ~200 |
| Pre-seed varış medyanı / 5 dk'da kavram | ≤ 5 dk / ≥ 3 (F1 kapısı) | 4.2-4.4 / ✓ |
| Runway > 24 ay payı | ≤ %30 (artık EVET) | HAYIR |
| Unicorn medyanı / arketip farkı | 60-90 dk (tolerans 55-95) / ≤ 1.3× | 60-76 / ✓ |
| Kayıt boyutu medyan / maks | <70 KB / <120 KB | 36 KB |
| `MIN_DAY_FOR_STAGE` | B1/B2/I'da ölçülen ≥ tablo | ✓ |

Sim yalnız metrik değil, iz de üretir: `npx tsx sim/trace.ts vcRocket 1 30`, `greedyGood 1 30` ve `coaster 1 30`; her iyi bot iflasında iz zorunlu; `sim/REPORT.md` her denge dalgası sonunda yeniden üretilir; "Para kısıtı" tablosuna aşama × min-runway p50/p90 eklenir.

## 16. Fazlar ve dalgalar

Her görev tek dalgaya bağlıdır; dalga kapısı §3.8. Bağımlılık grafiği: **A ∥ B** → C → D → **F** → E; G (içerik) C'den sonra paralel; H (UI) A ve ilgili engine dalgasına bağlı, alt dalgaları sırayla; I en son. A ve B aynı anda farklı oturumlarda yürütülebilir; B içinde B1→B2 sıralı (B3 A3'e alındı). F, E'nin önüne alındı: politikalar D1'in yarattığı yakın ölümde hayatta kalma kapısıdır ve alt bar UI'ı (H3) `derived.moves`'u bekler; F'nin E'ye bağımlılığı yoktur.

**Tek oturumda bitirilebilirlik**: bir dalga 3 bağımsız işi ya da >15 dosyayı kapsıyorsa bölünür. A3 ve B1 ayrı dalgalardır (birleştirilmez: değerleme yeniden yazımı + 4 test dosyası + sim botları tek oturumdur; save v4 + fişler + seçiciler ayrı oturum). H5 → H5a (Team / Growth kademe / Shop / Roadmap / Metrics / Round) + H5b (`MarketSection` / `PoliciesSection` `CenterFrame` sekmeleri, `BoardRow`, `DecisionPanel` kredi satırı, stats marks). H6 → H6a (`PaydayOverlay` + `paydayView`) + H6b (diğer overlay'ler, `NotebookCard`, merak yüzeyleri).

### Faz A — Bağımsız hızlı kazanımlar (engine dokunmaz veya salt kayıt)

| Dalga | İçerik | Dosyalar | Kapı |
|---|---|---|---|
| **A1** Hız renkleri (§13) + test ortamı (§3 md.10) | tokenlar, `SPEED_COLOR`, `SpeedControl`, `ScreenFrame`, ikonlar, docs; `vite.config.ts` include `.test.{ts,tsx}` | `index.css:87-94`, `time.tsx`, `SpeedControl.tsx`, `icons.tsx`, `vite.config.ts:53-56`, `DESIGN.md`, `LAYOUT.md`, `CORE_LOOP.md §3.3` | `time.test.ts`, typecheck/test/build, screenshots |
| **A2** Kazanım ikonu + kavram balonu kaldırma + şerit diyeti (§12) | `AchievementsButton`, Dock 5 sekme, `seenGoals`, `ConceptBubble` kaldırılır (`bubbles/index.tsx` filtre, `concept` moment silinir, `concept` pause yalnız kart açıkken), moment/strip kuralları, `dailyBudget` + ofis lafı günlük kotası, `IMPORTANT_EVENT_KINDS` genişler (yeni event kind'lar için yerel string union, C1/D1 bağlar), ölü anahtarlar | `ViewControls.tsx`, `Dock.tsx`, `store/types.ts`, `gameStore.ts:50-54,96-107,139`, `Moments.tsx`, `momentRules.ts`, `stripRules.ts`, `NotificationStrip.tsx`, `Juice.tsx`, `StageSection.tsx`, `bubbles/index.tsx`, `bubbles/ConceptBubble.tsx`, `strings.ts`, `text.ts`, `shortcuts.ts` | `stripRules.test`, `momentRules.test`, `gameStore.test` (concept pause yalnız kart açıkken), Dock snapshot |
| **A3** Fiş geçmişi + seçiciler + save v4 iskeleti (§14.2, §3.1, §4.4) | `receipts` (yuvarlanmış), `HISTORY_MAX_MONTHS`, `cashProjection`, `previewSpend` (aynı çekirdek; B3 buraya alındı), `companyProfile/targetProfile`, `SAVE_VERSION 4` + `MIGRATIONS[3]` (yalnız receipts; diğer alanlar sonraki dalgalarda aynı fonksiyona eklenir), sim boyut satırı + quick modda yeni bot türleri | `types.ts:16,503,537`, `balance.ts`, `loop.ts:37-62`, `createGame.ts`, `save.ts:11`, `loopSelectors.ts`, `index.ts`, `__tests__/history.test.ts`, `sim/run.ts:62-66`, `BACKEND.md` | yeni testler; kârda `deathDay = null`, 1 maaş eklenince ~60 gün öne; sim sonuçları **değişmez** (salt kayıt); kayıt medyan <70 KB |
| **A4** Store: center overlay + kısayol (§14.3) | `Overlay 'stats'|'lawbook'|'market'` (`CENTER_KINDS`), `pauseReasonsOf` istisnası, `requestOverlay`, `afterStep` önemli olayda kapatma, `shortcuts i` (`y`/`h` H5b), yan etkiler | `store/types.ts:41`, `gameStore.ts:136,341-358`, `modalQueue.ts`, `shortcuts.ts`, `time.tsx:197,219`, `NotificationStrip.tsx:234`, `NextStepChip.tsx:43`, `audio/index.ts:123` | `gameStore.test` yeni + mevcut pause testleri (stats açıkken `decisionShown` → kapanır, tick devam), `shortcuts.test` |
| **A5** Grafik primitifleri (§14.4) | `ui/charts/*`, `ramp/Legend` → `theme.ts` | `src/ui/charts/`, `theme.ts`, `widgets.tsx:124-157` | `scale.test.ts`, `widgets.test`, build farkı <15 KB gzip |

### Faz B — Denge tabanı (§4)

| Dalga | İçerik | Dosyalar | Kapı |
|---|---|---|---|
| **B1** Değerleme | `VAL_PER_TEAM` sil, pre formülü, `MULTIPLE_MIN_BY_STAGE`, büyüme-ölçekli çarpan (`GROWTH_FULL_K`), burn multiple + `bmPenalty` (stage ≥ 3), `netHistory`, idle cash cezası (36 ay + 180 gün muafiyet), pre-revenue tabanı ≤1, DD `burn` kalemi, `nextStep 'traction'` | `balance.ts:158-178`, `economy.ts:174-223`, `derive.ts:140-163`, `world.ts:28`, `round.ts:95`, `loopSelectors.ts:55-70`, `types.ts`, `economy.test.ts:108-124`, `round.test.ts`, `review.test.ts`, `loop.test.ts`, `loopText.ts:25`, `net/stageRules.ts` (+test); sim `coaster`/`idleAfterProfit`/`greedyGood` + kriter satırları | `idleAfterProfit` 0/24 + tepe sonrası ≥ %30 düşüş; `coaster` süresi iyi bottan ≥ %25 uzun (bilgi); iyi bot Unicorn ulaşır (kayarsa `GROWTH_FULL_K`, MAX değil); `minStageDays` ≥ tablo |
| **B2** Gider + kanal + tur ölçekleme | yıllık zam (`raises` sayaçlı), altyapı, koordinasyon, teknik borç (0.4 + amortisman + `refactorSprint` sink), `CHURN_MIN`, CAC harcama doygunluğu (üs 1.5), `MARKET_FALLBACK_TAM` ile geçici `pen`, `ROUND_RUNWAY_MONTHS` 8/12/16 + `ROUND_AMOUNT_TABLE_MIN` 0.3 | `loop.ts:37,107`, `people.ts:21`, `economy.ts:19-22,60-72,111`, `derive.ts:64,118-135`, `founder.ts`, `balance.ts:82-83,117-129,189-202`, `round.ts:46-58`, `strings.ts` (`refactor` tool text), `net/stageRules.ts` (+test) | aşama min-runway bantları, runway<3 payı %15-25, kârda ay payı ≤ %35, `coaster` 0/24 (ara), techDebt C 20-40, `minStageDays` ≥ tablo; kademeli (§4.2 son paragraf) |
| **B3** (A3'e alındı) | `previewSpend` A3 ile aynı çekirdekte iner; B3 boş | — | — |

### Faz C — Telegraf ve kadro (§5, §9.1-9.3)

| Dalga | İçerik | Dosyalar | Kapı |
|---|---|---|---|
| **C1** Kış takvimi | `calendar` (zamana bağlı, aşamada korunur), `scheduleCrisis`, `fireCalendar`, rng zinciri `progressRound → closeRound → enterStage`, `HorizonKind 'crisis'` + `hidden` (60/30 gün eşikleri), `nextCrisis`, event kinds, `content/crises.ts` 5 kriz + 5 kart (`EngineContent.crises?` opsiyonel), `CARD_DAILY_CHANCE 0.08` + paylaşılan kart kotası, tembel migrasyon; bot hazırlık modu | `round.ts:319,325`, `tick.ts:62,96`, `endgame.ts:59`, `createGame.ts`, `loopSelectors.ts:90`, `types.ts:689,783`, `util.ts:7`, `content/crises.ts`, `content/types.ts`, `decisions.ts:49-64`, `save.ts`, `__tests__/fixtures.ts`, `strings.ts` (`crisis` kategori), `bots.ts` | `loop.test`: ilk kriz Pre-seed [30,80], aşama değişiminde tarih korunur, krizler arası 150-300 gün, kriz günü modifier + kart, aynı gün ikinci kart yok; `loopSelectors` 58. gün `hidden`, 29. gün id; aynı seed → aynı takvim; sim: C'de ≥ 2 kriz, hazırlık kriteri |
| **C2** Yönetmen + melek | `director`, `updateDirector`, kriz/rakip **ağırlığı** ve şiddet (sıklık değil), `angel-lifeline`, `cashBurnMonths` | `world.ts:47`, `decisions.ts:49-64`, `loop.ts:74`, `effects.ts:70`, `balance.ts:305-311`, `content/decisions.ts` | `director.test`: kârlı 3 ay → ≥0.6; payrollMissed → 180 gün ≤0.3; melek bir kez; kart/koşu artışı ≤ 0 |
| **C3** Kadro + baş rakip | `cast`, `rivals[0]` Seed'de doğar (oyuncunun ×0.75, `DILIGENCE_MOM` temposu), `share` 0.10 + haftalık dinamik, `rivalPassed` geçişte, `rivalPressure` yeni formül, `RIVAL_NAMES` | `types.ts`, `index.ts`, `world.ts:28-50`, `round.ts:319`, `content/names.ts`, `save.ts` | `engine.test` aynı seed aynı kadro; `review.test` durgun 3 ay → `rivalPassed` bir kez, iyi bot Seed ilk 90 gün 0 |
| **C4** İplik uygunluğu + karne | `thread` alanı, `isCardEligible` (`h.optionIndex` doğrudan), `'thread'` kategorisi, `secret`, iplik başına aşama başına 1, `StageReport` | `content/types.ts`, `decisions.ts:20-47`, `round.ts:328`, `endgame.ts:60`, `types.ts`, `strings.ts` (`thread` kategori) | `loop.test`: step 2 kartı step 1 olmadan uygun değil; `after` filtresi; aynı aşamada aynı iplikten 2. kart gelmez |

### Faz D — Karar masaları (§6)

| Dalga | İçerik | Dosyalar | Kapı |
|---|---|---|---|
| **D1** Maaş masası | `pendingPayday`, `deferred` (owedCosts/runway'e dahil, `DEFER_CAP_MONTHS`), `resolvePayday`, 3 gün varsayılan sıra, `capacity` modifier (0.7 → 0.4), `landlord-notice` + `eviction`, moral hedefi terimi, store `PauseReason 'payday'` (masa açıkken), bot politikası | `loop.ts:37,74`, `endgame.ts:69`, `types.ts:910`, `actions.ts:363`, `people.ts`, `economy.ts:148`, `derive.ts:115`, `tick.ts:96`, `store/types.ts:59`, `gameStore.ts:134`, `strings.ts` (`paydayShort` P1), `bots.ts housekeeping` | `money.test`: kasa 0.6×maaş → `pendingPayday`; `half` moral −8 + hedef −10; 3 gün varsayılan; `deferred > 1 ay gider` → iflas saati; 3. kira ertelemesi → `eviction`; kârda `paydayShort` yok |
| **D2** Kredi | `loan` (`covenantFromDay`, `interestOnlyUntil`), `EffectBundle.loan`, faiz/amortisman satırları, kademeli covenant (`loanWarning` → %50 çağrı → tam), kart koşulları, migrasyon `debt → loan`, bot `scoreOption` | `effects.ts:97-103`, `loop.ts:37`, `round.ts:336`, `decisions.ts:1224,1249`, `types.ts`, `bots.ts:153` | `money.test`: faiz satırı; ilk 6 ay amortisman yok; 90 gün covenant ölçülmez; 1./2./3. ihlal zinciri; gelirsiz şirket ≥ 90 gün yaşar; sim kredi ≤ %30, kredi alanların ≥ %50'si 12 ay sonra hayatta |
| **D3** Tur düşer | `strikes` (`ddStart` snapshot'ına göre), `failRound` (≥ 4. hafta floor), `roundFailed`, `ROUND_RETRY_DAYS 14`, down round, `roundView.risk/downRound`, bot `fundraise` eşiği | `round.ts:275,328,170`, `derive.ts:202`, `types.ts:348,783`, `bots.ts:373` | `round.test`: tur başında met olan moral/mom 3 haftada bozulur → `roundFailed`, aşama aynı, 14 gün kapalı, down round açık; başlangıçta unmet kalem strike üretmez; sim %10-20 (5-10/24) |

### Faz E — Geç oyun (§8)

| Dalga | İçerik | Dosyalar | Kapı |
|---|---|---|---|
| **E1** Pazar | `market`, `content/markets.ts` (§8.1 mutlak büyüklükler + formül testi), `openSegment` (1 hamle), `tam/penetration` (B2'deki fallback kaldırılır), `expansion` defter satırı, rampa, ufuk `'saturation'`, `unlockTools 'segments'`, bot `growth()` | `types.ts`, `actions.ts`, `derive.ts:112-137`, `balance.ts`, `createGame.ts`, `loop.ts:22-34`, `round.ts:319`, `loopSelectors.ts:90`, `stages.ts`, `strings.ts` (`segments` tool text), `content/markets.ts`, `__tests__/market.test.ts`, `bots.ts:345` | `market.test`: tek segmentte reklam 2× → paid artışı < %50; TAM formülü tabloyla eşleşir; sim pen A/B 0.5-0.9, `segmentsOpened ≥ 2`, **`coaster` 0/24 nihai** |
| **E2** Çoğul rakip + M&A | A/B'de 2. ve 3. rakip, `strength/share` dinamiği, organik/arpu etkileri, `acquireRival` (2 hamle), `acquisition-offer` koşulu, `'acquired'` bitişi (`runStatus` gönderim yok, `gameOverOverlay` tipi), `unlockTools 'mna'`, bot `boardroom()` | `world.ts`, `derive.ts:118-127`, `actions.ts`, `endgame.ts`, `decisions.ts:1073`, `types.ts:826`, `src/net/cloud.ts:362-365`, `src/ui/ModalHost.tsx:11`, `strings.ts` (`mna` tool text), `bots.ts` | `engine.test` share monotonluk; mevcut `net` testleri geçer, `acquired` liderlik gönderimine girmez; sim `rivalsAcquired`, `acquired` iyi bot 0, share B 0.15-0.35 |
| **E3** Kurul | `board`, çeyrek döngüsü, `boardCapPenalty`, `board-review` kartı (paylaşılan kota), ufuk `'board'` | `tick.ts:96-125`, `round.ts:319`, `derive.ts:144`, `loopSelectors.ts`, `content/decisions.ts`, `loopText.ts` | sim kurul kaçırma %30-50 / coaster ≥ %80 |
| **E4** Yenileme | `renewContract` (1 hamle; `hold` 0.5+0.5×mat, başarıda ×1.1; `discount` iz bırakır), `renewalDue`, ufuk `'renewal'`, `unlockTools 'renewal'`, `goals.ts` C hedefi "2 segment + 1 yenileme" (`refactorSprint` B2'de indi) | `founder.ts:59-67`, `actions.ts`, `types.ts`, `loopSelectors.ts`, `stages.ts`, `strings.ts`, `goals.ts` | test: fiil olmadan sözleşme 360 günde düşer; `hold` EV ≥ `discount` EV olgunluk ≥ 0.7'de; sim yenileme ≥ %60 |

### Faz F — Kimlik (§7)

| Dalga | İçerik | Dosyalar | Kapı |
|---|---|---|---|
| **F1** Hamle bütçesi | `moves` (Pre-seed'den, `MOVES_FROM_STAGE`), `FounderActionDef.moves`, geç fiillerin hamle bedeli (`roundPitch`, `refactorSprint`, `renewContract`, `acquireRival`, `adoptPolicy`, `openSegment` — henüz olmayanlar için sabit tablo), enerji maliyetleri 0 / `energy` sağlık göstergesi, `MOVES_PER_WEEK`, `noMoves`, haftalık reset, `derived.moves`, bot `founder()` | `types.ts`, `founder.ts:74,86,109`, `balance.ts:245-265`, `tick.ts:96`, `round.ts` (pitch), `strings.ts` (`noMoves`), `bots.ts:332` | `focus.test`: Garaj'da `noMoves` yok; Pre-seed 4. findUsers `noMoves`; 7. gün yenilenir; `roundPitch` 1 düşer; sim Pre-seed varış ≤ 5 dk + 5 dk'da ≥ 3 kavram, salesCall ≤ 80, `topActionShare ≤ 0.3`, C'de hamle kullanımı ≥ %70 |
| **F2** Politikalar | `policies`, `content/policies.ts` 12 politika (`layoff-round` dahil, `EngineContent.policies?`), `adoptPolicy` (1 hamle), `policyMult`, moral hedefi terimi, maaş/kira/altyapı/enerji/koordinasyon/sürüm aralığı çarpanları, survival imzası → `roundEquity +0.005` + `companyProfile.team −0.1`, `derived.policies`, bot imzası | `types.ts:108,865`, `util.ts:38`, `derive.ts:118-137`, `economy.ts:148`, `people.ts:21`, `founder.ts`, `round.ts`, `actions.ts`, `loopSelectors.ts`, `content/policies.ts`, `content/types.ts`, `content/crises.ts` (`remote-first` kilidi), `strings.ts`, `save.ts` | `policies.test`: unlock, excludes, cooldown, geri alınamaz, kira ledger'a yansır, `layoff-round` ekip −%30, `salary-freeze` zammı durdurur; sim yakın ölüm hayatta kalma ≥ %60 |

### Faz G — İçerik (§9.2, §5.1, §7.2, §11 metin bütçesi; C'den sonra, D-F ile paralel)

| Dalga | İçerik | Dosyalar | Kapı |
|---|---|---|---|
| **G1** İplikler + teaser | `content/threads.ts` ≈22 kart (5 iplik), 4 gizli kart (tabanlı koşullar), mevcut rakip/çıkış kartlarına `thread`, **eşdeğer sayıda zayıf kart emekli** (`CONTENT.decisions` ≤ 65), `teasers.ts`, `strings codex.*/rival.*` (ofis lafı eklenmez) | `src/content/*` | `threads.test.ts` + `decisions.test.ts` (toplam ≤ 65, id benzersiz, bütçeler); sim `threadsDone ≥ 3/5` iyi ≥ %40 (nihai ≥ %60 I'da), gizli kart 2-12/24, kart/koşu artışı ≤ 0 |
| **G2** Metin diyeti | §11 tablosundaki silme/kısaltmalar **ve kullanım satırları** (`time.tsx:248`, `Overlays.tsx:45`, `ShopPanel.tsx:124`, `MetricsPanel.tsx:96`, `GoalsCard.tsx:57,64` — yalnız satır silme), `loopText step.*` ≤6, tooltip ≤8, boş durumlar, `goal.hint` render edilmez (silinmez) | `strings.ts`, `loopText.ts`, `topBarText.ts`, `metricsText.ts`, `timeText.ts`, `text.ts`, `goals.ts`, `time.tsx`, `Overlays.tsx`, `ShopPanel.tsx`, `MetricsPanel.tsx`, `GoalsCard.tsx`, `VOICE.md` | `textBudget.test.ts` tüm bütçeler + "`src/ui`'de çağrılan her `t()` anahtarı var" |

### Faz H — UI (§10, §11, §12 kalanı, §14.5, §9.4)

| Dalga | İçerik | Bağımlılık | Kapı |
|---|---|---|---|
| **H1** Tokenlar + primitives (§10.2) | `index.css`, `primitives.tsx`, `theme.ts`, `hooks.ts useTween`, `CostPreview` | A1, A3 (`previewSpend`) | `widgets.test`, build farkı <5 KB, `docs/screenshots/primitives.png` |
| **H2** RightPanel kabı (§10.3) | `RightPanel.tsx`, `panelHeadline.ts` | H1 | `panelHeadline` testi 11 kind |
| **H3** Alt bar slotları + uçuşan sayı + kilitli aksiyon siluetleri (§10.4, §9.4) | `FounderActions.tsx`, `FounderBar.tsx`, `BottomBar.tsx`, `Dock.tsx` (5 sekme, rozet; kilitli araç sekmesi H5b'de), `FloatingNumber.tsx` | H1, F1 (`derived.moves`) | BAR_H korunur, 4×'te ≤3 uçuşan; `.test.tsx` `renderToStaticMarkup` ile |
| **H4** Yönlendirme → sistem (§11) | `NextStepChip.tsx`, `guidance.ts`, `Dock pulse`, `TopMetrics goal`, `WidgetChip`, balonlar (`DecisionBubble`, `worldBubble`; `ConceptBubble` A2'de kaldırıldı), `StartCall`, boş durumlar | A2, G2 | balon DOM'unda tek `<p>`; aynı anda nefes alan ≤2 |
| **H5a** Panel içerikleri (§10.5) | `TeamPanel`, `GrowthPanel` (kademe butonu, tek satır özetler → center overlay), `ShopPanel`, `RoadmapPanel`, `MetricsPanel` (kredi durumu), `RoundSection` (strike + down round), `GoalsCard` → Defter (`hint` render yok) | H1-H2, D2, D3 | grep `type="range"` = 0; Inter `<p>` ≤1/panel; kredi satırı `finance.loan`'dan |
| **H5b** CenterFrame içerikleri: Kanun Kitabı + Pazar haritası + yeni mekanik yüzeyleri (§7.2, §8.1, §14.5) | `PoliciesSection` (lawbook), `MarketSection` (segment karoları + rakip satırları + `acquireRival`), `BoardRow`, `renewContract` yüzeyi, `DecisionPanel` kredi satırı, kilitli Dock araç sekmesi siluetleri, stats kriz/kurul marks + rakip çizgisi | H7, E1-E4, F2 | her commit'te `CostPreview`; lawbook/market açıkken tick ilerler; `IMPORTANT_EVENT_KINDS` kapatır; cümle ≤12 |
| **H6a** Maaş masası (§10.6, §6.1) | `PaydayOverlay`, `paydayView.ts` (+test), `ModalHost` payday, "Sonra" + ufuk `3g` sayacı | H1, D1 | masa açıkken zaman durur, sayaç yok; kapatınca ufukta `3g` akar; "Onayla" `resolvePayday`; stats açıkken payday onu ezer |
| **H6b** Overlay'ler + kavram kartı (§10.6) | `Overlays.tsx` (PostMortem, Victory karne, MoveScene karne+teaser, `acquired` ekranı), `NotebookCard.tsx`, `OverlayFrame` | H1, C4, E2, G1 | NotebookCard ≤20 kelime; MoveScene'de paragraf yok |
| **H7** Merkez istatistik ekranı (§14.5) | `StatsScreen.tsx`, `CenterFrame.tsx` (çoklu içerik kabı), `statsData.ts` (memo anahtarı `n/lastDay`), `ModalHost`, `ViewControls trend`, `strings stats.*` | A3, A4, A5, H1 | 1440×900 ve 390×844 dört sekme; stats açıkken Space durdurur, çerçeve kırmızı; 4×'te çizgi uzar; `decisionShown` stats'ı kapatır, tick devam eder; `statsData` çağrı sayısı ≤ ay + 1 |
| **H8** Merak yüzeyleri (§9.4) | `StageSection` hayalet açılış + rakip çentiği, `Horizon`/`NotificationStrip` "?" → ikon (60/30 gün), `Moments receipt` teaser satırı, Defter Keşif ızgarası, store `codex`, `speaker.ts` `state.cast` | C1, C3, C4, G1, A2 | görsel; `gameStore.test` codex try/catch; şeritte kazanım metni yok (grep) |

### Faz I — Kapanış

`stages.ts`/`roadmap.ts` metinleri, `STAGE_UNLOCK_TOOLS`; `npx tsx sim/minStageDays.ts` → `net/stageRules.ts:22` (`stageRules.test.ts` eşitlik); `sim/REPORT.md` yeniden; `docs/DECISIONS.md` #21-#30 (§17); `CORE_LOOP.md` Faz 4 "öneri → uygulandı", §3.3 renk, §7 popup bütçesi; `LAYOUT.md` §3.1 P2 listesi, §4.2, §7.6 (Dock 5 sekme, sağ üst ikonlar, overlay listesi); `DESIGN.md §3.9` calm-UI → HUD grameri, "Time state", dataviz paragrafı, kırmızı istisnası; `VOICE.md` yeni bütçeler; `CONTRACTS.md` (`ui/charts`, geçmiş engine'de); `BACKEND.md` kayıt boyutu; `docs/screenshots/` yeniden (Vercel akışı, commit `8719657`). Yalnız `balance.ts` sabitleri ve bot politikaları değişir; formül/mimari değişikliği gerekirse durulur ve özette önerilir. **Zorunlu iz kriteri:** `sim/trace.ts` ile iyi bot iflaslarının %100'ünde son 180 günde tanımlı bir kötü karar bulunmalı; bulunamıyorsa denge değil bot politikası düzeltilir. Kapı: `npm run typecheck && npm test && npm run build && npm run sim -- --seeds 24 --days 4500`, §15 tablosunun tümü EVET/aralıkta; eski Faz 0-3 kriterlerinden çelişenler (iyi bot iflas ≤ %3 → ≤ %5 korunur, careless %10-25 → %40-60, runway>24 HAYIR → ≤ %30) §15 değerleriyle değiştirilir.

## 17. CORE_LOOP ve DECISIONS ile çelişen kararlar

| Eski karar | Ne değişir | Bölüm |
|---|---|---|
| **#5** maaş işe alımda sabit | Sabit kalır **ama** yılda bir %8 piyasa zammı otomatik; `salary-freeze` politikası durdurur | §4.2 |
| **#12/#17** değerleme `VAL_PER_TEAM = 40_000`, çarpan tabanı 4, pre-revenue tabanı her zaman | Kafa sayısı çıkar; aşama tabanı `[4,4,3,2.5,2,1.5,1.5]`; burn multiple ve boşta nakit cezası; pre-revenue tabanı yalnız aşama ≤1 | §4.1 |
| **#13/#14 + DESIGN "Time state" + LAYOUT §4.2** pause nötr gri, 1× sarı, 2× turuncu, 4× yeşil | Pause kırmızı kesik, 1×/2×/4× tek yeşil (ikon+yoğunluk); "tek kırmızı" kuralına yazılı istisna | §13 |
| **#13** pause sebepleri `modal|decision|concept|offer` | + `payday` (maaş masası açıkken). `concept` yalnız kart ikondan açıldığında (sahnede balon yok). `CenterFrame` overlay'leri (`stats/lawbook/market`) **pause sebebi değil** | §6.1, §12, §14.1 |
| **#16** tur her zaman kapanır, teklif tabanı 0.5; tur 12/18/24 ay nefes | Tur başında met olup bozulan kalemlerde 3 strike ya da ≥4. haftada taban → tur düşer, 14 gün + down round; **tur 8/12/16 ay nefes, tablo tabanı 0.3** | §6.3, §4.2 |
| **#17** kredi = `LOAN_FLAGS → debt`, faizsiz, turdan otomatik ödenir; kurtarma kartı sabit +$15K, 3 kez | Tek kredi, faizli, vadeli, kademeli covenant'lı (90 gün muafiyet, 6 ay yalnız faiz, uyarı → %50 → tam çağrı); tutar burn ölçekli; bakiye yine turdan kapanır | §6.2 |
| **#17** iflas dengesi hedefleri (iyi bot %0-3, careless %10-25) | İyi bot ≤ %5 **korunur** (ölüm = karar, iz zorunlu); zorluk `greedyGood` %15-30, careless %40-60, yakın ölüm ≥ %40'ta okunur | §15 |
| **#19** tek sağ panel, overlay yalnız `moveScene/postMortem/victory` | + `CenterFrame` (`stats`, `lawbook`, `market`; ortada, durdurmaz) ve `payday` (ortada, açıkken durdurur). Karar verdiren büyük yüzeyler çekmeceden ortaya taşınır | §14, §10.5, §10.6 |
| **CORE_LOOP §4.1** kart sıklığı `CARD_DAILY_CHANCE 0.1` | 0.08; yönetmen sıklığa dokunmaz; kriz/kurul kartları aynı kotayı paylaşır; `CONTENT.decisions` ≤ 65 | §3 md.11 |
| **CORE_LOOP** enerji tek kurucu kısıtı | Pre-seed'den itibaren hamle bütçesi tek kısıt; enerji sağlık göstergesi; Garaj değişmez | §7.1 |
| **#20** `MIN_DAY_FOR_STAGE` ölçülmüş | Denge değişince yeniden ölçülür (kaldırılmaz) | §16 Faz I |
| **CORE_LOOP §3.3** "duraklı kırmızı" | Artık kodla uyumlu | §13 |
| **CORE_LOOP §4.1 olay bütçesi, §4.3 md.4 telegraflanan kriz, md.6 aşama karnesi, §5 kalıcı politika çipleri (Faz 4, "öneri")** | Uygulanır: yönetmen (sıklık runway'e bağlı), kış takvimi, `StageReport`, politikalar | §5, §7, §9.3 |
| **CORE_LOOP §7 popup bütçesi / LAYOUT §3.1 P2 listesi** (`goal`, `milestone`, `newMetric` şeritte) | Şeritten çıkar; sağ üst tek ikon + rozet; Dock K sekmesi kalkar; günlük P2 kotası 2 | §12 |
| **CORE_LOOP §4.3 yay** (Garaj nakit → … → C kontrol/çıkış) yalnız araç açılışıyla taşınıyordu | Her aşamaya kısıt + fiil + yatırım + bilinen fırtına (§8.5 tablosu) | §8 |
| **DESIGN §3.9** "generous whitespace, hairline, light shadows, don't nest cards" | Kart-içi-kart yasağı kalır; boşluk/yoğunluk/buton/hareket kuralları D1-D9 ile değişir | §10.1 |
| **PLAN §1 dışarıda bırakılanlar** (offline ilerleme, günlük hedef, meta-ilerleme) | Değişmez; keşif sayacı engine dışı ve yalnız kozmetik; sezon/streak yok | §9.2 |
| **#9-#10** Hisset→Adlandır→Kullan | Korunur; grafik ekranında kilitli seri karo; yeni araçlar (`segments`, `refactor`, `renewal`, `mna`) aşama açılışıyla gelir, kavram tetiği gerekmez | §14.5, §8.5 |

Yeni `DECISIONS.md` maddeleri: **#21** değerleme ve gider ölçekleme (§4), **#22** kış takvimi + yönetmen + melek (§5), **#23** maaş masası + kredi + tur düşmesi (§6), **#24** hamle bütçesi + politikalar (§7), **#25** pazar + rakipler + kurul + yenileme + `acquired` bitişi (§8), **#26** kadro + iplikler + keşif (§9), **#27** hız rengi (§13), **#28** kazanımlar ikonda + bildirim bütçesi + Dock 5 sekme (§12), **#29** istatistik ekranı ortada, durdurmaz (§14; kayıt v4 fiş geçmişi: tek migrasyon fonksiyonu `MIGRATIONS[3]`, saklanan ay tam fiş ya da eski kayıttan kurulmuş `PartialReceipt` (`partial: true`, yalnız MRR + kullanıcı), yuvarlanmış ve 120 ayla sınırlı; ölçülen kayıt medyan ~58 KB / maks ~75 KB — Dalga 1), **#30** HUD grameri D1-D9 (§10).

## 18. Riskler

| Risk | Belirti | Önlem |
|---|---|---|
| Denge tabanı Unicorn süresini kaydırır | B1/B2 sonrası iyi bot 95 dk'yı aşar veya ulaşamaz | İki ayrı kol (§4.2): zorluk tur/gider sabitleriyle, süre `GROWTH_FULL_K` + `STAGE_TARGET_VALUATION` ile; `MULTIPLE_MAX_BY_STAGE` ayar noktası DEĞİL (coaster'ı güçlendirir); her B dalgası kendi sim kapısıyla kapanır; B2 önce altyapı/CAC/tur, sonra zam/borç (kademeli) |
| Yeni kısıtlar üst üste binip spiral yaratır | Kriz + kurul kaçırma + covenant aynı ayda → kaçınılmaz iflas | Yönetmen `graceUntil` (180 gün), melek, `DECISION_VISITOR_WAIT` korunur, kriz kartı her zaman hafifletme seçeneği verir; kredi 90 gün covenant muafiyeti + kademeli çağrı; tur düşünce down round; bekleyen kriz aşama değişiminde üst üste binmez; sim `survivedNearDeath ≥ %60` ve "kredi alanların ≥ %50'si 12 ay hayatta" kriterleri |
| Maaş masasında ölümsüzlük deliği | Maaşı ödeyip kira/altyapı/kurucuyu her ay erteleyen şirket ölmez; runway yalan söyler | `deferred` owedCosts/runway'e dahil; `deferred > 1 ay gider` → iflas saati; 3. kira ertelemesi tahliye, 2. altyapı ertelemesi capacity 0.4; reklam ertelenemez |
| Kriz-tur çakışması sürpriz ölüme dönüşür | `investor-winter` tur ortasına düşer, teklif tabana iner, tur düşer | Kriz tarihi 60 gün önceden "?" olarak görünür (tur süresi kadar); bot ve oyuncu turu krizden önce/sonraya planlar; strike yalnız tur başında met olan kalemlerde |
| Bot politikası yetersiz → sim yanlış teşhis | Botlar yeni fiilleri kullanmayınca iflas oranı yapay yükselir | Her yeni Action için bot politikası aynı dalgada zorunlu (§3.2); `trace.ts` izi incelenir |
| Save v4 çok dalgaya yayılıyor | Bir dalga migrasyonu unutur, eski kayıt kırılır | Tek `MIGRATIONS[3]` fonksiyonu + engine'de `??=` tembel varsayılan; `money.test` zincir testi her dalgada koşar |
| Kayıt boyutu | `receipts` + `calendar` + `rivals` + `stageReports` 160 KB'ı zorlar | `HISTORY_MAX_MONTHS 120` (tutmazsa 96), fişte para/kullanıcı `Math.round`, oranlar 3 ondalık (§14.2), sim boyut kriteri (medyan <70 KB, maks <120 KB) |
| Hız kırmızısı tehlike kırmızısıyla karışır | Oyuncu duraklı çerçeveyi runway alarmı sanır | Ayrı token (`#c94a3f`), kesik çizgi, ⏸ ikonu, `PauseVeil` desatürasyonu; ekran görüntüsüyle doğrulama |
| İstatistik / Kanun Kitabı / Pazar ekranı açıkken zaman akması "kaçırdım" hissi yaratır | `BubbleTray` z-10, `CenterFrame` z-45 → karar balonu örtülür; mevcut `slowOnMoments` yalnız aşamanın İLK kartında yavaşlatır (`gameStore.ts:50-54`), sonraki kartlar 60 gün sonra varsayılanla kapanırdı | `afterStep`: `IMPORTANT_EVENT_KINDS` (`decisionShown`, `paydayShort`, `crisis`, `roundWindow`, `payrollMissed`, `roundFailed`, `loanCalled`) gelince açık center overlay kapanır + 4× → 1× (§3 md.6); test: stats açıkken `decisionShown` → kapanır, tick devam eder; blokan modal zaten ezer |
| İplik kartları havuzu boğar | Kart sayısı/koşu artar, `CARD_COOLDOWN_DAYS` etkisiz | İplik başına aşama başına 1, cooldown paylaşılır, eşdeğer zayıf kart emekli (`CONTENT.decisions` ≤ 65), yönetmen sıklığa dokunmaz; sim kriteri artış ≤ 0, mutlak ≤ 45 |
| Test dosyaları sessizce koşmaz | `.test.tsx` vitest include dışında; kabul kriterleri yeşil görünür | A1'de `vite.config.ts` include düzeltilir; DOM assert `renderToStaticMarkup`; §3 md.10 |
| Union genişletmesi typecheck kapısını düşürür | `Record<ToolId|ActionErrorCode|DecisionCategory|ActivityKind>` tabloları eksik üye | §3 md.9: genişleten dalga `strings.ts`/`text.ts`'i listeye alır; `EngineContent` yeni koleksiyonları opsiyonel |
| Metin diyeti anlaşılırlığı düşürür | Yeni oyuncu ne yapacağını bilmez | Nesne vurgusu (nefes, hayalet slot, çentik) metnin yerini alır; ilk kullanımda 1 kez tooltip; oyun testi ile doğrulama |
| UI dalgaları engine dalgalarını bekler | H5b uzun süre bloke | H1-H4, H5a ve H7 erken bağımsız yürür; H5b mekaniğe göre parçalanır (H9 H5b'ye katıldı) |
| Liderlik tablosu/anti-hile | Denge değişince `MIN_DAY_FOR_STAGE` eski kalır, dürüst oyuncu reddedilir | Faz I'da yeniden ölçüm zorunlu, `stageRules.test.ts` eşitlik testi |
| `acquired` bitişi yanlışlıkla kabul | Tek tıkla oyun biter | Kart seçeneği `commit` kademesi + hisse/kasa çipi; onay adımı gerekmez ama seçenek metni bitişi açıkça söyler (≤5 kelime: "Sat, oyunu bitir") |

## 19. Kaynaklar

Araştırma önceki oturumlarda yapıldı; aşağıdaki bağlantılar planda adı geçen kavram ve oyunların birincil kaynaklarıdır.

**Sistemik tasarım referansları**
- Frostpunk — fırtına tahmini, Kanun Kitabı, umut/hoşnutsuzluk: https://www.frostpunkgame.com/ · Kanun Kitabı: https://frostpunk.fandom.com/wiki/Book_of_Laws
- RimWorld — AI Storyteller, servete ölçeklenen tehdit, adaptasyon: https://rimworldwiki.com/wiki/AI_Storyteller
- Papers, Please — kalem kalem karar masası, karakter iplikleri: https://papersplea.se/
- Into the Breach — tam telegraflanmış sonuç önizlemesi: https://subsetgames.com/itb.html
- Universal Paperclips — faz = yeni fiil, duvar → açılış: https://www.decisionproblem.com/paperclips/
- Reigns — iplik yapısı, keşif yüzdesi: https://www.devolverdigital.com/games/reigns
- Cookie Clicker — gizli dönüşler: https://orteil.dashnet.org/cookieclicker/
- Offworld Trading Company — adlı rakipler, yut ya da yutul: https://www.offworldgame.com/
- Anno 1800 — katman açılışı, üst katman görünürlüğü, durdurmayan istatistik ekranı: https://www.anno-union.com/
- Two Point Hospital — yıldız hedefi / kurul karnesi: https://www.twopointhospital.com/
- Plague Inc. — ilerleme çubuğunda rakip gölgesi: https://www.ndemiccreations.com/en/22-plague-inc

**Ekonomi kavramları**
- Rule of 40 (Bain): https://www.bain.com/insights/hacking-softwares-rule-of-40/
- Burn Multiple (David Sacks): https://medium.com/craft-ventures/the-burn-multiple-51a7e43cb200
- Creeping normality: https://en.wikipedia.org/wiki/Creeping_normality

**Psikoloji**
- Loewenstein, G. (1994). *The Psychology of Curiosity: A Review and Reinterpretation.* Psychological Bulletin 116(1): https://doi.org/10.1037/0033-2909.116.1.75
- Zeigarnik etkisi (yarım kalan iş): https://en.wikipedia.org/wiki/Zeigarnik_effect

**Oyun hissi ve HUD**
- Swink, S. *Game Feel* — girdi/tepki/sonuç döngüsü: https://en.wikipedia.org/wiki/Game_feel
- GDC Vault — Frostpunk ve RimWorld tasarım konuşmaları (arama: "Frostpunk", "RimWorld storyteller"): https://www.gdcvault.com/

**Proje içi**
- `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/CORE_LOOP.md`, `docs/LAYOUT.md`, `docs/DESIGN.md`, `docs/VOICE.md`, `docs/CONTRACTS.md`, `docs/BACKEND.md`, `sim/REPORT.md`

## Eleştirilerden sonra değişenler

Üç mercekten (niyet, uygulanabilirlik, oynanış) gelen critical/major eleştirilerin tamamı ve uygun minor'lar işlendi. Özet:

**Niyet (kullanıcı istekleri)**
- İyi bot iflası hedef olmaktan çıktı (≤ %5, her ölümde iz zorunlu); zorluk `greedyGood` (%15-30), careless (%40-60) ve yakın ölüm sıklığında okunur; oran kriterleri 24 seed + koşu sayısı (§15, §3 md.8, §17).
- Popup bütçesi sabitlendi: `CARD_DAILY_CHANCE` 0.08, yönetmen yalnız ağırlık/şiddet, kriz/kurul kartları aynı kotada, `CONTENT.decisions` ≤ 65, kart/koşu artışı ≤ 0 (§3 md.11, §5.2, §9.2).
- Kavram balonu sahneden kalktı; yalnız sağ üst ikon + rozet, `concept` pause yalnız kart açılınca. Kilometre taşı = konfeti + cue; ofis lafı günde ≤1, yeni ofis lafı yok (§12, §11, §9.4).
- Kış takvimi aşamaya değil zamana bağlı (150-300 gün aralık, bekleyen kriz aşamada korunur, C'de ≥ 2 kriz); tarih 60 gün önce "?", kimlik 30 gün önce; bot hazırlık modu ve hazırlık kriteri; erken krizler kasaya dokunur (§5.1).
- Maaş masası tek tutarlı kural: açıkken durdurur, "Sonra" ile kapanır, sayaç yalnız kapalıyken ufukta `3g` (§6.1, §10.6, §3 md.6).
- Kredi covenant spirali kırıldı: 90 gün muafiyet, 6 ay yalnız faiz, covenant 1/2, uyarı → %50 → tam çağrı; "kredi alanların ≥ %50'si 12 ay hayatta" (§6.2).
- "B öncesi kâr ≤ %20" kriteri kaldırıldı; otopilot kârda ay payı (≤ %35, bootstrap ≤ %50) ve `burner/frugal` çiftiyle ölçülür (§4.2, §15).
- Kanun Kitabı ve Pazar haritası çekmece sekmesi değil, `CenterFrame` ekranı (`lawbook`/`market`, durdurmaz); Büyüme paneline yığılma yok (§7.2, §8.1, §10.5, §14.3, §14.5).
- Center ekran açıkken önemli olay (`decisionShown`, `paydayShort`, `crisis`, …) ekranı kapatır ve 4× → 1× (§3 md.6, §14.3, §18).
- Hamle bütçesi Pre-seed'den; Garaj değişmez (M1 korunur); enerji sağlık göstergesi, bütçe tek kısıt; geç fiiller hamle tüketir; C'de kullanım ≥ %70 (§7.1).

**Uygulanabilirlik**
- `'acquired'` bitişi: `cloud.ts runStatus` gönderim yapmaz, `ModalHost.gameOverOverlay` tipi genişler; ikisi E2 listesinde (§8.2, §16 E2).
- `vite.config.ts` include `.test.{ts,tsx}` (A1); DOM assert `renderToStaticMarkup`, jsdom yok (§3 md.10, §13).
- Yıllık zam formülü `raises` sayaçlı (ilk maaş gününde zam yok); `hiredDay` migrasyonu ve `optionIndex` migrasyonu kaldırıldı (§4.2, §3.1, §9.2).
- Baş rakip oyuncuya çapalı tempo belirleyici (×0.75 başlangıç, `DILIGENCE_MOM` temposu), share 0.10 doğuş + 0.03 haftalık; `rivalPassed` yalnız geçişte (§8.2).
- RNG zinciri `progressRound → closeRound → enterStage`; `endgame.ts` ve `fixtures.ts` C1 listesinde; migrasyon tembel, rng'siz (§5.1, §16 C1).
- `Record<Union>` kuralı ve `EngineContent` opsiyonel koleksiyonlar (§3 md.9); ilgili dalga listelerine `strings.ts` eklendi.
- Fiş yuvarlama; kayıt hedefi medyan <70 KB (§14.2, §15, §18).
- Teknik borç: 0.4/güncelleme + amortisman + `refactorSprint` B2'ye alındı; `TECH_DEBT_PER_POINT` 0.02 (§4.2).
- `minStageDays` B1 ve B2 kapılarında; `stageRules.ts` listede (§3 md.8, §16).
- Dalga bölünmesi: A3/B1 ayrı, `previewSpend` A3'e; H5 → H5a/H5b; H6 → H6a (maaş masası)/H6b (§16 giriş).
- StatsScreen memo anahtarı `n/lastDay`, çizim animasyonu bir kez, çağrı sayısı kriteri (§14.5).
- `goal.hint` silinmez, render edilmez; silinen anahtarların kullanım satırları G2'de; `t()` anahtar varlığı testi (§10.5, §11, §16 G2).
- Kilitli Dock araç sekmesi H3'ten H5b'ye (§8.5, §16).
- Quick modda yeni botlar da koşar, `--days 3000` (§3 md.8).

**Oynanış / matematik**
- Çarpan büyüme-ölçekli: `MIN + (MAX − MIN) × clamp(momAvg / (2 × DILIGENCE_MOM))`; sıfır büyüme gerçekten MIN; süre ayarı `GROWTH_FULL_K`, MAX değil; BM cezası stage ≥ 3 ve `DILIGENCE_BM` bazlı, üst sınır 3; idle cezası 36 ay + tur sonrası 180 gün muafiyet (§4.1).
- `coaster` kriteri B1'den E1'e taşındı (ara B2); CAC harcama doygunluğu süper-lineer (üs 1.5) (§4.3, §16).
- TAM mutlak ve aşama çıkışında pen ≈ 0.7 verecek şekilde formülden türetilir (2K / +10K / +50K / +200K / +450K), testli (§8.1).
- Maaş masası ölümsüzlük deliği kapandı: `deferred` runway'e dahil, üst sınır → iflas saati, tahliye, capacity 0.4, reklam ertelenemez, kalıcı moral hedefi terimi (§6.1).
- Tur düşmesi: strike yalnız tur başında met olup bozulan kalemlerde, floor ≥ 4. haftada, `ROUND_RETRY_DAYS` 14, down round; bot DD ≥ 3/4 eşiği (§6.3).
- Tur nefesi 8/12/16 ay, tablo tabanı 0.3; iki ayrı ayar kolu (zorluk vs süre) (§4.2, §18).
- İplik başına aşama başına 1 kart; gizli kartlara taban (`viral-spike` users ≥ 2000 && stage ≥ 2); merak kriteri `threadsDone ≥ 3/5` (§9.2).
- Politikalar keskin ve iz bırakan (`deferred-pay` ×0.6, `layoff-round`, `crunch-culture` borç + burnout, survival imzası hisse bedeli); yenilemede `hold` 0.5+0.5×mat ve başarıda ×1.1, `discount` iz bırakır (§7.2, §8.4).

Kabul edilmeyen tek öneri: `acquired` bitişini oyunu bitirmeyen nakit+hisse etkisine indirmek — alt-bitiş korunuyor, liderlik gönderimi kapatılarak çözüldü.
