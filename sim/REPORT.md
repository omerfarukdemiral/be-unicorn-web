# Be Unicorn — Denge Simülasyonu Raporu

12 seed × 4 arketip, en fazla 3000 oyun günü (100 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g140 (12/12) | 7.6 dk · g229 (12/12) | 20.0 dk · g599 (12/12) | 33.0 dk · g989 (12/12) | 50.0 dk · g1500 (12/12) | 85.3 dk · g2560 (10/12) |
| vcRocket | 4.3 dk · g128 (12/12) | 8.7 dk · g261 (12/12) | 19.9 dk · g598 (12/12) | 29.6 dk · g888 (12/12) | 44.4 dk · g1332 (12/12) | 83.1 dk · g2493 (11/12) |
| niche | 4.7 dk · g142 (12/12) | 7.2 dk · g215 (12/12) | 16.6 dk · g498 (12/12) | 29.9 dk · g897 (12/12) | 51.1 dk · g1535 (12/12) | 84.8 dk · g2544 (12/12) |
| platform | 4.5 dk · g134 (12/12) | 8.2 dk · g247 (12/12) | 23.0 dk · g691 (12/12) | 34.2 dk · g1027 (12/12) | 52.9 dk · g1588 (12/12) | 90.2 dk · g2707 (2/12) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 10, timeout 2 | 7 / 6 | 8 / 8 | %50 | 36 |
| vcRocket | 0% | unicorn 11, timeout 1 | 7 / 6 | 10 / 7 | %36 | 36 |
| niche | 0% | unicorn 12 | 7 / 6 | 9 / 7 | %50 | 36 |
| platform | 0% | timeout 10, unicorn 2 | 7 / 6 | 10 / 7 | %47 | 36 |

Toplam iflas oranı: **0%** (0/48).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 0/12 | — | 0 | 7 |
| random (rastgele aksiyon) | 0/12 | — | 0 | 7 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:findUsers 259 | 259 | 14 sn / 42 sn | 0.29× |
| vcRocket | founderAction:talkToUsers 578.5 | 576 | 23 sn / 38 sn | 0.37× |
| niche | founderAction:findUsers 234.5 | 234.5 | 14 sn / 14 sn | 0.36× |
| platform | founderAction:talkToUsers 484.5 | 475.5 | 17 sn / 38 sn | 0.26× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (42 sn)**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 14.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 14.0 sn | 2.0 sn / 8.0 sn | 1 | 0 |
| platform | 2.0 sn | 6.0 sn / 22.0 sn | 2.0 sn / 8.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/48) | — | 1 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/12) | — | 1 |
| kaos (random) | 0% (0/12) | — | 0 |
| idle | 0% (0/12) | — | 0 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 85.3 dk | 10/12 | 0% | %50 |
| worst | 85.3 dk | 10/12 | 0% | %50 |
| first | 85.3 dk | 10/12 | 0% | %50 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 85.3 dk · %50 · 10/12 | 85.3 dk · %50 · 10/12 | 85.3 dk · %50 · 10/12 | %0 | small |
| vcRocket | 83.1 dk · %36 · 11/12 | 83.1 dk · %36 · 11/12 | 83.1 dk · %36 · 11/12 | %0 | small |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 85.3 dk · %50 | 85.3 dk · %50 | hayır |
| platform | 90.2 dk · %47 | 90.2 dk · %47 | hayır |

Tur kapanışları (iyi botlar, 240 tur): metrik kısmı tavanda 24% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 31% · tablo tavanı 0% · tablo tabanı 69%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı |
|---|---|---|---|---|
| Garaj | 210 | 0.6 | 1.7 | 0% |
| Pre-seed | 159 | 5.8 | 21.9 | 7% |
| Seed | 567 | 99.0 | 99.0 | 89% |
| Series A | 568 | 14.8 | 99.0 | 41% |
| Series B | 861 | 12.1 | 99.0 | 42% |
| Series C | 1887 | 27.0 | 99.0 | 52% |

Aşama min-runway (GAMEPLAY V2 §15): her koşunun o aşamadaki en düşük maaş günü runway’i (ay, kâr = 99), iyi botlar. Hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10.

| Aşama | Koşu | Min-runway p50 | p90 | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|---|---|
| Garaj | 48 | 0.0 | 0.4 | 4 | 11% | 0.0 |
| Pre-seed | 48 | 3.7 | 5.8 | 0 | 24% | 0.0 |
| Seed | 48 | 10.6 | 78.6 | 0 | 20% | 3.9 |
| Series A | 48 | 5.4 | 10.4 | 0 | 15% | 2.3 |
| Series B | 48 | 3.9 | 17.8 | 0 | 14% | 3.3 |
| Series C | 48 | 5.8 | 16.0 | 0 | 18% | 1.4 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7.5 | 4 | 12 | 12 | 16.5 | 37 |
| vcRocket | 8 | 4 | 28.5 | 25 | 35 | 116 |
| niche | 8 | 4 | 10 | 14 | 20.5 | 29.5 |
| platform | 7 | 4 | 37.5 | 25.5 | 40 | 109.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 27%, en kötü 37% (hedef ≤ %35).

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/12 | — | 0/12 | 90% | 35% | 5% |
| idleAfterProfit | 0/12 | — | 0/12 | 90% | 81% | 5% |
| greedyGood | 8/12 | 83.2 dk | 0/12 | 40% | 0% | 6% |
| burner | 8/12 | 85.2 dk | 0/12 | 31% | 0% | 5% |
| frugal | 7/12 | 91.7 dk | 0/12 | 78% | 0% | 5% |
| burner (dikkatsiz) | 0/12 | — | 12/12 | 30% | 4% | 35% |

