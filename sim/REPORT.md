# Be Unicorn — Denge Simülasyonu Raporu

12 seed × 4 arketip, en fazla 3000 oyun günü (100 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.5 dk · g135 (12/12) | 7.3 dk · g221 (12/12) | 17.1 dk · g515 (12/12) | 30.1 dk · g904 (12/12) | 51.1 dk · g1535 (12/12) | 94.0 dk · g2821 (5/12) |
| vcRocket | 4.1 dk · g122 (12/12) | 7.7 dk · g230 (12/12) | 19.4 dk · g582 (12/12) | 30.3 dk · g910 (12/12) | 47.6 dk · g1429 (12/12) | 95.1 dk · g2853 (5/12) |
| niche | 4.0 dk · g120 (12/12) | 7.2 dk · g215 (12/12) | 15.4 dk · g462 (12/12) | 26.6 dk · g797 (12/12) | 45.5 dk · g1367 (12/12) | 86.4 dk · g2591 (11/12) |
| platform | 4.2 dk · g127 (12/12) | 7.3 dk · g220 (12/12) | 20.7 dk · g622 (12/12) | 29.8 dk · g895 (12/12) | 48.5 dk · g1454 (12/12) | 89.8 dk · g2694 (10/12) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | timeout 7, unicorn 5 | 7 / 7 | 8 / 7 | %47 | 36 |
| vcRocket | 0% | unicorn 5, timeout 7 | 7 / 7 | 10 / 9 | %33 | 36 |
| niche | 0% | unicorn 11, timeout 1 | 7 / 7 | 9 / 7 | %48 | 36 |
| platform | 0% | unicorn 10, timeout 2 | 7 / 7 | 10 / 7 | %45 | 36 |

Toplam iflas oranı: **0%** (0/48).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 0/12 | — | 0 | 7 |
| random (rastgele aksiyon) | 0/12 | — | 0 | 7 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:salesCall 271.5 | 29.5 | 14 sn / 14 sn | 0.36× |
| vcRocket | setAdBudget 84 | 29 | 14 sn / 14 sn | 0.48× |
| niche | founderAction:salesCall 240.5 | 27.5 | 14 sn / 14 sn | 0.36× |
| platform | upgradeItem 72 | 29 | 14 sn / 14 sn | 0.29× |

- findUsers hiçbir arketipte en sık aksiyon değil: **EVET**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **EVET**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 24.0 sn | 4.0 sn / 12.0 sn | 0.5 | 0 |
| vcRocket | 2.0 sn | 8.0 sn / 24.0 sn | 6.0 sn / 22.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.5 sn / 24.0 sn | 4.0 sn / 12.0 sn | 1 | 0 |
| platform | 2.0 sn | 6.0 sn / 24.0 sn | 6.0 sn / 21.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/48) | — | 1 |
| dikkatsiz (bootstrap planı, özensiz) | 8% (1/12) | 8.0 dk · g240 | 1 |
| kaos (random) | 0% (0/12) | — | 0.5 |
| idle | 0% (0/12) | — | 0.5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 94.0 dk | 5/12 | 0% | %47 |
| worst | 94.0 dk | 5/12 | 0% | %47 |
| first | 94.0 dk | 5/12 | 0% | %47 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 94.0 dk · %47 · 5/12 | 94.0 dk · %47 · 5/12 | 94.0 dk · %47 · 5/12 | %0 | small |
| vcRocket | 95.1 dk · %33 · 5/12 | 95.1 dk · %33 · 5/12 | 95.1 dk · %33 · 5/12 | %0 | small |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 94.0 dk · %47 | 94.0 dk · %47 | hayır |
| platform | 89.8 dk · %45 | 89.8 dk · %45 | hayır |

Tur kapanışları (iyi botlar, 240 tur): metrik kısmı tavanda 40% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 37% · tablo tavanı 0% · tablo tabanı 63%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı |
|---|---|---|---|---|
| Garaj | 178 | 0.9 | 2.0 | 0% |
| Pre-seed | 160 | 5.7 | 18.4 | 5% |
| Seed | 515 | 99.0 | 99.0 | 84% |
| Series A | 545 | 17.7 | 99.0 | 44% |
| Series B | 904 | 36.3 | 99.0 | 57% |
| Series C | 2133 | 66.2 | 99.0 | 62% |

Aşama min-runway (GAMEPLAY V2 §15): her koşunun o aşamadaki en düşük maaş günü runway’i (ay, kâr = 99), iyi botlar. Hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10.

