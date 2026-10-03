# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.6 dk · g138 (24/24) | 8.0 dk · g241 (24/24) | 22.1 dk · g663 (24/24) | 34.5 dk · g1037 (24/24) | 55.6 dk · g1669 (24/24) | 87.4 dk · g2623 (23/24) |
| vcRocket | 4.3 dk · g130 (24/24) | 7.5 dk · g226 (24/24) | 19.2 dk · g577 (24/24) | 29.3 dk · g880 (24/24) | 44.2 dk · g1327 (24/24) | 84.7 dk · g2540 (22/24) |
| niche | 4.5 dk · g135 (24/24) | 7.1 dk · g214 (24/24) | 19.0 dk · g571 (24/24) | 33.6 dk · g1008 (24/24) | 54.2 dk · g1626 (24/24) | 77.9 dk · g2337 (21/24) |
| platform | 4.5 dk · g135 (24/24) | 8.3 dk · g249 (24/24) | 22.6 dk · g679 (24/24) | 33.8 dk · g1013 (24/24) | 51.7 dk · g1551 (24/24) | 91.6 dk · g2748 (23/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 23, timeout 1 | 7 / 6 | 8 / 7 | %52 | 36 |
| vcRocket | 0% | unicorn 22, timeout 2 | 7 / 6 | 10 / 7 | %38 | 36 |
| niche | 0% | unicorn 21, timeout 3 | 7 / 6 | 9 / 7 | %52 | 36 |
| platform | 0% | unicorn 23, timeout 1 | 7 / 6 | 10 / 7 | %50 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 43.0 dk · g1290 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 17.1 dk · g513 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:findUsers 390 | 390 | 14 sn / 14 sn | 0.26× |
| vcRocket | founderAction:talkToUsers 554 | 551 | 14 sn / 40 sn | 0.36× |
| niche | founderAction:findUsers 360 | 360 | 14 sn / 55 sn | 0.30× |
| platform | founderAction:talkToUsers 466 | 453 | 14 sn / 39 sn | 0.22× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (55 sn)**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 14.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 18.5 sn | 2.0 sn / 8.0 sn | 1 | 0 |
| platform | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 8.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/96) | — | 1 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/24) | — | 2 |
| kaos (random) | 100% (24/24) | 17.1 dk · g513 | 4 |
| idle | 100% (24/24) | 43.0 dk · g1290 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 87.4 dk | 23/24 | 0% | %52 |
| worst | 85.6 dk | 10/24 | 0% | %44 |
| first | 85.2 dk | 24/24 | 0% | %42 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 98.0 dk · %62 · 23/24 | 87.4 dk · %52 · 23/24 | 84.0 dk · %41 · 23/24 | %17 | — |
| vcRocket | 101.1 dk · %58 · 23/24 | 86.4 dk · %47 · 24/24 | 84.7 dk · %38 · 22/24 | %19 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 86.1 dk · %51 | 87.4 dk · %52 | hayır |
| platform | 89.5 dk · %50 | 91.6 dk · %50 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 23% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 41% · tablo tavanı 0% · tablo tabanı 59%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 409 | 0.6 | 1.9 | 0% | 0.0 | 0.4 |
| Pre-seed | 329 | 4.9 | 20.5 | 8% | 3.6 | 5.4 |
| Seed | 1245 | 99.0 | 99.0 | 84% | 7.3 | 26.0 |
| Series A | 1106 | 11.1 | 99.0 | 38% | 5.2 | 7.6 |
| Series B | 1792 | 14.0 | 99.0 | 46% | 3.9 | 22.5 |
| Series C | 3995 | 27.4 | 99.0 | 52% | 5.9 | 14.3 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 96 | 0 | 19% | 0.0 |
| Seed | 96 | 0 | 17% | 4.0 |
| Series A | 96 | 0 | 12% | 3.2 |
| Series B | 96 | 0 | 11% | 2.5 |
| Series C | 96 | 0 | 17% | 0.1 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 5 | 13.5 | 11.5 | 18.5 | 34 |
| vcRocket | 8 | 4 | 30 | 25 | 39.5 | 104 |
| niche | 8 | 4 | 11 | 14 | 18.5 | 28 |
| platform | 7 | 4 | 37.5 | 23 | 39 | 106 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 32%, en kötü 40% (hedef ≤ %35).

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 0/24 | 92% | 81% | 3% |
| idleAfterProfit | 0/24 | — | 0/24 | 92% | 81% | 3% |
| greedyGood | 24/24 | 81.0 dk | 0/24 | 39% | 0% | 6% |
| burner | 22/24 | 89.2 dk | 0/24 | 33% | 0% | 6% |
| frugal | 22/24 | 91.1 dk | 0/24 | 79% | 0% | 5% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 34% | 1% | 34% |

