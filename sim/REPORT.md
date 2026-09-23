# Be Unicorn — Denge Simülasyonu Raporu

8 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.9 dk · g147 (8/8) | 9.0 dk · g270 (8/8) | 12.4 dk · g372 (8/8) | 16.2 dk · g486 (8/8) | 21.2 dk · g637 (8/8) | 23.5 dk · g706 (8/8) |
| vcRocket | 4.3 dk · g128 (8/8) | 7.3 dk · g218 (8/8) | 13.5 dk · g404 (7/8) | 15.9 dk · g476 (7/8) | 18.5 dk · g555 (7/8) | 19.0 dk · g570 (6/8) |
| niche | 6.7 dk · g200 (8/8) | 10.8 dk · g324 (7/8) | 13.8 dk · g414 (7/8) | 15.9 dk · g476 (7/8) | 19.5 dk · g584 (7/8) | 20.7 dk · g620 (7/8) |
| platform | 4.6 dk · g138 (8/8) | 8.2 dk · g247 (8/8) | 13.6 dk · g408 (5/8) | 16.8 dk · g503 (5/8) | 19.8 dk · g594 (5/8) | 21.8 dk · g654 (5/8) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 8 | 8 / 7 | 10 / 9 | %41 | 32 |
| vcRocket | 0% | unicorn 6, timeout 2 | 8 / 8 | 11.5 / 11 | %41 | 36 |
| niche | 0% | unicorn 7, timeout 1 | 5 / 5 | 9 / 9 | %45 | 30 |
| platform | 0% | timeout 3, unicorn 5 | 8 / 5 | 11 / 9 | %42 | 36 |

Toplam iflas oranı: **0%** (0/32).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 8/8 | 102.0 dk · g3060 | 0 | 0 |
| random (rastgele aksiyon) | 3/8 | 23.5 dk · g704 | 0 | 4 |

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 23.5 / 19.0 / 20.7 / 21.8 dk → **hedefin 41 dk altında (en hızlı)**; arketip farkı 1.24× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı

_Süre: 72.2 sn · `npm run sim -- --seeds 8 --days 4500`_
