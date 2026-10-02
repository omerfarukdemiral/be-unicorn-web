# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 3000 oyun günü (100 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.6 dk · g137 (24/24) | 8.3 dk · g250 (24/24) | 17.9 dk · g536 (24/24) | 31.2 dk · g936 (24/24) | 53.0 dk · g1591 (24/24) | 84.3 dk · g2529 (8/24) |
| vcRocket | 4.4 dk · g131 (24/24) | 7.9 dk · g238 (24/24) | 21.1 dk · g632 (24/24) | 32.4 dk · g971 (24/24) | 50.0 dk · g1501 (24/24) | 93.6 dk · g2809 (3/24) |
| niche | 4.5 dk · g135 (24/24) | 7.2 dk · g215 (24/24) | 15.7 dk · g471 (24/24) | 28.1 dk · g845 (24/24) | 49.0 dk · g1470 (24/24) | 87.0 dk · g2611 (13/24) |
| platform | 4.5 dk · g134 (24/24) | 8.5 dk · g255 (24/24) | 22.5 dk · g675 (24/24) | 34.3 dk · g1028 (24/24) | 52.5 dk · g1576 (24/24) | 90.6 dk · g2718 (11/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 8, timeout 16 | 7 / 6 | 8 / 7 | %52 | 36 |
| vcRocket | 0% | timeout 21, unicorn 3 | 7 / 6 | 10 / 7 | %37 | 36 |
| niche | 0% | timeout 11, unicorn 13 | 7 / 6 | 9 / 7 | %51 | 36 |
| platform | 0% | unicorn 11, timeout 13 | 7 / 6 | 10 / 7 | %50 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 0/24 | — | 0 | 7 |
| random (rastgele aksiyon) | 0/24 | — | 0 | 7 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:salesCall 274.5 | 32 | 14 sn / 25 sn | 0.36× |
| vcRocket | setAdBudget 74 | 30 | 20 sn / 38 sn | 0.37× |
| niche | founderAction:salesCall 264 | 28 | 14 sn / 27 sn | 0.36× |
| platform | setAdBudget 73 | 32 | 14 sn / 42 sn | 0.27× |

- findUsers hiçbir arketipte en sık aksiyon değil: **EVET**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (42 sn)**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 24.0 sn | 4.0 sn / 12.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.5 sn / 24.0 sn | 6.0 sn / 21.5 sn | 1 | 0 |
| niche | 2.0 sn | 8.0 sn / 23.5 sn | 4.0 sn / 12.0 sn | 1 | 0 |
| platform | 2.0 sn | 6.0 sn / 24.0 sn | 5.0 sn / 21.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/96) | — | 1 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/24) | — | 2 |
| kaos (random) | 0% (0/24) | — | 0 |
| idle | 0% (0/24) | — | 0 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 84.3 dk | 8/24 | 0% | %52 |
| worst | 84.3 dk | 8/24 | 0% | %52 |
| first | 84.3 dk | 8/24 | 0% | %52 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 84.3 dk · %52 · 8/24 | 84.3 dk · %52 · 8/24 | 84.3 dk · %52 · 8/24 | %0 | small |
| vcRocket | 93.6 dk · %37 · 3/24 | 93.6 dk · %37 · 3/24 | 93.6 dk · %37 · 3/24 | %0 | small |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 84.3 dk · %52 | 84.3 dk · %52 | hayır |
| platform | 90.6 dk · %50 | 90.6 dk · %50 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 31% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 35% · tablo tavanı 0% · tablo tabanı 65%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı |
|---|---|---|---|---|
| Garaj | 409 | 0.6 | 1.9 | 0% |
| Pre-seed | 339 | 4.6 | 20.4 | 7% |
| Seed | 1111 | 99.0 | 99.0 | 80% |
| Series A | 1151 | 15.7 | 99.0 | 42% |
| Series B | 1905 | 27.6 | 99.0 | 52% |
| Series C | 4267 | 70.7 | 99.0 | 63% |

Aşama min-runway (GAMEPLAY V2 §15): her koşunun o aşamadaki en düşük maaş günü runway’i (ay, kâr = 99), iyi botlar. Hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10.

