# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g142 (24/24) | 7.0 dk · g211 (24/24) | 15.7 dk · g471 (24/24) | 27.4 dk · g821 (24/24) | 42.9 dk · g1287 (24/24) | 61.5 dk · g1845 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.3 dk · g218 (24/24) | 13.1 dk · g393 (24/24) | 23.4 dk · g701 (24/24) | 39.0 dk · g1171 (24/24) | 85.4 dk · g2563 (23/24) |
| niche | 4.6 dk · g137 (24/24) | 6.5 dk · g196 (24/24) | 15.1 dk · g452 (24/24) | 23.8 dk · g713 (24/24) | 41.4 dk · g1242 (24/24) | 54.7 dk · g1641 (24/24) |
| platform | 4.4 dk · g133 (24/24) | 7.5 dk · g227 (24/24) | 15.7 dk · g470 (24/24) | 24.6 dk · g738 (24/24) | 39.4 dk · g1183 (24/24) | 65.0 dk · g1950 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 23, timeout 1 | 7 / 6 | 10 / 7 | %39 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 8 | %50 | 36 |
| platform | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %49 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 43.0 dk · g1290 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 6.0 dk · g180 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:talkToUsers 227 | 223 | 14 sn / 14 sn | 0.24× |
| vcRocket | founderAction:talkToUsers 541 | 539 | 14 sn / 39 sn | 0.31× |
| niche | founderAction:findUsers 184.5 | 184.5 | 14 sn / 42 sn | 0.30× |
| platform | founderAction:talkToUsers 286 | 269 | 14 sn / 40 sn | 0.24× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (42 sn)**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 14.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 16.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| platform | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 7.5 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/96) | — | 0 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/24) | — | 1 |
| kaos (random) | 100% (24/24) | 6.0 dk · g180 | 3 |
| idle | 100% (24/24) | 43.0 dk · g1290 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 61.5 dk | 24/24 | 0% | %50 |
| worst | 59.8 dk | 21/24 | 0% | %42 |
| first | 60.0 dk | 24/24 | 0% | %42 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 69.0 dk · %61 · 24/24 | 61.5 dk · %50 · 24/24 | 61.0 dk · %40 · 24/24 | %13 | — |
| vcRocket | 97.6 dk · %59 · 20/24 · iflas 2 | 98.8 dk · %48 · 23/24 | 85.4 dk · %39 · 23/24 | %16 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 61.7 dk · %50 | 61.5 dk · %50 | hayır |
| platform | 65.1 dk · %49 | 65.0 dk · %49 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 17% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 39% · tablo tavanı 0% · tablo tabanı 61%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 417 | 0.8 | 2.0 | 0% | 0.0 | 1.0 |
| Pre-seed | 229 | 5.1 | 30.6 | 15% | 3.5 | 5.5 |
| Seed | 753 | 21.8 | 99.0 | 49% | 4.7 | 6.3 |
| Series A | 967 | 7.7 | 99.0 | 32% | 4.6 | 5.9 |
| Series B | 1491 | 8.9 | 99.0 | 36% | 3.6 | 10.8 |
| Series C | 2677 | 16.1 | 99.0 | 40% | 6.1 | 25.3 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 94 | 0 | 17% | 0.0 |
| Seed | 96 | 0 | 14% | 3.3 |
| Series A | 96 | 0 | 11% | 3.9 |
| Series B | 96 | 0 | 11% | 4.2 |
| Series C | 96 | 0 | 13% | 3.1 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 3.5 | 21.5 | 23 | 26 | 41 |
| vcRocket | 8 | 4 | 16 | 27.5 | 43.5 | 144.5 |
| niche | 8 | 3 | 9.5 | 11 | 18 | 14.5 |
| platform | 7 | 3.5 | 33.5 | 33 | 49 | 104 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 35% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 8 | 12 | paywall 24 | paywall 48, onboarding 48, analytics 48 | 73% (361 hafta) | 1 |
| vcRocket | 24/24 | 8 | 22 | referral 24 | referral 48, analytics 48, freemium 48 | 57% (329 hafta) | 1 |
| niche | 24/24 | 4 | 5 | feedback 24 | feedback 24, onboarding 24, openApi 24 | 59% (372 hafta) | 0 |
| platform | 24/24 | 12 | 22 | feedback 24 | feedback 72, referral 72, onboarding 72 | 67% (398 hafta) | 1 |
| careless | 24/24 | 6 | 39 | paywall 24 | paywall 48, onboarding 48, analytics 48 | 95% (230 hafta) | 453 |
| coasterModules | 24/24 | 2 | 4 | paywall 24 | paywall 24, onboarding 24 | 62% (95 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 71.8 dk · 0 iflas | 24/24 · 54.7 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 89.0 dk · 0 iflas | 24/24 · 61.5 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 64.3 dk · 0 iflas | 23/24 · 85.4 dk · 0 iflas |
| ek kategori | platform | 23/24 · 83.2 dk · 0 iflas | 24/24 · 65.0 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 2

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 3 / 5 | 26% | 10% | 50 | 0 | 808 | 67 | 7.0 dk / 7.1 dk · 15.7 dk / 16.4 dk · 27.4 dk / 27.6 dk · 61.5 dk / 63.0 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 9% | 21% | 59 | 24 | 3215 | 56 | 7.3 dk / 7.4 dk · 13.1 dk / 13.5 dk · 23.4 dk / 22.9 dk · 85.4 dk / 92.3 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 35% | 4% | 24 | 0 | 206 | 69 | 6.5 dk / 6.5 dk · 15.1 dk / 15.1 dk · 23.8 dk / 23.5 dk · 54.7 dk / 54.5 dk |
| platform | 0 / 0 / 0 | 0 | 4 / 5 | 18% | 12% | 80 | 0 | 1108 | 62 | 7.5 dk / 7.5 dk · 15.7 dk / 16.8 dk · 24.6 dk / 28.4 dk · 65.0 dk / 85.7 dk |
| careless | 0 / 0 / 5 | 0 | 3 / 5 | 31% | 4% | 0 | 0 | 586 | 61 | 6.4 dk · 15.1 dk · 107.6 dk · — |
| greedyGood | 0 / 0 / 0 | 0 | 4 / 5 | 17% | 13% | 80 | 48 | 1012 | 63 | 6.0 dk · 10.6 dk · 19.7 dk · 56.8 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 5 (hedef ≥ 2) · Seed morali medyan 61 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 230.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 22/24 | 63% | 60% | 13% |
| coasterModules | 0/24 | — | 23/24 | 60% | 82% | 16% |
| idleAfterProfit | 0/24 | — | 1/24 | 92% | 44% | 3% |
| greedyGood | 24/24 | 56.8 dk | 0/24 | 12% | 0% | 8% |
| burner | 24/24 | 58.3 dk | 0/24 | 26% | 0% | 8% |
| frugal | 24/24 | 69.8 dk | 0/24 | 69% | 0% | 7% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 5% | 0% | 63% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 71.6 KB · maks 104.7 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 61.5 / 85.4 / 54.7 / 65.0 dk → **hedefin 5 dk altında (en hızlı)**; arketip farkı 1.56× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 49% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %3 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 9 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 44% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 63.7 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 63.7 dk (%135): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 58.3 dk ↔ 69.8 dk (%16): **EVET**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 28% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 94/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 28% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.7 (3–6) · Series A 4.6 (4–8) · Series B 3.6 (5–9) · Series C 6.1 (6–10): **HAYIR** (3/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 8% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 36% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 3.1 (hedef 20–40) · hız çarpanı 0.94 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3.5 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 11% / 11%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 54/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 61.5 / 85.4 / 54.7 / 65.0 dk · 1.56×: **HAYIR**
- Kayıt boyutu medyan 71.6 KB (hedef < 70) · maks 104.7 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3206 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 87/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.7 ↔ hazırlanmayan 5.1 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 458/458
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1099 kriz): 3% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 36.9 ↔ kriz içeriği olmadan aynı seed'ler 31.0 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 17.9 ↔ 17.0 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (95/96 ulaştı): 63.8 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 59.7 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 6/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 2 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.05
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 282/1398 (hedef %30–50 → 420–699/1398): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 1.9 (hedef 4–10) · yenilenen 98% (hedef ≥ %60): **HAYIR** · koşu başına 0–9 · satıcılar (bootstrap + niche, 48 koşu) 3.9
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 1/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 21/501 (hedef %10–20 → 51–100/501): **HAYIR** · down round 20 · kredi çağrısı 0
- Bilgi: careless: kredi 20/24 · çağrı 0 · düşen tur 5 · down round 4 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 3 · down round 3 · iplik adımı / koşu (iyi, medyan) 10
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 15/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 1/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 15/15 (hedef ≥ %60 → 9–15/15): **EVET** · n = 15
- Bilgi (maaş masası): iyi botlar masa 114 · erteleme 114 · careless masa 22 · erteleme 22 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.5 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 70 (hedef ≤ 80): **EVET** · medyan 22.5 · 80'i aşan 0/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 81% (hedef ≥ %70): **EVET** · Pre-seed → C 84% / 80% / 79% / 79% / 81%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 7 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 96 · founder-no-pay 89 · lean-office 96 · deferred-pay 31 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı salary-freeze, lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 18/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 7 · team-mutiny 0 · rival-dies 2 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 1113.5 sn · `npm run sim -- --seeds 24 --days 4500`_