Kayıt boyutu (koşu sonu, 132 koşu): medyan 76.0 KB · maks 86.6 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 85.3 / 83.1 / 84.8 dk → **hedef aralıkta**; arketip farkı 1.03× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 3/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı): iyi botlar 0% (hedef ≤ %3): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %10–25): **HAYIR** · idle 0% ve kaos (random) 0%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 1 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **HAYIR** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 89% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %0 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 0 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/48 (hedef ≤ %5 → 0–2/48): **EVET**
- Careless iflas: 0/12 (hedef %40–60 → 5–7/12): **HAYIR**
- greedyGood iflas: 0/12 (hedef %15–30 → 2–3/12): **HAYIR**
- coaster Unicorn (E1 nihai): 0/12 (hedef ≤ %0 → 0–0/12): **EVET**
- idleAfterProfit Unicorn: 0/12 (hedef ≤ %0 → 0–0/12) · tepe sonrası düşüş medyanı 81% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 85.6 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 100 dk): 100.0 dk ↔ 85.6 dk (%17): **HAYIR**
- Dikkatsiz burner iflas: 12/12 (hedef ≥ %40 → 5–12/12): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 100 dk): 94.7 dk ↔ 97.5 dk (%3): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 39% (hedef ≤ %35): **HAYIR** · B’den önce kâra geçen koşu 48/48 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 43% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 10.6 (3–6) · Series A 5.4 (4–8) · Series B 3.9 (5–9) · Series C 5.8 (6–10): **HAYIR** (1/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 6% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 49% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 48 koşu): 1.4 (hedef 20–40) · hız çarpanı 0.97 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 2 (hedef 3–8): **HAYIR**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 15% / 14%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 2 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 43/48
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 48/48
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 85.3 / 83.1 / 84.8 dk · 1.03×: **HAYIR**
- Kayıt boyutu medyan 76.0 KB (hedef < 70) · maks 86.6 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (1643 aralık): 150–300 gün (hedef 150–300): **EVET**
- C'de kriz, iyi botlar (C'ye ulaşan 48 koşu, medyan): 5 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 48/48
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 7.2 ↔ hazırlanmayan 9.5 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 267/267
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 563 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 44.3 ↔ kriz içeriği olmadan aynı seed'ler 36.9 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 16.6 ↔ 15.0 · kriz / koşu medyanı 11
- İyi bot Unicorn medyanı, ulaşmayan = 100 dk (35/48 ulaştı): 88.5 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 80.4 dk (43/48)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 3/48 (hedef %10–30 → 5–14/48): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 12/12 (hedef ≥ %50 → 6–12/12): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 48 koşu): 0.05 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.18
- İyi botlarda kredi alan koşu: 1/48 (hedef ≤ %30 → 0–14/48): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (ara bant; nihai %10–20 T20): 19/259 (hedef %5–25 → 13–64/259): **EVET** · down round 17 · kredi çağrısı 0
- Bilgi: careless: kredi 7/12 · çağrı 0 · düşen tur 4 · down round 4 · greedyGood: kredi 12/12 · çağrı 0 · düşen tur 5 · down round 4 · iplik adımı / koşu (iyi, medyan) 15.5
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B; ara bant, nihai ≥ %40 T20): 2/48 (hedef ≥ %30 → 15–48/48): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 0/12 (hedef ≥ %40 → 5–12/12): **HAYIR**
- Careless iflas (D1 tabanı): 0/12 (hedef ≥ %30 → 4–12/12): **HAYIR**
- İyi bot iflas (D1: ≤ 1/24 seed başına): 0/48 (hedef ≤ %4 → 0–2/48): **EVET**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3; F2 ara bant, nihai ≥ %60 T20): 48/48 (hedef ≥ %55 → 27–48/48): **EVET** · n = 48
- Bilgi (maaş masası): iyi botlar masa 66 · erteleme 66 · careless masa 16 · erteleme 14 · greedyGood masa 12 · erteleme 12
- Pre-seed varış medyanı, iyi botlar: 4.6 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 7 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 274 (hedef ≤ 80, bütçe rekabetinden; geç fiiller T15/T17/T19 gelene dek açık): **HAYIR** · medyan 91 · 80'i aşan 24/48
- topActionShare, iyi botlar (medyan): 27% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (ara hedef ≥ %60, nihai ≥ %70 T20): **EVET** · Pre-seed → C 81% / 73% / 79% / 70% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 7 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 39 · founder-no-pay 41 · lean-office 47 · deferred-pay 10 · layoff-round 0 · hire-fast 24 · ads-first 24 · crunch-culture 12 · quality-gate 24 · remote-first 36 · profit-share 24 · management 48
- Zorunlu politika yok (bilgi, denge T20): her iyi koşunun imzaladığı management: **HAYIR**

_Süre: 1084.1 sn · `npm run sim -- --seeds 12 --days 3000`_
