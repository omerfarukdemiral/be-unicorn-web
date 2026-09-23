# Be Unicorn — Denge Simülasyonu Raporu

8 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.4 dk · g133 (8/8) | 8.4 dk · g254 (8/8) | 15.5 dk · g465 (8/8) | 27.3 dk · g820 (8/8) | 44.6 dk · g1340 (8/8) | 79.5 dk · g2386 (8/8) |
| vcRocket | 3.8 dk · g114 (8/8) | 7.8 dk · g234 (8/8) | 19.8 dk · g595 (8/8) | 29.6 dk · g888 (8/8) | 44.4 dk · g1331 (8/8) | 63.0 dk · g1892 (8/8) |
| niche | 4.1 dk · g124 (8/8) | 8.4 dk · g251 (8/8) | 13.7 dk · g411 (8/8) | 26.1 dk · g782 (8/8) | 44.2 dk · g1325 (8/8) | 71.0 dk · g2130 (8/8) |
| platform | 4.3 dk · g129 (8/8) | 8.2 dk · g245 (8/8) | 17.1 dk · g513 (8/8) | 29.1 dk · g872 (8/8) | 46.6 dk · g1397 (8/8) | 69.8 dk · g2095 (8/8) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 8 | 8 / 8 | 9.5 / 9 | %47 | 36 |
| vcRocket | 0% | unicorn 8 | 8 / 8 | 11 / 11 | %35 | 36 |
| niche | 0% | unicorn 8 | 8 / 8 | 10 / 8 | %48 | 36 |
| platform | 0% | unicorn 8 | 8 / 8 | 11 / 8 | %47 | 36 |

Toplam iflas oranı: **0%** (0/32).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 8/8 | 12.0 dk · g360 | 0 | 0 |
| random (rastgele aksiyon) | 8/8 | 15.0 dk · g450 | 0 | 4 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:salesCall 234.5 | 32 | 14 sn / 14 sn | 0.56× |
| vcRocket | upgradeItem 72 | 28.5 | 14 sn / 14 sn | 0.88× |
| niche | founderAction:salesCall 203.5 | 32 | 14 sn / 14 sn | 0.55× |
| platform | upgradeItem 72 | 31 | 14 sn / 14 sn | 0.62× |

- findUsers hiçbir arketipte en sık aksiyon değil: **EVET**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **EVET**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 8.0 sn / 24.0 sn | 4.0 sn / 12.0 sn | 1 | 0 |
| vcRocket | 2.0 sn | 8.0 sn / 24.0 sn | 4.0 sn / 24.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 24.0 sn | 4.0 sn / 12.0 sn | 1 | 0 |
| platform | 2.0 sn | 6.0 sn / 24.0 sn | 5.5 sn / 24.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/32) | — | 1 |
| dikkatsiz (random) | 100% (8/8) | 15.0 dk · g450 | 4 |
| idle | 100% (8/8) | 12.0 dk · g360 | 1 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 79.5 dk | 8/8 | 0% | %47 |
| worst | 68.9 dk | 8/8 | 0% | %37 |
| first | 64.4 dk | 8/8 | 0% | %33 |

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 79.5 / 63.0 / 71.0 / 69.8 dk → **hedef aralıkta**; arketip farkı 1.26× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas: iyi botlar 0% (hedef ≤ %3) · dikkatsiz 100% · idle 100% (sonunda batmalı, 4 dk’dan önce değil: 4 dk’dan önce batan 0) · iyi + dikkatsiz toplamı 20% (hedef %5–20): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %23 (hedef ≥ %15): **EVET** · kurucu hissesi farkı 15 puan

_Süre: 351.1 sn · `npm run sim -- --seeds 8 --days 4500`_
