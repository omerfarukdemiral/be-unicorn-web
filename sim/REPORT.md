# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g142 (24/24) | 7.2 dk · g215 (24/24) | 15.9 dk · g477 (24/24) | 28.8 dk · g863 (24/24) | 45.0 dk · g1350 (24/24) | 79.8 dk · g2393 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.1 dk · g213 (24/24) | 13.1 dk · g393 (24/24) | 21.2 dk · g635 (24/24) | 35.0 dk · g1050 (24/24) | 59.2 dk · g1777 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.5 dk · g195 (24/24) | 15.1 dk · g453 (24/24) | 23.1 dk · g694 (24/24) | 40.1 dk · g1203 (24/24) | 61.1 dk · g1833 (24/24) |
| platform | 4.5 dk · g135 (24/24) | 7.4 dk · g223 (24/24) | 15.1 dk · g452 (24/24) | 25.5 dk · g766 (24/24) | 43.3 dk · g1298 (24/24) | 73.3 dk · g2201 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %39 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 9 | %51 | 36 |
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
| bootstrap | founderAction:talkToUsers 295.5 | 294 | 14 sn / 44 sn | 0.23× |
| vcRocket | founderAction:talkToUsers 321.5 | 319.5 | 14 sn / 40 sn | 0.31× |
| niche | founderAction:findUsers 221 | 221 | 14 sn / 33 sn | 0.30× |
| platform | founderAction:talkToUsers 309.5 | 294.5 | 14 sn / 40 sn | 0.24× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (44 sn)**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.0 sn / 14.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| vcRocket | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 6.0 sn | 1 | 0 |
| niche | 2.0 sn | 6.0 sn / 16.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| platform | 2.0 sn | 6.0 sn / 24.0 sn | 2.0 sn / 7.0 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/96) | — | 0 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/24) | — | 1 |
| kaos (random) | 100% (24/24) | 6.0 dk · g180 | 3 |
| idle | 100% (24/24) | 43.0 dk · g1290 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 79.8 dk | 24/24 | 0% | %50 |
| worst | 76.2 dk | 16/24 | 0% | %41 |
| first | 76.6 dk | 24/24 | 0% | %41 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 91.3 dk · %61 · 24/24 | 79.8 dk · %50 · 24/24 | 73.8 dk · %39 · 24/24 | %24 | — |
| vcRocket | 74.7 dk · %59 · 23/24 · iflas 1 | 63.9 dk · %48 · 24/24 | 59.2 dk · %39 · 24/24 | %26 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 79.9 dk · %50 | 79.8 dk · %50 | hayır |
| platform | 73.4 dk · %49 | 73.3 dk · %49 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 16% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 35% · tablo tavanı 0% · tablo tabanı 65%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 414 | 0.8 | 2.0 | 0% | 0.0 | 1.0 |
| Pre-seed | 219 | 5.5 | 38.5 | 20% | 3.7 | 5.8 |
| Seed | 745 | 43.5 | 99.0 | 53% | 4.5 | 6.1 |
| Series A | 978 | 8.5 | 99.0 | 41% | 3.9 | 5.8 |
| Series B | 1515 | 9.3 | 99.0 | 41% | 3.5 | 8.0 |
| Series C | 2658 | 18.7 | 99.0 | 45% | 6.0 | 12.0 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 95 | 0 | 17% | 0.0 |
| Seed | 96 | 0 | 14% | 3.9 |
| Series A | 96 | 0 | 10% | 3.0 |
| Series B | 96 | 0 | 10% | 4.0 |
| Series C | 96 | 0 | 14% | 3.5 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 4 | 27 | 21 | 31.5 | 87 |
| vcRocket | 8 | 4 | 20.5 | 21 | 34 | 75.5 |
| niche | 8 | 3 | 13 | 12 | 19 | 31 |
| platform | 7 | 3.5 | 38 | 28.5 | 51 | 137.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 27% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 30 | 38 | paywall 22, teamPlans 2 | feedback 48, openApi 48, onboarding 47 | 65% (370 hafta) | 1 |
| vcRocket | 24/24 | 30 | 25.5 | paywall 13, aso 8, referral 2, inAppPurchase 1 | referral 48, feedback 48, security 48 | 57% (339 hafta) | 1 |
| niche | 24/24 | 15 | 15 | paywall 12, usagePricing 12 | sdks 24, rateLimit 24, docs 24 | 63% (367 hafta) | 0 |
| platform | 24/24 | 46.5 | 51 | paywall 18, promotedListings 2, referral 2, reviews 2 | feedback 72, security 72, openApi 72 | 65% (388 hafta) | 1 |
| careless | 24/24 | 31 | 115.5 | paywall 22, teamPlans 2 | feedback 48, openApi 46, security 39 | 98% (177 hafta) | 456.5 |
| coasterModules | 24/24 | 13 | 11.5 | paywall 22, teamPlans 2 | paywall 24, teamPlans 24, templates 24 | 79% (96 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 73.0 dk · 0 iflas | 24/24 · 61.1 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 86.0 dk · 0 iflas | 24/24 · 79.8 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 64.1 dk · 0 iflas | 24/24 · 59.2 dk · 0 iflas |
| ek kategori | platform | 24/24 · 77.9 dk · 0 iflas | 24/24 · 73.3 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 13

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = (ağırlık × $karşılık − kira) / maliyet, $karşılık arayüzdeki `moduleEstimate`. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 15 | 15 | 735 / 744 | 584 / 154 | 232 · 188 · 203 · 46 · 66 |
| vcRocket | 5 / 6 | 15 | 15 | 736 / 753 | 545 / 193 | 255 · 201 · 202 · 55 · 23 |
| niche | 5 / 6 | 15 | 15 | 361 / 363 | 290 / 72 | 122 · 92 · 97 · 26 · 24 |
| platform | 5 / 6 | 15 | 15 | 1111 / 1122 | 841 / 271 | 348 · 311 · 293 · 69 · 90 |
| careless | 5 / 9 | 15 | 15 | 751 / 804 | 482 / 271 | 209 · 243 · 205 · 70 · 24 |
| coasterModules | 5 / 5 | 13 | 15 | 323 / 336 | 254 / 69 | 89 · 77 · 103 · 31 · 23 |

Baskınlık: bir kategorinin koşularının > %90’ında planın kendi seçtiği (doldurucu değil) kurulu modül, T1 çekirdek hariç; yalnızca gerçek seçim olan katmanlarda (projeler katmanın %80’inden azını kuruyorsa) sayılır, bir katmanı tümden kuran herkes tek modülü üstün kılmaz. Plan skoru sıfırın altındaysa bot boş slotu gün ve projeye bağlı bir karma ile doldurur (rastgele ama tekrarlanabilir); “Plan seçimi / doldurucu” sütunu hangisinin kaç modül kurduğunu gösterir.

Baskın modül (hedef: yok): **HAYIR** · web/teamPlans 100%, web/templates 100%, web/pwa 100%, api/sdks 100%, api/webhooks 100%, mobile/deepLinks 100%, mobile/inAppPurchase 100%, mobile/offlineMode 100%, mobile/watchApp 100%, ai/security 100%, ai/guardrails 100%, ai/openApi 100%, ai/fineTune 92%, ai/abTest 92%, marketplace/promotedListings 100%, marketplace/search 100%, marketplace/sellerDashboard 100%, marketplace/security 100%, marketplace/openApi 100%, marketplace/recommendations 96%, marketplace/sso 92%, marketplace/buyerProtection 100%

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 79.8 dk | 0 |
| büyüme (vcRocket) | 24/24 | 79.6 dk | 0 |
| tutundurma (niche) | 24/24 | 81.2 dk | 0 |
| erişim (platform) | 24/24 | 81.0 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.02× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 15/24 | 93.4 dk | 0 | 8/24 · 125.6 dk | paywall 24, teamPlans 24, templates 24, feedback 24, seo 24 |
| mobile | 24/24 | 72.9 dk | 0 | 23/24 · 76.8 dk | paywall 24, aso 24, inAppPurchase 24, referral 24, deepLinks 24 |
| api | 24/24 | 73.9 dk | 0 | 24/24 · 86.1 dk | rateLimit 24, docs 24, sdks 24, feedback 24, usageDashboard 24 |
| marketplace | 24/24 | 71.1 dk | 0 | 24/24 · 77.7 dk | paywall 24, promotedListings 24, reviews 24, search 24, referral 24 |
| ai | 24/24 | 58.6 dk | 0 | 24/24 · 68.0 dk | feedback 24, evals 24, modelRouter 24, security 24, openApi 24 |
| game | 17/24 | 83.0 dk | 0 | 9/24 · 120.3 dk | paywall 24, shop 24, leaderboard 24, referral 24, feedback 24 |

Kapsam: 65/65 modül en az bir koşuda kuruldu.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 4 / 5 | 21% | 11% | 53 | 0 | 1297 | 67 | 7.2 dk / 7.0 dk · 15.9 dk / 16.4 dk · 28.8 dk / 27.8 dk · 79.8 dk / 81.4 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 15% | 12% | 58 | 24 | 932 | 56 | 7.1 dk / 7.1 dk · 13.1 dk / 13.8 dk · 21.2 dk / 20.6 dk · 59.2 dk / 60.7 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 30% | 9% | 24 | 0 | 733 | 67 | 6.5 dk / 6.5 dk · 15.1 dk / 15.3 dk · 23.1 dk / 24.6 dk · 61.1 dk / 65.1 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 15% | 12% | 75 | 0 | 1257 | 61 | 7.4 dk / 7.4 dk · 15.1 dk / 15.2 dk · 25.5 dk / 26.7 dk · 73.3 dk / 90.0 dk |
| careless | 0 / 0 / 4.5 | 97 | 3 / 5 | 32% | 2% | 0 | 0 | 300 | 63 | 6.6 dk · 14.7 dk · — · — |
| greedyGood | 0 / 0 / 0 | 0 | 4 / 5 | 17% | 12% | 76 | 48 | 1193 | 64 | 6.0 dk · 10.6 dk · 19.4 dk · 61.1 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 4.5 (hedef ≥ 2) · Seed morali medyan 63 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 230.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 23/24 | 59% | 69% | 15% |
| coasterModules | 0/24 | — | 24/24 | 61% | 82% | 15% |
| idleAfterProfit | 0/24 | — | 1/24 | 92% | 75% | 3% |
| greedyGood | 24/24 | 61.1 dk | 0/24 | 19% | 0% | 8% |
| burner | 24/24 | 75.6 dk | 0/24 | 34% | 0% | 7% |
| frugal | 24/24 | 85.4 dk | 0/24 | 77% | 0% | 5% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 6% | 0% | 61% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 82.0 KB · maks 110.2 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 55–90 dk: medyanlar 79.8 / 59.2 / 61.1 / 73.3 dk → **hedef aralıkta**; arketip farkı 1.35× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 53% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %5 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 9 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 75% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 67.8 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 67.8 dk (%121): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 75.6 dk ↔ 85.4 dk (%11): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 34% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 93/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 40% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.5 (3–6) · Series A 3.9 (4–8) · Series B 3.5 (5–9) · Series C 6.0 (6–10): **HAYIR** (1/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 41% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 3.5 (hedef 20–40) · hız çarpanı 0.93 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 85/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–90 dk ve fark ≤ 1.6×: 79.8 / 59.2 / 61.1 / 73.3 dk · 1.35×: **EVET**
- Kayıt boyutu medyan 82.0 KB (hedef < 70) · maks 110.2 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3203 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.3 ↔ hazırlanmayan 5.7 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 415/415
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1092 kriz): 3% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 36.5 ↔ kriz içeriği olmadan aynı seed'ler 30.6 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 17.8 ↔ 16.1 · kriz / koşu medyanı 9
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 67.8 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 62.6 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 2/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 2 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.08
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 214/1398 (hedef %30–50 → 420–699/1398): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 3.7 (hedef 4–10) · yenilenen 98% (hedef ≥ %60): **HAYIR** · koşu başına 0–13 · satıcılar (bootstrap + niche, 48 koşu) 7.4
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 1/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 24/504 (hedef %10–20 → 51–100/504): **HAYIR** · down round 22 · kredi çağrısı 0
- Bilgi: careless: kredi 11/24 · çağrı 0 · düşen tur 4 · down round 3 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 8 · down round 7 · iplik adımı / koşu (iyi, medyan) 9
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 29/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 2/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 29/29 (hedef ≥ %60 → 18–29/29): **EVET** · n = 29
- Bilgi (maaş masası): iyi botlar masa 113 · erteleme 113 · careless masa 20 · erteleme 20 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.4 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 83 (hedef ≤ 80): **HAYIR** · medyan 25 · 80'i aşan 1/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 85% / 81% / 79% / 78% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 8 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 95 · founder-no-pay 93 · lean-office 96 · deferred-pay 55 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 19/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 13 · team-mutiny 0 · rival-dies 2 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 7913.2 sn · `npm run sim -- --seeds 24 --days 4500`_