Kayıt boyutu (koşu sonu, 264 koşu): medyan 77.2 KB · maks 99.5 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 87.4 / 84.7 / 77.9 / 91.6 dk → **hedefin 2 dk üstünde (en yavaş)**; arketip farkı 1.18× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 1 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 84% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %3 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 9 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 81% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 87.0 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 87.0 dk (%72): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 92.2 dk ↔ 92.0 dk (%0): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 39% (hedef ≤ %35): **HAYIR** · B’den önce kâra geçen koşu 96/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 43% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 7.3 (3–6) · Series A 5.2 (4–8) · Series B 3.9 (5–9) · Series C 5.9 (6–10): **HAYIR** (1/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 6% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 49% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 0.1 (hedef 20–40) · hız çarpanı 1.00 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 12% / 11%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 92/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 87.4 / 84.7 / 77.9 / 91.6 dk · 1.18×: **EVET**
- Kayıt boyutu medyan 77.2 KB (hedef < 70) · maks 99.5 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3933 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 77
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 4 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 7.1 ↔ hazırlanmayan 8.8 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 555/555
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1298 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 45.8 ↔ kriz içeriği olmadan aynı seed'ler 37.2 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 16.4 ↔ 15.4 · kriz / koşu medyanı 11
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (89/96 ulaştı): 88.0 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 78.8 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 13/96 (hedef %10–30 → 10–28/96): **EVET** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 22/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 1 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.01 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.01 / 0.00 / 0.15
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 673/1939 (hedef %30–50 → 582–969/1939): **EVET**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 6.0 (hedef 4–10) · yenilenen 96% (hedef ≥ %60): **EVET** · koşu başına 0–33 · satıcılar (bootstrap + niche, 48 koşu) 12.0
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 1/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 28/508 (hedef %10–20 → 51–101/508): **HAYIR** · down round 25 · kredi çağrısı 0
- Bilgi: careless: kredi 15/24 · çağrı 0 · düşen tur 15 · down round 14 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 6 · down round 5 · iplik adımı / koşu (iyi, medyan) 15.5
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 6/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 1/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 6/6 (hedef ≥ %60 → 4–6/6): **EVET** · n = 6
- Bilgi (maaş masası): iyi botlar masa 124 · erteleme 124 · careless masa 41 · erteleme 39 · greedyGood masa 27 · erteleme 27
- Pre-seed varış medyanı, iyi botlar: 4.5 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 7 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 142 (hedef ≤ 80): **HAYIR** · medyan 27.5 · 80'i aşan 15/96
- topActionShare, iyi botlar (medyan): 32% (hedef ≤ %30): **HAYIR**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 78% (hedef ≥ %70): **EVET** · Pre-seed → C 81% / 72% / 78% / 71% / 78%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 7.5 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 87 · founder-no-pay 83 · lean-office 96 · deferred-pay 29 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 60/96 (hedef ≥ %60 → 58–96/96): **EVET**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 5 · team-mutiny 0 · rival-dies 3 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 60: **EVET**

_Süre: 681.2 sn · `npm run sim -- --seeds 24 --days 4500`_
