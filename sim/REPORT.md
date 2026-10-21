# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (210 dk @1x). 1 gün = 2.8 sn, 5 dk = 107 gün, 10 dk = 214 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 5.3 dk · g115 (24/24) | 8.7 dk · g187 (24/24) | 21.4 dk · g459 (24/24) | 35.8 dk · g767 (24/24) | 53.6 dk · g1149 (24/24) | 92.9 dk · g1992 (24/24) |
| vcRocket | 4.8 dk · g103 (24/24) | 9.2 dk · g197 (24/24) | 19.2 dk · g412 (24/24) | 29.1 dk · g624 (24/24) | 49.6 dk · g1064 (24/24) | 81.6 dk · g1748 (24/24) |
| niche | 5.1 dk · g109 (24/24) | 8.1 dk · g174 (24/24) | 19.7 dk · g422 (24/24) | 31.3 dk · g671 (24/24) | 52.3 dk · g1121 (24/24) | 81.3 dk · g1743 (24/24) |
| platform | 5.5 dk · g117 (24/24) | 9.5 dk · g203 (24/24) | 19.9 dk · g427 (24/24) | 30.8 dk · g660 (24/24) | 51.1 dk · g1095 (24/24) | 84.7 dk · g1816 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 7 / 7 | 10 / 8 | %46 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %35 | 36 |
| niche | 0% | unicorn 24 | 7 / 7 | 9 / 9 | %49 | 36 |
| platform | 0% | unicorn 24 | 7 / 7 | 9.5 / 8 | %45 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 53.2 dk · g1140 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 8.4 dk · g180 | 0 | 1 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Kullanıcı bul + konuş tıklaması (medyan / en çok) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | setAdBudget 131 | 9 / 11 | 20 sn / 20 sn | 0.24× |
| vcRocket | setAdBudget 133 | 11 / 13 | 20 sn / 20 sn | 0.34× |
| niche | respondResignation 146 | 9 / 11 | 20 sn / 20 sn | 0.30× |
| platform | setAdBudget 147.5 | 11 / 13 | 20 sn / 20 sn | 0.23× |

