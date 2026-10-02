# Be Unicorn — Denge Simülasyonu Raporu

12 seed × 4 arketip, en fazla 3000 oyun günü (100 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g140 (12/12) | 7.4 dk · g223 (12/12) | 16.8 dk · g504 (12/12) | 29.0 dk · g869 (12/12) | 52.9 dk · g1586 (12/12) | 90.5 dk · g2716 (3/12) |
| vcRocket | 4.6 dk · g139 (12/12) | 8.3 dk · g250 (12/12) | 22.3 dk · g670 (12/12) | 33.1 dk · g994 (12/12) | 45.6 dk · g1367 (12/12) | 90.0 dk · g2700 (8/12) |
| niche | 4.8 dk · g143 (12/12) | 7.3 dk · g220 (12/12) | 15.6 dk · g467 (12/12) | 27.3 dk · g819 (12/12) | 45.3 dk · g1360 (12/12) | 86.1 dk · g2582 (9/12) |
| platform | 4.5 dk · g134 (12/12) | 8.1 dk · g243 (12/12) | 20.2 dk · g606 (12/12) | 30.5 dk · g915 (12/12) | 48.7 dk · g1461 (12/12) | 88.2 dk · g2645 (12/12) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 3, timeout 9 | 7 / 6 | 8 / 7 | %52 | 36 |
| vcRocket | 0% | unicorn 8, timeout 4 | 6.5 / 6 | 10 / 7 | %37 | 36 |
| niche | 0% | unicorn 9, timeout 3 | 7 / 6 | 9 / 7 | %51 | 36 |
| platform | 0% | unicorn 12 | 7 / 6 | 10 / 7 | %51 | 36 |

Toplam iflas oranı: **0%** (0/48).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 0/12 | — | 0 | 7 |
| random (rastgele aksiyon) | 0/12 | — | 0 | 7 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:findUsers 439.5 | 439.5 | 14 sn / 33 sn | 0.36× |
| vcRocket | founderAction:findUsers 655.5 | 655.5 | 16 sn / 38 sn | 0.37× |
| niche | founderAction:findUsers 392 | 392 | 14 sn / 24 sn | 0.36× |
| platform | founderAction:talkToUsers 588 | 581.5 | 14 sn / 34 sn | 0.28× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (38 sn)**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 14.0 sn | 2.0 sn / 6.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.5 sn / 14.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |
| platform | 2.0 sn | 6.0 sn / 22.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/48) | — | 1 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/12) | — | 1.5 |
| kaos (random) | 0% (0/12) | — | 0 |
| idle | 0% (0/12) | — | 0 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 90.5 dk | 3/12 | 0% | %52 |
| worst | 90.5 dk | 3/12 | 0% | %52 |
| first | 90.5 dk | 3/12 | 0% | %52 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 90.5 dk · %52 · 3/12 | 90.5 dk · %52 · 3/12 | 90.5 dk · %52 · 3/12 | %0 | small |
| vcRocket | 90.0 dk · %37 · 8/12 | 90.0 dk · %37 · 8/12 | 90.0 dk · %37 · 8/12 | %0 | small |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 90.5 dk · %52 | 90.5 dk · %52 | hayır |
| platform | 88.2 dk · %51 | 88.2 dk · %51 | hayır |

Tur kapanışları (iyi botlar, 240 tur): metrik kısmı tavanda 33% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 30% · tablo tavanı 0% · tablo tabanı 70%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı |
|---|---|---|---|---|
| Garaj | 210 | 0.6 | 1.7 | 0% |
| Pre-seed | 152 | 6.7 | 27.5 | 13% |
| Seed | 527 | 99.0 | 99.0 | 82% |
| Series A | 525 | 15.4 | 99.0 | 42% |
| Series B | 903 | 27.8 | 99.0 | 53% |
| Series C | 2097 | 88.6 | 99.0 | 65% |

Aşama min-runway (GAMEPLAY V2 §15): her koşunun o aşamadaki en düşük maaş günü runway’i (ay, kâr = 99), iyi botlar. Hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10.

| Aşama | Koşu | Min-runway p50 | p90 | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|---|---|
| Garaj | 48 | 0.0 | 0.4 | 4 | 6% | 0.0 |
| Pre-seed | 48 | 3.9 | 6.7 | 0 | 12% | 0.0 |
| Seed | 48 | 7.8 | 26.8 | 0 | 14% | 0.0 |
| Series A | 48 | 5.6 | 12.7 | 0 | 10% | 2.0 |
| Series B | 48 | 5.3 | 19.0 | 0 | 9% | 4.4 |
| Series C | 48 | 12.0 | 40.9 | 0 | 12% | 5.4 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7.5 | 4 | 13 | 18.5 | 35 | 69 |
| vcRocket | 8 | 4 | 32 | 22.5 | 37 | 127.5 |
| niche | 8 | 3.5 | 12.5 | 16 | 27 | 61 |
| platform | 7 | 4 | 34 | 26 | 43 | 109 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 32%, en kötü 39% (hedef ≤ %35).

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/12 | — | 0/12 | 90% | 35% | 5% |
| idleAfterProfit | 0/12 | — | 0/12 | 90% | 45% | 5% |
| greedyGood | 3/12 | 95.1 dk | 0/12 | 45% | 25% | 5% |
| burner | 12/12 | 81.1 dk | 0/12 | 27% | 0% | 6% |
| frugal | 3/12 | 91.1 dk | 0/12 | 77% | 10% | 5% |
| burner (dikkatsiz) | 0/12 | — | 12/12 | 25% | 0% | 35% |

