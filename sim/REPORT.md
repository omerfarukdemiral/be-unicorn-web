# Be Unicorn — Denge Simülasyonu Raporu

8 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 6.8 dk · g206 (8/8) | 13.4 dk · g404 (8/8) | 17.4 dk · g521 (8/8) | 22.2 dk · g665 (8/8) | 34.3 dk · g1029 (8/8) | 71.5 dk · g2146 (8/8) |
| vcRocket | 4.2 dk · g126 (8/8) | 8.9 dk · g268 (8/8) | 15.7 dk · g470 (8/8) | 19.4 dk · g581 (8/8) | 23.9 dk · g716 (8/8) | 26.7 dk · g801 (8/8) |
| niche | 8.1 dk · g242 (8/8) | 14.5 dk · g434 (8/8) | 16.9 dk · g509 (8/8) | 19.4 dk · g581 (8/8) | 24.6 dk · g740 (8/8) | 27.1 dk · g812 (8/8) |
| platform | 4.4 dk · g133 (8/8) | 10.0 dk · g300 (8/8) | 16.4 dk · g491 (8/8) | 20.6 dk · g620 (8/8) | 27.0 dk · g810 (8/8) | 30.4 dk · g914 (8/8) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 8 | 5 / 5 | 7 / 7 | %42 | 32 |
| vcRocket | 0% | unicorn 8 | 6 / 6 | 10.5 / 7 | %41 | 36 |
| niche | 0% | unicorn 8 | 5 / 5 | 7 / 6 | %42 | 30 |
| platform | 0% | unicorn 8 | 6 / 5 | 10 / 7 | %42 | 36 |

Toplam iflas oranı: **0%** (0/32).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 8/8 | 102.0 dk · g3060 | 0 | 0 |
| random (rastgele aksiyon) | 0/8 | — | 0 | 5 |

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 71.5 / 26.7 / 27.1 / 30.4 dk → **hedefin 33 dk altında (en hızlı)**; arketip farkı 2.68× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı

_Süre: 115.6 sn · `npm run sim -- --seeds 8 --days 4500`_
