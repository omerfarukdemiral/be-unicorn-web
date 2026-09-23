# Be Unicorn — Denge Simülasyonu Raporu

8 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.3 dk · g128 (8/8) | 7.9 dk · g238 (8/8) | 13.9 dk · g419 (8/8) | 24.6 dk · g739 (8/8) | 41.0 dk · g1229 (8/8) | 67.2 dk · g2015 (8/8) |
| vcRocket | 4.2 dk · g127 (8/8) | 7.0 dk · g211 (8/8) | 16.5 dk · g496 (8/8) | 25.3 dk · g758 (8/8) | 38.9 dk · g1167 (8/8) | 59.9 dk · g1796 (8/8) |
| niche | 4.4 dk · g131 (8/8) | 7.0 dk · g210 (8/8) | 12.6 dk · g379 (8/8) | 22.9 dk · g686 (8/8) | 40.6 dk · g1218 (8/8) | 76.0 dk · g2281 (8/8) |
| platform | 4.2 dk · g125 (8/8) | 7.3 dk · g218 (8/8) | 16.0 dk · g481 (8/8) | 27.4 dk · g822 (8/8) | 42.1 dk · g1265 (8/8) | 66.1 dk · g1982 (8/8) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 8 | 7 / 6 | 8.5 / 8 | %53 | 36 |
| vcRocket | 0% | unicorn 8 | 7 / 7 | 9.5 / 9 | %40 | 36 |
| niche | 0% | unicorn 8 | 7 / 7 | 9 / 8 | %53 | 36 |
| platform | 0% | unicorn 8 | 7 / 7 | 10 / 8 | %52 | 36 |

Toplam iflas oranı: **0%** (0/32).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 8/8 | 28.0 dk · g840 | 0 | 0 |
| random (rastgele aksiyon) | 7/8 | 25.0 dk · g750 | 0 | 3 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:salesCall 179 | 31 | 14 sn / 14 sn | 0.60× |
| vcRocket | upgradeItem 72 | 26 | 14 sn / 14 sn | 0.80× |
| niche | founderAction:salesCall 208 | 27 | 14 sn / 14 sn | 0.60× |
| platform | upgradeItem 72 | 28.5 | 14 sn / 14 sn | 0.60× |

- findUsers hiçbir arketipte en sık aksiyon değil: **EVET**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **EVET**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 24.0 sn | 4.0 sn / 12.0 sn | 0.5 | 0 |
| vcRocket | 2.0 sn | 6.5 sn / 24.0 sn | 4.0 sn / 18.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 24.0 sn | 4.0 sn / 12.0 sn | 0.5 | 0 |
| platform | 2.0 sn | 6.0 sn / 22.0 sn | 4.0 sn / 17.5 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/32) | — | 1 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/8) | — | 1 |
| kaos (random) | 88% (7/8) | 25.0 dk · g750 | 4 |
| idle | 100% (8/8) | 28.0 dk · g840 | 4 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 67.2 dk | 8/8 | 0% | %53 |
| worst | 66.5 dk | 8/8 | 0% | %40 |
| first | 62.7 dk | 8/8 | 0% | %41 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (12 ay) | Hedef (18 ay) | Büyük (24 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 71.9 dk · %64 · 8/8 | 67.2 dk · %53 · 8/8 | 64.0 dk · %41 · 8/8 | %12 | — |
| vcRocket | 60.9 dk · %62 · 8/8 | 60.3 dk · %51 · 8/8 | 59.9 dk · %40 · 8/8 | %2 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 61.5 dk · %52 | 67.2 dk · %53 | hayır |
| platform | 61.6 dk · %52 | 66.1 dk · %52 | hayır |

Tur kapanışları (iyi botlar, 160 tur): metrik kısmı tavanda 68% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 7% · tablo tavanı 18% · tablo tabanı 76%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı |
|---|---|---|---|---|
| Garaj | 124 | 0.9 | 2.0 | 0% |
| Pre-seed | 105 | 11.4 | 21.1 | 8% |
| Seed | 241 | 99.0 | 99.0 | 99% |
| Series A | 320 | 99.0 | 99.0 | 100% |
| Series B | 525 | 99.0 | 99.0 | 100% |
| Series C | 821 | 99.0 | 99.0 | 100% |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 5 | 9 | 15 | 21 | 39 |
| vcRocket | 7 | 4 | 19 | 14 | 24 | 32.5 |
| niche | 7.5 | 4 | 7 | 15 | 22 | 52 |
| platform | 7 | 4.5 | 21 | 17.5 | 28 | 35 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 23%, en kötü 35% (hedef ≤ %35).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 67.2 / 59.9 / 76.0 / 66.1 dk → **hedefin 0 dk altında (en hızlı)**; arketip farkı 1.27× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı): iyi botlar 0% (hedef ≤ %3): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %10–25): **HAYIR** · idle 100% ve kaos (random) 88%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 1 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 100% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %7 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 12 puan

_Süre: 414.0 sn · `npm run sim -- --seeds 8 --days 4500`_
