# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.5 dk · g136 (24/24) | 7.0 dk · g209 (24/24) | 18.1 dk · g543 (24/24) | 33.4 dk · g1001 (24/24) | 50.9 dk · g1527 (24/24) | 84.3 dk · g2530 (18/24) |
| vcRocket | 4.3 dk · g131 (24/24) | 7.5 dk · g224 (24/24) | 14.3 dk · g429 (24/24) | 23.0 dk · g691 (24/24) | 38.0 dk · g1139 (24/24) | 70.6 dk · g2118 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.7 dk · g200 (24/24) | 15.6 dk · g467 (24/24) | 25.9 dk · g779 (24/24) | 44.5 dk · g1336 (24/24) | 71.3 dk · g2140 (24/24) |
| platform | 4.4 dk · g133 (24/24) | 7.0 dk · g209 (24/24) | 17.3 dk · g520 (24/24) | 30.6 dk · g917 (24/24) | 53.5 dk · g1606 (24/24) | 97.9 dk · g2937 (18/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | timeout 6, unicorn 18 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %38 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 9 | %51 | 36 |
| platform | 0% | unicorn 18, timeout 6 | 8 / 7 | 10 / 8 | %49 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 43.0 dk · g1290 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 7.1 dk · g213 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:talkToUsers 385 | 380 | 14 sn / 14 sn | 0.23× |
| vcRocket | founderAction:talkToUsers 462 | 460.5 | 14 sn / 38 sn | 0.31× |
| niche | founderAction:findUsers 314.5 | 314.5 | 14 sn / 32 sn | 0.30× |
| platform | founderAction:talkToUsers 509 | 502.5 | 14 sn / 42 sn | 0.22× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (42 sn)**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 14.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 16.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| platform | 2.0 sn | 6.0 sn / 22.0 sn | 2.0 sn / 8.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/96) | — | 0 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/24) | — | 0 |
| kaos (random) | 100% (24/24) | 7.1 dk · g213 | 4 |
| idle | 100% (24/24) | 43.0 dk · g1290 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 84.3 dk | 18/24 | 0% | %50 |
| worst | 86.8 dk | 17/24 | 0% | %39 |
| first | 90.8 dk | 22/24 | 0% | %39 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 95.0 dk · %61 · 22/24 | 84.3 dk · %50 · 18/24 | 84.1 dk · %40 · 17/24 | %13 | — |
| vcRocket | 84.5 dk · %58 · 24/24 | 73.9 dk · %48 · 24/24 | 70.6 dk · %38 · 24/24 | %20 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 86.4 dk · %50 | 84.3 dk · %50 | hayır |
| platform | 93.9 dk · %49 | 97.9 dk · %49 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 18% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 39% · tablo tavanı 0% · tablo tabanı 61%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 402 | 0.8 | 2.0 | 0% | 0.0 | 1.2 |
| Pre-seed | 237 | 5.4 | 41.8 | 19% | 3.7 | 15.2 |
| Seed | 925 | 66.9 | 99.0 | 55% | 4.3 | 6.6 |
| Series A | 1110 | 8.2 | 99.0 | 36% | 4.3 | 5.8 |
| Series B | 1795 | 10.3 | 99.0 | 39% | 3.6 | 8.9 |
| Series C | 3993 | 27.8 | 99.0 | 53% | 5.6 | 14.7 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 96 | 0 | 16% | 0.0 |
| Seed | 96 | 0 | 13% | 3.5 |
| Series A | 96 | 0 | 11% | 3.6 |
| Series B | 96 | 0 | 10% | 3.3 |
| Series C | 96 | 0 | 16% | 2.7 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 3 | 22.5 | 23.5 | 29 | 66.5 |
| vcRocket | 8 | 4 | 18 | 23 | 38 | 85.5 |
| niche | 8 | 3 | 9 | 11 | 18 | 27 |
| platform | 7 | 3 | 25 | 28 | 44 | 126.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 31%, en kötü 38% (hedef ≤ %35).

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 21/24 | 58% | 71% | 15% |
| idleAfterProfit | 0/24 | — | 0/24 | 93% | 22% | 3% |
| greedyGood | 24/24 | 82.3 dk | 0/24 | 29% | 0% | 6% |
| burner | 20/24 | 85.7 dk | 0/24 | 27% | 0% | 5% |
| frugal | 21/24 | 95.1 dk | 0/24 | 77% | 0% | 4% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 6% | 0% | 64% |

Kayıt boyutu (koşu sonu, 264 koşu): medyan 76.5 KB · maks 99.6 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 84.3 / 70.6 / 71.3 / 97.9 dk → **hedefin 8 dk üstünde (en yavaş)**; arketip farkı 1.39× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 55% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %8 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 11 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 22% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 75.8 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 75.8 dk (%98): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 91.2 dk ↔ 97.5 dk (%7): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 34% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 94/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 45% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.3 (3–6) · Series A 4.3 (4–8) · Series B 3.6 (5–9) · Series C 5.6 (6–10): **HAYIR** (2/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 6% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 44% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 2.7 (hedef 20–40) · hız çarpanı 0.95 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 4 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 11% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 91/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 84.3 / 70.6 / 71.3 / 97.9 dk · 1.39×: **HAYIR**
- Kayıt boyutu medyan 76.5 KB (hedef < 70) · maks 99.6 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3513 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 25
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 4 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 6.1 ↔ hazırlanmayan 6.9 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 510/510
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1223 kriz): 1% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 41.1 ↔ kriz içeriği olmadan aynı seed'ler 33.0 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 15.5 ↔ 14.3 · kriz / koşu medyanı 10
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (84/96 ulaştı): 81.8 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 75.5 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 13/96 (hedef %10–30 → 10–28/96): **EVET** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.12
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 654/1936 (hedef %30–50 → 581–968/1936): **EVET**
- Kurul çeyrek kaçırma, coaster (A–C, çeyrek): 10/17 (hedef ≥ %80 → 14–17/17): **HAYIR** · A'ya ulaşan 1/24
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 6.1 (hedef 4–10) · yenilenen 97% (hedef ≥ %60): **EVET** · koşu başına 0–36 · satıcılar (bootstrap + niche, 48 koşu) 12.1
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 1/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 21/501 (hedef %10–20 → 51–100/501): **HAYIR** · down round 20 · kredi çağrısı 0
- Bilgi: careless: kredi 10/24 · çağrı 0 · düşen tur 10 · down round 8 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 9 · down round 7 · iplik adımı / koşu (iyi, medyan) 11
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 14/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 1/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 14/14 (hedef ≥ %60 → 9–14/14): **EVET** · n = 14
- Bilgi (maaş masası): iyi botlar masa 107 · erteleme 107 · careless masa 17 · erteleme 15 · greedyGood masa 26 · erteleme 26
- Pre-seed varış medyanı, iyi botlar: 4.4 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 147 (hedef ≤ 80): **HAYIR** · medyan 29.5 · 80'i aşan 17/96
- topActionShare, iyi botlar (medyan): 31% (hedef ≤ %30): **HAYIR**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 78% (hedef ≥ %70): **EVET** · Pre-seed → C 83% / 75% / 77% / 71% / 78%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 93 · founder-no-pay 90 · lean-office 96 · deferred-pay 31 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 24/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 12 · team-mutiny 0 · rival-dies 1 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 764.9 sn · `npm run sim -- --seeds 24 --days 4500`_