| Aşama | Koşu | Min-runway p50 | p90 | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|---|---|
| Garaj | 96 | 0.0 | 0.4 | 4 | 5% | 0.0 |
| Pre-seed | 96 | 3.4 | 5.8 | 0 | 12% | 0.0 |
| Seed | 96 | 7.1 | 18.0 | 0 | 14% | 0.0 |
| Series A | 96 | 5.6 | 11.1 | 0 | 11% | 3.3 |
| Series B | 96 | 5.4 | 23.2 | 0 | 9% | 4.5 |
| Series C | 96 | 11.7 | 41.3 | 0 | 11% | 3.8 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 5 | 14 | 17 | 28 | 58 |
| vcRocket | 8 | 4 | 25 | 19.5 | 30.5 | 85.5 |
| niche | 8 | 4 | 12 | 17.5 | 27 | 62.5 |
| platform | 7 | 4 | 30.5 | 18.5 | 29.5 | 74.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 25%, en kötü 39% (hedef ≤ %35).

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 0/24 | 89% | 51% | 5% |
| idleAfterProfit | 0/24 | — | 0/24 | 89% | 23% | 5% |
| greedyGood | 1/24 | 95.0 dk | 0/24 | 39% | 25% | 5% |
| burner | 23/24 | 79.3 dk | 0/24 | 27% | 0% | 6% |
| frugal | 1/24 | 91.0 dk | 0/24 | 77% | 41% | 4% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 23% | 0% | 35% |

Kayıt boyutu (koşu sonu, 264 koşu): medyan 80.9 KB · maks 85.7 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 87.0 dk → **hedef aralıkta**; arketip farkı 1.00× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 1/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı): iyi botlar 0% (hedef ≤ %3): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %10–25): **HAYIR** · idle 0% ve kaos (random) 0%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 1 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **HAYIR** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 80% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %0 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 0 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn: 0/24 (hedef ≤ %0 → 0–0/24): **EVET** (bilgi; B2 ara, nihai hedef E1)
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 23% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 89.0 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 100 dk): 100.0 dk ↔ 89.0 dk (%12): **HAYIR**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 100 dk): 79.3 dk ↔ 100.0 dk (%21): **EVET**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 35% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 96/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 49% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 7.1 (3–6) · Series A 5.6 (4–8) · Series B 5.4 (5–9) · Series C 11.7 (6–10): **HAYIR** (2/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 5% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 55% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 3.8 (hedef 20–40) · hız çarpanı 0.92 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 1 (hedef 3–8): **HAYIR**
- Penetrasyon aşama sonu A / B (bilgi; MARKET_FALLBACK_TAM, hedef §8.1 ile 0.5–0.9): 11% / 9%
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 87.0 dk · 1.00×: **HAYIR**
- Kayıt boyutu medyan 80.9 KB (hedef < 70) · maks 85.7 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3388 aralık): 150–300 gün (hedef 150–300): **EVET**
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 5 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 10.8 ↔ hazırlanmayan 13.4 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 589/589
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1184 kriz): 3% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 44.5 ↔ kriz içeriği olmadan aynı seed'ler 37.3 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 15.5 ↔ 13.2 · kriz / koşu medyanı 12
- İyi bot Unicorn medyanı, ulaşmayan = 100 dk (35/96 ulaştı): 100.0 dk (tolerans 55–95 dk): **HAYIR** · kriz içeriği olmadan 99.0 dk (55/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 12/96 (hedef %10–30 → 10–28/96): **EVET** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 15/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.09 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.25
- İyi botlarda kredi alan koşu: 0/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 0/0 (hedef ≥ %50 → 0–0/0): **EVET** (kredi alan yok)
- Düşen tur payı, iyi botlar (ara bant; nihai %10–20 T20): 38/518 (hedef %5–25 → 26–129/518): **EVET** · down round 32 · kredi çağrısı 0
- Bilgi: careless: kredi 24/24 · çağrı 0 · düşen tur 16 · down round 16 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 18 · down round 9 · iplik adımı / koşu (iyi, medyan) 17
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B; ara bant, nihai ≥ %40 T20): 2/96 (hedef ≥ %30 → 29–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 2/24 (hedef ≥ %40 → 10–24/24): **HAYIR**
- Careless iflas (D1 tabanı): 0/24 (hedef ≥ %30 → 8–24/24): **HAYIR**
- İyi bot iflas (D1: ≤ 1/24 seed başına): 0/96 (hedef ≤ %4 → 0–4/96): **EVET**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 96/96 (hedef ≥ %50 → 48–96/96): **EVET**
- Bilgi (maaş masası): iyi botlar masa 123 · erteleme 123 · careless masa 44 · erteleme 41 · greedyGood masa 24 · erteleme 24

_Süre: 2384.2 sn · `npm run sim -- --seeds 24 --days 3000`_
