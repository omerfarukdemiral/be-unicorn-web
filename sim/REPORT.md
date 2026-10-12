# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g142 (24/24) | 7.2 dk · g216 (24/24) | 20.3 dk · g610 (24/24) | 33.6 dk · g1007 (24/24) | 54.4 dk · g1633 (24/24) | 89.0 dk · g2671 (19/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.4 dk · g222 (24/24) | 13.6 dk · g407 (24/24) | 23.1 dk · g693 (24/24) | 36.3 dk · g1090 (24/24) | 69.6 dk · g2089 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.5 dk · g196 (24/24) | 15.1 dk · g453 (24/24) | 26.5 dk · g796 (24/24) | 47.5 dk · g1425 (24/24) | 72.0 dk · g2160 (24/24) |
| platform | 4.4 dk · g133 (24/24) | 8.3 dk · g248 (24/24) | 16.5 dk · g494 (24/24) | 29.3 dk · g879 (24/24) | 50.9 dk · g1526 (24/24) | 97.1 dk · g2914 (19/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 19, timeout 5 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %39 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 8 | %50 | 36 |
| platform | 0% | unicorn 19, timeout 5 | 8 / 7 | 10 / 8 | %48 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 43.0 dk · g1290 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 7.1 dk · g213 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:talkToUsers 402 | 397 | 14 sn / 43 sn | 0.23× |
| vcRocket | founderAction:talkToUsers 459.5 | 450.5 | 14 sn / 39 sn | 0.30× |
| niche | founderAction:findUsers 313.5 | 313.5 | 14 sn / 32 sn | 0.30× |
| platform | founderAction:talkToUsers 486.5 | 476.5 | 14 sn / 40 sn | 0.22× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (43 sn)**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 14.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 16.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| platform | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 8.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/96) | — | 0 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/24) | — | 1 |
| kaos (random) | 100% (24/24) | 7.1 dk · g213 | 4 |
| idle | 100% (24/24) | 43.0 dk · g1290 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 89.0 dk | 19/24 | 0% | %50 |
| worst | 89.1 dk | 18/24 | 0% | %38 |
| first | 88.0 dk | 24/24 | 0% | %39 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 96.0 dk · %61 · 21/24 | 89.0 dk · %50 · 19/24 | 87.0 dk · %39 · 16/24 | %10 | — |
| vcRocket | 83.5 dk · %58 · 23/24 · iflas 1 | 75.1 dk · %49 · 24/24 | 69.6 dk · %39 · 24/24 | %20 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 91.8 dk · %50 | 89.0 dk · %50 | hayır |
| platform | 96.9 dk · %49 | 97.1 dk · %48 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 16% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 38% · tablo tavanı 0% · tablo tabanı 62%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 417 | 0.8 | 2.0 | 0% | 0.0 | 1.0 |
| Pre-seed | 233 | 4.9 | 29.8 | 15% | 3.6 | 6.3 |
| Seed | 907 | 35.7 | 99.0 | 53% | 4.6 | 6.7 |
| Series A | 1112 | 8.2 | 99.0 | 36% | 4.4 | 5.8 |
| Series B | 1905 | 12.4 | 99.0 | 42% | 3.8 | 7.7 |
| Series C | 3962 | 28.2 | 99.0 | 53% | 6.2 | 14.4 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 94 | 0 | 17% | 0.0 |
| Seed | 96 | 0 | 13% | 3.6 |
| Series A | 96 | 0 | 11% | 3.5 |
| Series B | 96 | 0 | 11% | 3.2 |
| Series C | 96 | 0 | 16% | 2.2 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 3 | 24 | 23 | 36 | 70.5 |
| vcRocket | 8 | 4 | 19 | 23 | 36 | 88 |
| niche | 8 | 3 | 9 | 11 | 20.5 | 24 |
| platform | 7 | 4 | 25 | 28.5 | 40.5 | 115.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 30%, en kötü 35% (hedef ≤ %35).

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 22/24 | 61% | 81% | 14% |
| idleAfterProfit | 0/24 | — | 0/24 | 92% | 15% | 3% |
| greedyGood | 24/24 | 78.9 dk | 0/24 | 30% | 0% | 6% |
| burner | 19/24 | 89.0 dk | 0/24 | 28% | 0% | 5% |
| frugal | 21/24 | 89.0 dk | 0/24 | 76% | 0% | 5% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 5% | 0% | 65% |

Kayıt boyutu (koşu sonu, 264 koşu): medyan 76.3 KB · maks 99.9 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 89.0 / 69.6 / 72.0 / 97.1 dk → **hedefin 7 dk üstünde (en yavaş)**; arketip farkı 1.39× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 53% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %1 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 13 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 15% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 77.2 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 77.2 dk (%94): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 92.1 dk ↔ 90.5 dk (%-2): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 34% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 92/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 49% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.6 (3–6) · Series A 4.4 (4–8) · Series B 3.8 (5–9) · Series C 6.2 (6–10): **HAYIR** (3/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 6% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 45% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 2.2 (hedef 20–40) · hız çarpanı 0.96 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 4 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 11% / 11%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 91/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 89.0 / 69.6 / 72.0 / 97.1 dk · 1.39×: **HAYIR**
- Kayıt boyutu medyan 76.3 KB (hedef < 70) · maks 99.9 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3528 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 4 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 6.7 ↔ hazırlanmayan 6.8 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 528/528
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1229 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 41.8 ↔ kriz içeriği olmadan aynı seed'ler 32.9 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 15.6 ↔ 13.9 · kriz / koşu medyanı 10
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (86/96 ulaştı): 79.1 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 75.9 dk (91/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 18/96 (hedef %10–30 → 10–28/96): **EVET** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.01 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.13
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 686/1967 (hedef %30–50 → 591–983/1967): **EVET**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 6.4 (hedef 4–10) · yenilenen 96% (hedef ≥ %60): **EVET** · koşu başına 0–37 · satıcılar (bootstrap + niche, 48 koşu) 12.9
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 2/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 2/2 (hedef ≥ %50 → 1–2/2): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 30/510 (hedef %10–20 → 51–102/510): **HAYIR** · down round 26 · kredi çağrısı 0
- Bilgi: careless: kredi 12/24 · çağrı 0 · düşen tur 5 · down round 4 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 8 · down round 5 · iplik adımı / koşu (iyi, medyan) 11
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 11/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 2/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 11/11 (hedef ≥ %60 → 7–11/11): **EVET** · n = 11
- Bilgi (maaş masası): iyi botlar masa 114 · erteleme 114 · careless masa 21 · erteleme 21 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.5 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 148 (hedef ≤ 80): **HAYIR** · medyan 31 · 80'i aşan 20/96
- topActionShare, iyi botlar (medyan): 30% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 78% (hedef ≥ %70): **EVET** · Pre-seed → C 83% / 76% / 78% / 71% / 78%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 93 · founder-no-pay 90 · lean-office 96 · deferred-pay 40 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 23/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 9 · team-mutiny 0 · rival-dies 0 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 794.1 sn · `npm run sim -- --seeds 24 --days 4500`_