| Aşama | Koşu | Min-runway p50 | p90 | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|---|---|
| Garaj | 48 | 0.0 | 0.6 | 3 | 5% | 0.0 |
| Pre-seed | 48 | 3.5 | 6.9 | 0 | 12% | 0.0 |
| Seed | 48 | 9.7 | 20.2 | 0 | 15% | 0.0 |
| Series A | 48 | 5.8 | 12.2 | 0 | 12% | 3.1 |
| Series B | 48 | 9.0 | 27.6 | 0 | 10% | 2.7 |
| Series C | 48 | 14.4 | 47.9 | 0 | 12% | 4.3 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 4.5 | 13.5 | 16.5 | 25 | 62 |
| vcRocket | 7 | 5 | 24 | 18.5 | 29.5 | 89 |
| niche | 7 | 4.5 | 11.5 | 17 | 26 | 55 |
| platform | 7 | 4 | 28.5 | 18 | 29.5 | 76 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 26%, en kötü 37% (hedef ≤ %35).

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/12 | — | 0/12 | 90% | 81% | 4% |
| idleAfterProfit | 0/12 | — | 0/12 | 90% | 9% | 4% |
| greedyGood | 1/12 | 94.0 dk | 0/12 | 47% | 0% | 4% |
| burner | 11/12 | 71.7 dk | 0/12 | 28% | 0% | 6% |
| frugal | 3/12 | 88.2 dk | 0/12 | 77% | 42% | 4% |
| burner (dikkatsiz) | 0/12 | — | 12/12 | 20% | 0% | 37% |

Kayıt boyutu (koşu sonu, 132 koşu): medyan 77.0 KB · maks 84.0 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 86.4 / 89.8 dk → **hedef aralıkta**; arketip farkı 1.04× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 2/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı): iyi botlar 0% (hedef ≤ %3): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 8% (hedef %10–25): **HAYIR** · idle 0% ve kaos (random) 0%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 1 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **HAYIR** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 84% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %0 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 0 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/48 (hedef ≤ %5 → 0–2/48): **EVET**
- Careless iflas: 1/12 (hedef %40–60 → 5–7/12): **HAYIR**
- greedyGood iflas: 0/12 (hedef %15–30 → 2–3/12): **HAYIR**
- coaster Unicorn: 0/12 (hedef ≤ %0 → 0–0/12): **EVET** (bilgi; B2 ara, nihai hedef E1)
- idleAfterProfit Unicorn: 0/12 (hedef ≤ %0 → 0–0/12) · tepe sonrası düşüş medyanı 9% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 89.9 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 100 dk): 100.0 dk ↔ 89.9 dk (%11): **HAYIR**
- Dikkatsiz burner iflas: 12/12 (hedef ≥ %40 → 5–12/12): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 100 dk): 73.7 dk ↔ 100.0 dk (%26): **EVET**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 40% (hedef ≤ %35): **HAYIR** · B’den önce kâra geçen koşu 48/48 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 49% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 9.7 (3–6) · Series A 5.8 (4–8) · Series B 9.0 (5–9) · Series C 14.4 (6–10): **HAYIR** (1/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 4% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 57% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 48 koşu): 4.3 (hedef 20–40) · hız çarpanı 0.91 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 2 (hedef 3–8): **HAYIR**
- Penetrasyon aşama sonu A / B (bilgi; MARKET_FALLBACK_TAM, hedef §8.1 ile 0.5–0.9): 12% / 10%
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 86.4 / 89.8 dk · 1.04×: **HAYIR**
- Kayıt boyutu medyan 77.0 KB (hedef < 70) · maks 84.0 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (1649 aralık): 150–300 gün (hedef 150–300): **EVET**
- C'de kriz, iyi botlar (C'ye ulaşan 48 koşu, medyan): 5 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 48/48
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 12.5 ↔ hazırlanmayan 18.3 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 293/293
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 579 kriz): 3% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 48.2 ↔ kriz içeriği olmadan aynı seed'ler 39.6 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 17.4 ↔ 14.7 · kriz / koşu medyanı 12
- İyi bot Unicorn medyanı, ulaşmayan = 100 dk (31/48 ulaştı): 95.1 dk (tolerans 55–95 dk): **HAYIR** · kriz içeriği olmadan 91.5 dk (36/48)

_Süre: 1079.3 sn · `npm run sim -- --seeds 12 --days 3000`_