- findUsers hiçbir arketipte en sık aksiyon değil: **EVET**
- Kullanıcı bul + konuş tıklaması koşu başına ≤ 30 (en kötü koşu): **EVET** (13)
- Tur penceresinde en uzun boşluk ≤ 30 sn: **EVET**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.8 sn | 9.1 sn / 14.0 sn | 2.8 sn / 11.2 sn | 0 | 0 |
| vcRocket | 3.5 sn | 9.1 sn / 14.0 sn | 2.8 sn / 10.5 sn | 0 | 0 |
| niche | 3.5 sn | 9.1 sn / 14.0 sn | 2.8 sn / 14.0 sn | 0 | 0 |
| platform | 3.5 sn | 9.1 sn / 11.2 sn | 2.8 sn / 11.2 sn | 1 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/96) | — | 0 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/24) | — | 1 |
| kaos (random) | 100% (24/24) | 8.4 dk · g180 | 3 |
| idle | 100% (24/24) | 53.2 dk · g1140 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 92.9 dk | 24/24 | 0% | %46 |
| worst | 85.5 dk | 24/24 | 0% | %39 |
| first | 87.4 dk | 24/24 | 0% | %41 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 107.1 dk · %58 · 24/24 | 92.9 dk · %46 · 24/24 | 83.5 dk · %37 · 24/24 | %28 | — |
| vcRocket | 106.0 dk · %55 · 24/24 | 84.6 dk · %44 · 24/24 | 81.6 dk · %35 · 24/24 | %30 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 87.1 dk · %45 | 92.9 dk · %46 | hayır |
| platform | 85.9 dk · %44 | 84.7 dk · %45 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 16% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 40% · tablo tavanı 0% · tablo tabanı 60%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 306 | 1.2 | 2.1 | 0% | 0.1 | 1.4 |
| Pre-seed | 235 | 5.2 | 33.3 | 15% | 3.5 | 6.2 |
| Seed | 732 | 38.7 | 99.0 | 55% | 4.4 | 6.5 |
| Series A | 856 | 7.9 | 99.0 | 35% | 4.6 | 6.0 |
| Series B | 1365 | 8.7 | 99.0 | 35% | 3.6 | 8.3 |
| Series C | 2276 | 16.7 | 99.0 | 40% | 6.3 | 14.4 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 3 | 6% | 0.0 |
| Pre-seed | 96 | 0 | 16% | 0.0 |
| Seed | 96 | 0 | 14% | 4.2 |
| Series A | 96 | 0 | 10% | 3.5 |
| Series B | 96 | 0 | 11% | 3.3 |
| Series C | 96 | 0 | 13% | 3.5 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 4 | 25 | 23 | 27.5 | 60.5 |
| vcRocket | 7 | 4 | 24 | 21.5 | 36.5 | 77.5 |
| niche | 7 | 3.5 | 13 | 9 | 15.5 | 28 |
| platform | 7 | 4 | 31 | 29 | 48.5 | 100 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 20%, en kötü 34% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 20 | 19 | usagePricing 11, paywall 5, teamPlans 3, notifications 1, analytics 1, support 1, seo 1, templates 1 | feedback 37, usagePricing 28, notifications 26 | 60% (399 hafta) | 1 |
| vcRocket | 24/24 | 20 | 19 | aso 8, deepLinks 5, referral 3, inAppPurchase 2, widgets 1, crashReports 1, support 1, paywall 1, freemium 1, notifications 1 | analytics 33, referral 31, abTest 31 | 56% (365 hafta) | 1 |
| niche | 24/24 | 10 | 10 | usagePricing 10, paywall 7, openApi 1, docs 1, onboarding 1, cicd 1, support 1, feedback 1, sdks 1 | slaPlans 19, support 18, notifications 17 | 61% (410 hafta) | 0 |
| platform | 24/24 | 30 | 24 | paywall 5, sellerDashboard 3, promotedListings 3, reviews 2, search 2, openApi 2, payments 1, security 1, referral 1, support 1, feedback 1, shipping 1, onboarding 1 | feedback 56, referral 42, notifications 42 | 66% (394 hafta) | 1 |
| careless | 24/24 | 18 | 88.5 | usagePricing 13, paywall 5, templates 1, freemium 1, feedback 1, referral 1, seo 1, notifications 1 | analytics 31, usagePricing 30, feedback 28 | 93% (206 hafta) | 452.5 |
| coasterModules | 24/24 | 10 | 7.5 | usagePricing 10, paywall 8, analytics 1, templates 1, support 1, landingPages 1, teamPlans 1, adminPanel 1 | feedback 17, landingPages 17, onboarding 16 | 70% (103 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 89.6 dk · 0 iflas | 24/24 · 81.3 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 102.3 dk · 0 iflas | 24/24 · 92.9 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 88.2 dk · 0 iflas | 24/24 · 81.6 dk · 0 iflas |
| ek kategori | platform | 24/24 · 89.4 dk · 0 iflas | 24/24 · 84.7 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Series A · kurulan modül (medyan) 10

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = ağırlık × $karşılık × zevk − kira − maliyet / geri dönüş ayı (B2; para 12, büyüme 18, erişim 15, tutundurma 12 ay), $karşılık arayüzdeki `moduleEstimate`; zevk ve tür ağırlıkları seed ve bota göre değişir. Slot: v1 3, v2 6, v3 8, v4 9, v5+ 10. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 10 | 10 | 478 / 478 | 125 / 353 | 251 · 95 · 116 · 16 · 0 |
| vcRocket | 6 / 6 | 10 | 10 | 479 / 480 | 122 / 357 | 235 · 101 · 107 · 24 · 12 |
| niche | 5 / 6 | 10 | 10 | 240 / 240 | 62 / 178 | 122 · 50 · 58 · 8 · 2 |
| platform | 5 / 6 | 10 | 10 | 715 / 715 | 167 / 548 | 370 · 142 · 165 · 30 · 8 |
| careless | 6.5 / 10 | 9.5 | 9.5 | 435 / 436 | 101 / 335 | 237 · 90 · 97 · 9 · 2 |
| coasterModules | 5.5 / 8 | 10 | 10 | 239 / 240 | 49 / 190 | 117 · 45 · 53 · 22 · 2 |

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 92.9 dk | 0 |
| büyüme (vcRocket) | 24/24 | 85.9 dk | 0 |
| tutundurma (niche) | 24/24 | 89.3 dk | 0 |
| erişim (platform) | 24/24 | 88.5 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.08× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 24/24 | 91.6 dk | 0 | 24/24 · 109.4 dk | adminPanel 20, feedback 19, analytics 17, usagePricing 16, seo 16 |
| mobile | 24/24 | 99.0 dk | 0 | 24/24 · 107.3 dk | aso 19, feedback 19, crashReports 17, paywall 16, onboarding 16 |
| api | 24/24 | 96.1 dk | 0 | 24/24 · 115.4 dk | rateLimit 22, feedback 20, slaPlans 19, usagePricing 18, usageDashboard 17 |
| marketplace | 24/24 | 92.0 dk | 0 | 24/24 · 102.2 dk | payments 23, reviews 19, search 19, referral 16, feedback 16 |
| ai | 24/24 | 85.1 dk | 0 | 24/24 · 96.5 dk | evals 22, modelRouter 20, feedback 20, fineTune 18, usagePricing 16 |
| game | 24/24 | 86.3 dk | 0 | 23/24 · 103.1 dk | liveEvents 20, feedback 20, dailyRewards 19, battlePass 19, leaderboard 17 |

Kategori × bot (tek kategori, Unicorn / seed · medyan):

| Kategori | bootstrap | vcRocket | niche | platform |
|---|---|---|---|---|
| web | 24/24 · 91.6 dk | 24/24 · 99.0 dk | 24/24 · 76.4 dk | 23/24 · 112.5 dk |
| mobile | 24/24 · 99.0 dk | 24/24 · 100.8 dk | 24/24 · 82.5 dk | 23/24 · 120.7 dk |
| api | 24/24 · 96.1 dk | 24/24 · 101.3 dk | 24/24 · 81.3 dk | 24/24 · 117.0 dk |
| marketplace | 24/24 · 92.0 dk | 24/24 · 98.7 dk | 24/24 · 75.3 dk | 24/24 · 109.9 dk |
| ai | 24/24 · 85.1 dk | 24/24 · 83.7 dk | 24/24 · 67.4 dk | 24/24 · 100.3 dk |
| game | 24/24 · 86.3 dk | 24/24 · 89.6 dk | 24/24 · 75.1 dk | 24/24 · 95.9 dk |

Her kategori her botta ≥ 21/24 Unicorn: **EVET**

Modül yoğunlaşması (B2): koşu sonunda kategorinin projelerinin kaçında kurulu; arketip koşuları + kategori × bot turu. Hedef: hiçbir modül > %80, en az 40/65 modül kullanılmış.

| Kategori | Proje | > %80 | En sık 5 | İlk 3 seçim (farklı küme) |
|---|---|---|---|---|
| web | 144 | — | feedback 78%, adminPanel 76%, templates 66%, usagePricing 61%, seo 60% | 94/144 |
| api | 168 | — | slaPlans 75%, feedback 71%, usageDashboard 67%, usagePricing 63%, docs 63% | 103/168 |
| mobile | 120 | — | aso 74%, feedback 70%, deepLinks 62%, crashReports 62%, onboarding 58% | 90/120 |
| ai | 120 | — | feedback 78%, evals 75%, usagePricing 68%, rag 63%, referral 62% | 81/120 |
| marketplace | 120 | payments | payments 88%, search 74%, reviews 73%, feedback 70%, sellerDashboard 60% | 84/120 |
| game | 96 | — | feedback 76%, leaderboard 74%, dailyRewards 69%, liveEvents 65%, notifications 63% | 67/96 |

Kullanılan modül: 65/65. Yalnız arketip koşularında (kategorileri sabit, bilgi): > %80 olan 5 modül · web — · api — · mobile aso · ai analytics · marketplace payments/reviews/feedback.

Plan seçimleri (B2 inceleme): kategori × bot turunda yalnız botun karttaki tahmine göre seçtiği modüller (slot doldurucunun çekilişi hariç); pay = planın seçtiği koşu / plan seçimi olan koşu.

| Kategori | Plan payı (kurulan) | Plan seçimi olan koşu | > %80 | En sık 5 plan seçimi |
|---|---|---|---|---|
| web | 24% | 93/96 | — | usagePricing 65%, adminPanel 46%, abTest 39%, paywall 31%, teamPlans 23% |
| mobile | 19% | 89/96 | — | paywall 48%, abTest 37%, aso 36%, inAppPurchase 35%, deepLinks 15% |
| api | 24% | 95/96 | — | usagePricing 64%, abTest 35%, slaPlans 33%, usageDashboard 31%, rateLimit 28% |
| marketplace | 32% | 96/96 | — | payments 58%, recommendations 50%, paywall 49%, search 43%, promotedListings 29% |
| ai | 23% | 95/96 | — | usagePricing 66%, abTest 32%, fineTune 31%, paywall 25%, modelRouter 21% |
| game | 23% | 91/96 | — | battlePass 57%, paywall 48%, abTest 43%, shop 37%, referral 12% |

Kapsam: 63/65 modül en az bir koşuda kuruldu; kurulmayan: esports, cityLaunch.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 4 / 5 | 25% | 8% | 53 | 0 | 736 | 69 | 8.7 dk / 8.8 dk · 21.4 dk / 22.0 dk · 35.8 dk / 36.4 dk · 92.9 dk / 90.7 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 15% | 11% | 66 | 24 | 948 | 57 | 9.2 dk / 9.2 dk · 19.2 dk / 18.6 dk · 29.1 dk / 29.9 dk · 81.6 dk / 78.5 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 34% | 5% | 23 | 0 | 341 | 69 | 8.1 dk / 8.1 dk · 19.7 dk / 19.9 dk · 31.3 dk / 30.4 dk · 81.3 dk / 83.0 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 16% | 10% | 79 | 0 | 868 | 60 | 9.5 dk / 9.5 dk · 19.9 dk / 20.3 dk · 30.8 dk / 33.2 dk · 84.7 dk / 93.5 dk |
| careless | 0 / 0 / 6 | 8 | 3 / 5 | 33% | 1% | 0 | 0 | 448 | 62 | 8.4 dk · 19.8 dk · 82.2 dk · — |
| greedyGood | 0 / 0 / 0 | 0 | 4 / 5 | 18% | 10% | 76 | 58 | 772 | 63 | 8.1 dk · 14.8 dk · 25.4 dk · 75.6 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 6 (hedef ≥ 2) · Seed morali medyan 62 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 242.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 22/24 | 63% | 81% | 13% |
| coasterModules | 0/24 | — | 24/24 | 61% | 81% | 14% |
| idleAfterProfit | 0/24 | — | 0/24 | 93% | 81% | 2% |
| greedyGood | 24/24 | 75.6 dk | 0/24 | 10% | 0% | 8% |
| burner | 24/24 | 85.8 dk | 0/24 | 27% | 0% | 6% |
| frugal | 24/24 | 101.1 dk | 0/24 | 73% | 0% | 5% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 6% | 0% | 57% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 80.7 KB · maks 110.8 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 75–120 dk: medyanlar 92.9 / 81.6 / 81.3 / 84.7 dk → **hedef aralıkta**; arketip farkı 1.14× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 3.5 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 55% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %9 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 7 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Modül yoğunlaşması (B2): kategori projelerinin > %80’inde olan modül 1 (hedef 0) · marketplace/payments 88%: **HAYIR**
- Kullanılan modül (B2): 65/65 (hedef ≥ 40): **EVET**
- Plan seçimlerinde yoğunlaşma (B2 inceleme; karttaki tahmine göre seçen oyuncu): plan seçimi olan koşuların > %80’inde seçilen modül 0 (hedef 0) · plan payı 24% (bilgi): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 81% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 84.4 dk (tolerans 75–130 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 210 dk): 210.0 dk ↔ 84.4 dk (%149): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 210 dk): 85.8 dk ↔ 101.1 dk (%15): **EVET**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 30% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 93/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 30% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.4 (3–6) · Series A 4.6 (4–8) · Series B 3.6 (5–9) · Series C 6.3 (6–10): **HAYIR** (3/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 6% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 37% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 3.5 (hedef 20–40) · hız çarpanı 0.93 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 11%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 78/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 75–120 dk ve fark ≤ 1.6×: 92.9 / 81.6 / 81.3 / 84.7 dk · 1.14×: **EVET**
- Kayıt boyutu medyan 80.7 KB (hedef < 70) · maks 110.8 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3073 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 95/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.4 ↔ hazırlanmayan 5.1 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 378/378
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1024 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 31.0 ↔ kriz içeriği olmadan aynı seed'ler 25.9 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 17.0 ↔ 15.5 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 210 dk (96/96 ulaştı): 84.4 dk (tolerans 75–130 dk): **EVET** · kriz içeriği olmadan 77.0 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 0/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.07
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 147/1209 (hedef %30–50 → 363–604/1209): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C, çeyrek): 10/16 (hedef ≥ %80 → 13–16/16): **HAYIR** · A'ya ulaşan 1/24
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 2.9 (hedef 4–10) · yenilenen 99% (hedef ≥ %60): **HAYIR** · koşu başına 0–10 · satıcılar (bootstrap + niche, 48 koşu) 5.8
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 1/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 6/486 (hedef %10–20 → 49–97/486): **HAYIR** · down round 5 · kredi çağrısı 0
- Bilgi: careless: kredi 16/24 · çağrı 0 · düşen tur 1 · down round 1 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 2 · down round 2 · iplik adımı / koşu (iyi, medyan) 8
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 18/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 0/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 18/18 (hedef ≥ %60 → 11–18/18): **EVET** · n = 18
- Bilgi (maaş masası): iyi botlar masa 50 · erteleme 50 · careless masa 20 · erteleme 17 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 5.2 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 7 (hedef ≥ 3): **HAYIR**
- salesCall / koşu, iyi botlar (en çok): 66 (hedef ≤ 80): **EVET** · medyan 22 · 80'i aşan 0/96
- topActionShare, iyi botlar (medyan): 20% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 83% (hedef ≥ %70): **EVET** · Pre-seed → C 78% / 76% / 79% / 78% / 83%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 7.5 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 90 · founder-no-pay 92 · lean-office 95 · deferred-pay 36 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 5/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 9 · team-mutiny 0 · rival-dies 3 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 7591.3 sn · `npm run sim -- --seeds 24 --days 4500`_