Kayıt boyutu (koşu sonu, 132 koşu): medyan 77.2 KB · maks 84.9 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 90.0 / 86.1 / 88.2 dk → **hedef aralıkta**; arketip farkı 1.05× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 3/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı): iyi botlar 0% (hedef ≤ %3): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %10–25): **HAYIR** · idle 0% ve kaos (random) 0%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 1 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **HAYIR** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 82% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %0 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 0 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/48 (hedef ≤ %5 → 0–2/48): **EVET**
- Careless iflas: 0/12 (hedef %40–60 → 5–7/12): **HAYIR**
- greedyGood iflas: 0/12 (hedef %15–30 → 2–3/12): **HAYIR**
- coaster Unicorn: 0/12 (hedef ≤ %0 → 0–0/12): **EVET** (bilgi; B2 ara, nihai hedef E1)
- idleAfterProfit Unicorn: 0/12 (hedef ≤ %0 → 0–0/12) · tepe sonrası düşüş medyanı 45% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 88.8 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 100 dk): 100.0 dk ↔ 88.8 dk (%13): **HAYIR**
- Dikkatsiz burner iflas: 12/12 (hedef ≥ %40 → 5–12/12): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 100 dk): 81.1 dk ↔ 100.0 dk (%19): **EVET**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 34% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 48/48 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 54% (hedef ≤ %50): **HAYIR**
- Aşama min-runway medyanı: Seed 7.8 (3–6) · Series A 5.6 (4–8) · Series B 5.3 (5–9) · Series C 12.0 (6–10): **HAYIR** (2/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 5% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 57% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 48 koşu): 5.4 (hedef 20–40) · hız çarpanı 0.89 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 2.5 (hedef 3–8): **HAYIR**
- Penetrasyon aşama sonu A / B (bilgi; MARKET_FALLBACK_TAM, hedef §8.1 ile 0.5–0.9): 10% / 9%
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 90.0 / 86.1 / 88.2 dk · 1.05×: **HAYIR**
- Kayıt boyutu medyan 77.2 KB (hedef < 70) · maks 84.9 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (1629 aralık): 150–300 gün (hedef 150–300): **EVET**
- C'de kriz, iyi botlar (C'ye ulaşan 48 koşu, medyan): 5 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 48/48
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 11.1 ↔ hazırlanmayan 12.9 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 284/284
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 563 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 43.7 ↔ kriz içeriği olmadan aynı seed'ler 36.9 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 15.8 ↔ 13.9 · kriz / koşu medyanı 12
- İyi bot Unicorn medyanı, ulaşmayan = 100 dk (32/48 ulaştı): 91.3 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 87.2 dk (37/48)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 5/48 (hedef %10–30 → 5–14/48): **EVET** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 9/12 (hedef ≥ %50 → 6–12/12): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 48 koşu): 0.04 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.25
- İyi botlarda kredi alan koşu: 1/48 (hedef ≤ %30 → 0–14/48): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (ara bant; nihai %10–20 T20): 16/256 (hedef %5–25 → 13–64/256): **EVET** · down round 14 · kredi çağrısı 0
- Bilgi: careless: kredi 12/12 · çağrı 0 · düşen tur 6 · down round 6 · greedyGood: kredi 12/12 · çağrı 0 · düşen tur 6 · down round 5 · iplik adımı / koşu (iyi, medyan) 14.5
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B; ara bant, nihai ≥ %40 T20): 0/48 (hedef ≥ %30 → 15–48/48): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 0/12 (hedef ≥ %40 → 5–12/12): **HAYIR**
- Careless iflas (D1 tabanı): 0/12 (hedef ≥ %30 → 4–12/12): **HAYIR**
- İyi bot iflas (D1: ≤ 1/24 seed başına): 0/48 (hedef ≤ %4 → 0–2/48): **EVET**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 48/48 (hedef ≥ %50 → 24–48/48): **EVET**
- Bilgi (maaş masası): iyi botlar masa 66 · erteleme 66 · careless masa 18 · erteleme 16 · greedyGood masa 12 · erteleme 12
- Pre-seed varış medyanı, iyi botlar: 4.7 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 7 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 280 (hedef ≤ 80, bütçe rekabetinden; geç fiiller T15/T17/T19 gelene dek açık): **HAYIR** · medyan 104.5 · 80'i aşan 24/48
- topActionShare, iyi botlar (medyan): 32% (hedef ≤ %30): **HAYIR**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 81% (ara hedef ≥ %60, nihai ≥ %70 T20): **EVET** · Pre-seed → C 80% / 71% / 79% / 79% / 81%

_Süre: 2364.3 sn · `npm run sim -- --seeds 12 --days 3000`_
