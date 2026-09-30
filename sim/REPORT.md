# Be Unicorn — Denge Simülasyonu Raporu

12 seed × 4 arketip, en fazla 3000 oyun günü (100 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.4 dk · g132 (12/12) | 8.2 dk · g246 (12/12) | 14.6 dk · g438 (12/12) | 26.6 dk · g798 (12/12) | 43.3 dk · g1300 (12/12) | 73.1 dk · g2193 (12/12) |
| vcRocket | 4.0 dk · g121 (12/12) | 7.3 dk · g219 (12/12) | 18.2 dk · g546 (12/12) | 27.0 dk · g810 (12/12) | 41.5 dk · g1245 (12/12) | 60.4 dk · g1811 (12/12) |
| niche | 4.2 dk · g126 (12/12) | 7.8 dk · g236 (12/12) | 13.9 dk · g418 (12/12) | 25.1 dk · g752 (12/12) | 42.0 dk · g1259 (12/12) | 82.5 dk · g2476 (12/12) |
| platform | 4.2 dk · g125 (12/12) | 8.3 dk · g248 (12/12) | 16.4 dk · g491 (12/12) | 28.5 dk · g855 (12/12) | 45.4 dk · g1363 (12/12) | 66.9 dk · g2006 (12/12) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 12 | 7 / 7 | 8 / 8 | %53 | 36 |
| vcRocket | 0% | unicorn 12 | 7 / 7 | 10 / 9 | %40 | 36 |
| niche | 0% | unicorn 12 | 7 / 7 | 9 / 7 | %53 | 36 |
| platform | 0% | unicorn 12 | 7 / 7 | 10 / 7 | %52 | 36 |

Toplam iflas oranı: **0%** (0/48).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 0/12 | — | 0 | 7 |
| random (rastgele aksiyon) | 0/12 | — | 0 | 7 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:salesCall 196 | 31.5 | 14 sn / 14 sn | 0.60× |
| vcRocket | upgradeItem 72 | 28.5 | 14 sn / 14 sn | 0.80× |
| niche | founderAction:salesCall 227.5 | 29 | 14 sn / 14 sn | 0.60× |
| platform | upgradeItem 72 | 32 | 14 sn / 14 sn | 0.60× |

- findUsers hiçbir arketipte en sık aksiyon değil: **EVET**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **EVET**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 24.0 sn | 4.0 sn / 12.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.0 sn / 24.0 sn | 4.0 sn / 18.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 24.0 sn | 4.0 sn / 12.0 sn | 0 | 0 |
| platform | 2.0 sn | 6.0 sn / 23.0 sn | 4.0 sn / 19.5 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/48) | — | 1 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/12) | — | 1 |
| kaos (random) | 0% (0/12) | — | 0 |
| idle | 0% (0/12) | — | 0 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 73.1 dk | 12/12 | 0% | %53 |
| worst | 73.1 dk | 12/12 | 0% | %53 |
| first | 73.1 dk | 12/12 | 0% | %53 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (12 ay) | Hedef (18 ay) | Büyük (24 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 73.1 dk · %53 · 12/12 | 73.1 dk · %53 · 12/12 | 73.1 dk · %53 · 12/12 | %0 | small |
| vcRocket | 60.4 dk · %40 · 12/12 | 60.4 dk · %40 · 12/12 | 60.4 dk · %40 · 12/12 | %0 | small |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 73.1 dk · %53 | 73.1 dk · %53 | hayır |
| platform | 66.9 dk · %52 | 66.9 dk · %52 | hayır |

Tur kapanışları (iyi botlar, 240 tur): metrik kısmı tavanda 72% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 8% · tablo tavanı 18% · tablo tabanı 75%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı |
|---|---|---|---|---|
| Garaj | 179 | 1.0 | 2.0 | 0% |
| Pre-seed | 183 | 10.7 | 24.7 | 11% |
| Seed | 377 | 99.0 | 99.0 | 99% |
| Series A | 513 | 99.0 | 99.0 | 100% |
| Series B | 781 | 99.0 | 99.0 | 100% |
| Series C | 1364 | 99.0 | 99.0 | 100% |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 5 | 9 | 15 | 20 | 43.5 |
| vcRocket | 7 | 4 | 21.5 | 15 | 23.5 | 31.5 |
| niche | 7 | 5.5 | 9 | 14.5 | 21.5 | 57 |
| platform | 7 | 5 | 21 | 19 | 28 | 34 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 24%, en kötü 38% (hedef ≤ %35).

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/12 | — | 0/12 | 91% | 61% | 4% |
| idleAfterProfit | 0/12 | — | 0/12 | 91% | 59% | 4% |
| greedyGood | 12/12 | 54.9 dk | 0/12 | 54% | 0% | 7% |
| burner | 12/12 | 38.7 dk | 0/12 | 65% | 0% | 9% |
| frugal | 0/12 | — | 0/12 | 91% | 14% | 4% |
| burner (dikkatsiz) | 12/12 | 38.7 dk | 0/12 | 65% | 0% | 9% |

Kayıt boyutu (koşu sonu, 132 koşu): medyan 58.3 KB · maks 76.7 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 73.1 / 60.4 / 82.5 / 66.9 dk → **hedef aralıkta**; arketip farkı 1.37× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı): iyi botlar 0% (hedef ≤ %3): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %10–25): **HAYIR** · idle 0% ve kaos (random) 0%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 1 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **HAYIR** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 100% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %0 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 0 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/48 (hedef ≤ %5 → 0–2/48): **EVET**
- Careless iflas: 0/12 (hedef %40–60 → 5–7/12): **HAYIR**
- greedyGood iflas: 0/12 (hedef %15–30 → 2–3/12): **HAYIR**
- coaster Unicorn: 0/12 (hedef ≤ %0 → 0–0/12): **EVET** (bilgi; B2 ara, nihai hedef E1)
- idleAfterProfit Unicorn: 0/12 (hedef ≤ %0 → 0–0/12) · tepe sonrası düşüş medyanı 59% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 68.0 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 100 dk): 100.0 dk ↔ 68.0 dk (%47): **EVET**
- Dikkatsiz burner iflas: 0/12 (hedef ≥ %40 → 5–12/12): **HAYIR**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 100 dk): 38.7 dk ↔ 100.0 dk (%61): **EVET**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 84% (hedef ≤ %35): **HAYIR** · B’den önce kâra geçen koşu 48/48 (bilgi)
- Kayıt boyutu medyan 58.3 KB (hedef < 70) · maks 76.7 KB (hedef < 120): **EVET**

_Süre: 464.8 sn · `npm run sim -- --seeds 12 --days 3000`_
