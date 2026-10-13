# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g142 (24/24) | 7.1 dk · g214 (24/24) | 16.6 dk · g497 (24/24) | 26.9 dk · g806 (24/24) | 41.9 dk · g1257 (24/24) | 62.7 dk · g1881 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.4 dk · g223 (24/24) | 13.2 dk · g397 (24/24) | 22.3 dk · g668 (24/24) | 37.1 dk · g1113 (24/24) | 86.3 dk · g2590 (23/24) |
| niche | 4.6 dk · g137 (24/24) | 6.5 dk · g196 (24/24) | 15.0 dk · g451 (24/24) | 23.5 dk · g705 (24/24) | 41.0 dk · g1232 (24/24) | 53.9 dk · g1616 (24/24) |
| platform | 4.4 dk · g133 (24/24) | 7.5 dk · g227 (24/24) | 16.5 dk · g494 (24/24) | 27.6 dk · g829 (24/24) | 45.2 dk · g1356 (24/24) | 81.5 dk · g2447 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 23, timeout 1 | 7 / 6 | 10 / 7 | %39 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 8 | %51 | 36 |
| platform | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %48 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 43.0 dk · g1290 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 8.1 dk · g243 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:talkToUsers 223 | 216 | 14 sn / 15 sn | 0.24× |
| vcRocket | founderAction:talkToUsers 567 | 561.5 | 14 sn / 39 sn | 0.31× |
| niche | founderAction:findUsers 183.5 | 183.5 | 14 sn / 32 sn | 0.30× |
| platform | founderAction:talkToUsers 325 | 312 | 14 sn / 40 sn | 0.23× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (40 sn)**

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
| dikkatsiz (bootstrap planı, özensiz) | 25% (6/24) | 129.0 dk · g3870 | 1 |
| kaos (random) | 100% (24/24) | 8.1 dk · g243 | 3.5 |
| idle | 100% (24/24) | 43.0 dk · g1290 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 62.7 dk | 24/24 | 0% | %50 |
| worst | 62.0 dk | 20/24 | 0% | %42 |
| first | 61.3 dk | 24/24 | 0% | %44 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 71.1 dk · %61 · 24/24 | 62.7 dk · %50 · 24/24 | 60.9 dk · %40 · 24/24 | %17 | — |
| vcRocket | 98.2 dk · %59 · 20/24 · iflas 1 | 95.0 dk · %47 · 23/24 | 86.3 dk · %39 · 23/24 | %14 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 63.5 dk · %50 | 62.7 dk · %50 | hayır |
| platform | 80.7 dk · %49 | 81.5 dk · %48 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 16% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 39% · tablo tavanı 0% · tablo tabanı 61%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 417 | 0.8 | 2.0 | 0% | 0.0 | 1.0 |
| Pre-seed | 230 | 5.1 | 30.6 | 15% | 3.5 | 5.5 |
| Seed | 788 | 19.8 | 99.0 | 49% | 4.8 | 6.9 |
| Series A | 983 | 7.7 | 99.0 | 33% | 4.2 | 6.1 |
| Series B | 1539 | 8.4 | 99.0 | 36% | 3.5 | 8.4 |
| Series C | 2965 | 16.8 | 99.0 | 41% | 6.6 | 26.4 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 94 | 0 | 17% | 0.0 |
| Seed | 96 | 0 | 13% | 3.6 |
| Series A | 96 | 0 | 10% | 3.5 |
| Series B | 96 | 0 | 10% | 2.5 |
| Series C | 96 | 0 | 14% | 1.9 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 3 | 18.5 | 20 | 26 | 42.5 |
| vcRocket | 8 | 4 | 16.5 | 22.5 | 39 | 142.5 |
| niche | 8 | 3 | 9 | 9.5 | 16.5 | 15.5 |
| platform | 7 | 3 | 25 | 25.5 | 39 | 87.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 35% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 8 | 12 | paywall 24 | paywall 48, onboarding 48, analytics 48 | 73% (386 hafta) | 1 |
| vcRocket | 24/24 | 8 | 20 | referral 24 | referral 48, analytics 48, freemium 48 | 57% (337 hafta) | 1 |
| niche | 24/24 | 4 | 5 | feedback 24 | feedback 24, onboarding 24, openApi 24 | 62% (383 hafta) | 0 |
| platform | 24/24 | 9 | 17 | feedback 24 | feedback 72, referral 48, onboarding 48 | 73% (421 hafta) | 1 |
| careless | 24/24 | 6 | 39 | paywall 24 | paywall 48, onboarding 48, analytics 48 | 97% (229 hafta) | 453 |
| coasterModules | 24/24 | 2 | 4.5 | paywall 24 | paywall 24, onboarding 24 | 62% (95 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 73.2 dk · 0 iflas | 24/24 · 53.9 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 88.0 dk · 0 iflas | 24/24 · 62.7 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 62.9 dk · 0 iflas | 23/24 · 86.3 dk · 0 iflas |
| ek kategori | platform | 22/24 · 97.0 dk · 0 iflas | 24/24 · 81.5 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 8 iflas | 0/24 · — · 6 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 2

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 23/24 | 62% | 81% | 13% |
| coasterModules | 0/24 | — | 24/24 | 61% | 81% | 15% |
| idleAfterProfit | 0/24 | — | 1/24 | 92% | 15% | 3% |
| greedyGood | 24/24 | 74.0 dk | 0/24 | 28% | 0% | 7% |
| burner | 24/24 | 61.3 dk | 0/24 | 26% | 0% | 8% |
| frugal | 24/24 | 70.1 dk | 0/24 | 66% | 0% | 6% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 6% | 0% | 63% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 71.2 KB · maks 101.0 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 62.7 / 86.3 / 53.9 / 81.5 dk → **hedefin 6 dk altında (en hızlı)**; arketip farkı 1.60× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 25% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 49% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %2 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 8 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 6/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 15% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 69.6 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 69.6 dk (%116): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 61.3 dk ↔ 70.1 dk (%13): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 28% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 92/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 28% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.8 (3–6) · Series A 4.2 (4–8) · Series B 3.5 (5–9) · Series C 6.6 (6–10): **HAYIR** (3/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 36% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 1.9 (hedef 20–40) · hız çarpanı 0.96 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 62/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 62.7 / 86.3 / 53.9 / 81.5 dk · 1.60×: **HAYIR**
- Kayıt boyutu medyan 71.2 KB (hedef < 70) · maks 101.0 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3266 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 87/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.7 ↔ hazırlanmayan 4.9 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 456/456
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1142 kriz): 4% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 37.9 ↔ kriz içeriği olmadan aynı seed'ler 31.9 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 17.4 ↔ 16.5 · kriz / koşu medyanı 9
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (95/96 ulaştı): 69.7 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 62.3 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 1/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.09
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 340/1506 (hedef %30–50 → 452–753/1506): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 2.0 (hedef 4–10) · yenilenen 101% (hedef ≥ %60): **HAYIR** · koşu başına 0–9 · satıcılar (bootstrap + niche, 48 koşu) 3.9
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 0/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 0/0 (hedef ≥ %50 → 0–0/0): **EVET** (kredi alan yok)
- Düşen tur payı, iyi botlar (tur denemesi): 25/505 (hedef %10–20 → 51–101/505): **HAYIR** · down round 25 · kredi çağrısı 0
- Bilgi: careless: kredi 18/24 · çağrı 7 · düşen tur 9 · down round 8 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 4 · down round 4 · iplik adımı / koşu (iyi, medyan) 11
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 15/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 12/24 (hedef ≥ %50 → 12–24/24): **EVET**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 15/15 (hedef ≥ %60 → 9–15/15): **EVET** · n = 15
- Bilgi (maaş masası): iyi botlar masa 114 · erteleme 114 · careless masa 41 · erteleme 37 · greedyGood masa 25 · erteleme 25
- Pre-seed varış medyanı, iyi botlar: 4.5 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 70 (hedef ≤ 80): **EVET** · medyan 23 · 80'i aşan 0/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 84% / 80% / 80% / 79% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 12/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: —
- Politika / koşu (medyan): iyi 7 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 93 · founder-no-pay 90 · lean-office 96 · deferred-pay 31 · layoff-round 1 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 29/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 9 · team-mutiny 0 · rival-dies 0 · founder-burnout 25: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 1060.2 sn · `npm run sim -- --seeds 24 --days 4500`_
