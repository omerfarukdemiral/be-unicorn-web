# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.5 dk · g137 (24/24) | 6.7 dk · g200 (24/24) | 15.7 dk · g470 (24/24) | 27.0 dk · g809 (24/24) | 40.1 dk · g1204 (24/24) | 73.1 dk · g2193 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.3 dk · g220 (24/24) | 13.4 dk · g403 (24/24) | 21.8 dk · g655 (24/24) | 35.3 dk · g1059 (24/24) | 56.2 dk · g1686 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.3 dk · g191 (24/24) | 14.6 dk · g437 (24/24) | 24.3 dk · g728 (24/24) | 40.0 dk · g1201 (24/24) | 61.8 dk · g1854 (24/24) |
| platform | 4.5 dk · g135 (24/24) | 7.4 dk · g222 (24/24) | 15.4 dk · g463 (24/24) | 25.3 dk · g760 (24/24) | 41.2 dk · g1237 (24/24) | 69.6 dk · g2087 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %39 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 9 | %51 | 36 |
| platform | 0% | unicorn 24 | 8 / 7 | 10 / 8 | %49 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 39.0 dk · g1170 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 6.0 dk · g180 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:talkToUsers 274 | 271.5 | 14 sn / 14 sn | 0.23× |
| vcRocket | founderAction:talkToUsers 327 | 320.5 | 14 sn / 40 sn | 0.32× |
| niche | founderAction:findUsers 211 | 211 | 14 sn / 32 sn | 0.30× |
| platform | founderAction:talkToUsers 294.5 | 276.5 | 14 sn / 40 sn | 0.23× |

- findUsers hiçbir arketipte en sık aksiyon değil: **HAYIR**
- Tur penceresinde en uzun boşluk ≤ 20 sn: **HAYIR (40 sn)**

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
| idle | 100% (24/24) | 39.0 dk · g1170 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 73.1 dk | 24/24 | 0% | %50 |
| worst | 64.1 dk | 17/24 | 0% | %41 |
| first | 69.1 dk | 24/24 | 0% | %43 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 86.1 dk · %61 · 24/24 | 73.1 dk · %50 · 24/24 | 67.6 dk · %40 · 24/24 | %27 | — |
| vcRocket | 72.0 dk · %58 · 24/24 | 61.1 dk · %47 · 24/24 | 56.2 dk · %39 · 24/24 | %28 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 70.7 dk · %50 | 73.1 dk · %50 | hayır |
| platform | 66.9 dk · %49 | 69.6 dk · %49 | EVET |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 17% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 36% · tablo tavanı 0% · tablo tabanı 64%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 408 | 0.8 | 2.0 | 0% | 0.0 | 1.0 |
| Pre-seed | 223 | 4.9 | 37.3 | 19% | 3.5 | 5.8 |
| Seed | 754 | 27.0 | 99.0 | 51% | 4.5 | 6.4 |
| Series A | 955 | 7.9 | 99.0 | 38% | 4.4 | 5.7 |
| Series B | 1410 | 9.3 | 99.0 | 38% | 3.7 | 10.6 |
| Series C | 2508 | 18.6 | 99.0 | 44% | 6.1 | 12.0 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 93 | 0 | 16% | 0.0 |
| Seed | 96 | 0 | 13% | 4.0 |
| Series A | 96 | 0 | 10% | 3.6 |
| Series B | 96 | 0 | 10% | 3.6 |
| Series C | 96 | 0 | 13% | 3.7 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 3.5 | 26 | 25.5 | 28.5 | 78.5 |
| vcRocket | 8 | 4 | 19 | 22.5 | 33.5 | 69 |
| niche | 8 | 3 | 12.5 | 11.5 | 17 | 30 |
| platform | 7 | 3 | 34.5 | 33.5 | 48.5 | 117 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 28% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 20 | 22 | usagePricing 10, paywall 6, teamPlans 2, templates 2, support 1, openApi 1, landingPages 1, seo 1 | feedback 37, usagePricing 28, referral 26 | 69% (354 hafta) | 1 |
| vcRocket | 24/24 | 20 | 13.5 | aso 10, paywall 2, analytics 2, notifications 1, inAppPurchase 1, tabletApp 1, usagePricing 1, openApi 1, freemium 1, crashReports 1, widgets 1, onboarding 1, referral 1 | analytics 33, referral 30, abTest 29 | 62% (333 hafta) | 1 |
| niche | 24/24 | 10 | 10 | usagePricing 10, paywall 6, notifications 2, feedback 2, support 1, referral 1, webhooks 1, docs 1 | usageDashboard 19, usagePricing 18, docs 18 | 65% (369 hafta) | 0 |
| platform | 24/24 | 30 | 30.5 | paywall 4, usagePricing 3, notifications 3, referral 2, sellerDashboard 2, reviews 2, openApi 1, payments 1, promotedListings 1, search 1, shipping 1, security 1, onboarding 1, support 1 | feedback 51, referral 48, support 39 | 62% (418 hafta) | 1 |
| careless | 24/24 | 18 | 89 | usagePricing 15, paywall 4, teamPlans 2, templates 1, feedback 1, seo 1 | usagePricing 30, analytics 28, feedback 27 | 96% (178 hafta) | 448.5 |
| coasterModules | 24/24 | 10 | 10 | usagePricing 10, paywall 8, landingPages 2, integrations 1, feedback 1, analytics 1, onboarding 1 | landingPages 20, feedback 18, seo 17 | 74% (94 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 70.3 dk · 0 iflas | 24/24 · 61.8 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 82.0 dk · 0 iflas | 24/24 · 73.1 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 62.5 dk · 0 iflas | 24/24 · 56.2 dk · 0 iflas |
| ek kategori | platform | 24/24 · 74.7 dk · 0 iflas | 24/24 · 69.6 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Series A · kurulan modül (medyan) 10

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = ağırlık × $karşılık × zevk − kira − maliyet / geri dönüş ayı (B2; para 12, büyüme 18, erişim 15, tutundurma 12 ay), $karşılık arayüzdeki `moduleEstimate`; zevk ve tür ağırlıkları seed ve bota göre değişir. Slot: v1 3, v2 6, v3 8, v4 9, v5+ 10. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 10 | 10 | 479 / 479 | 106 / 373 | 250 · 101 · 111 · 15 · 2 |
| vcRocket | 5 / 6 | 10 | 10 | 479 / 479 | 127 / 352 | 217 · 112 · 113 · 22 · 15 |
| niche | 5 / 6 | 10 | 10 | 240 / 240 | 64 / 176 | 117 · 50 · 62 · 8 · 3 |
| platform | 5 / 7 | 10 | 10 | 720 / 720 | 134 / 586 | 370 · 153 · 157 · 35 · 5 |
| careless | 6.5 / 10 | 9.5 | 9.5 | 442 / 442 | 93 / 349 | 229 · 85 · 115 · 12 · 1 |
| coasterModules | 5 / 8 | 10 | 10 | 237 / 240 | 45 / 192 | 132 · 40 · 50 · 14 · 1 |

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 73.1 dk | 0 |
| büyüme (vcRocket) | 24/24 | 71.9 dk | 0 |
| tutundurma (niche) | 24/24 | 70.0 dk | 0 |
| erişim (platform) | 24/24 | 71.6 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.04× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 24/24 | 77.9 dk | 0 | 24/24 · 84.6 dk | adminPanel 21, feedback 17, analytics 16, landingPages 16, usagePricing 15 |
| mobile | 24/24 | 77.8 dk | 0 | 24/24 · 80.1 dk | feedback 22, crashReports 20, notifications 17, paywall 17, analytics 14 |
| api | 24/24 | 74.1 dk | 0 | 24/24 · 83.6 dk | rateLimit 22, slaPlans 20, usagePricing 18, usageDashboard 18, docs 15 |
| marketplace | 24/24 | 71.8 dk | 0 | 23/24 · 77.9 dk | search 23, payments 20, feedback 19, reviews 18, sellerDashboard 17 |
| ai | 24/24 | 58.7 dk | 0 | 24/24 · 67.0 dk | modelRouter 20, rag 19, evals 19, usagePricing 17, referral 16 |
| game | 23/24 | 73.0 dk | 0 | 23/24 · 88.6 dk | liveEvents 19, battlePass 19, dailyRewards 19, leaderboard 18, paywall 17 |

Kategori × bot (tek kategori, Unicorn / seed · medyan):

| Kategori | bootstrap | vcRocket | niche | platform |
|---|---|---|---|---|
| web | 24/24 · 77.9 dk | 23/24 · 87.5 dk | 24/24 · 65.6 dk | 22/24 · 94.2 dk |
| mobile | 24/24 · 77.8 dk | 24/24 · 76.2 dk | 24/24 · 64.1 dk | 23/24 · 87.0 dk |
| api | 24/24 · 74.1 dk | 24/24 · 72.3 dk | 24/24 · 61.8 dk | 24/24 · 89.6 dk |
| marketplace | 24/24 · 71.8 dk | 24/24 · 74.2 dk | 24/24 · 60.0 dk | 23/24 · 86.5 dk |
| ai | 24/24 · 58.7 dk | 24/24 · 60.6 dk | 24/24 · 49.0 dk | 24/24 · 68.6 dk |
| game | 23/24 · 73.0 dk | 22/24 · 82.0 dk | 24/24 · 67.3 dk | 24/24 · 82.8 dk |

Her kategori her botta ≥ 21/24 Unicorn: **EVET**

Modül yoğunlaşması (B2): koşu sonunda kategorinin projelerinin kaçında kurulu; arketip koşuları + kategori × bot turu. Hedef: hiçbir modül > %80, en az 40/65 modül kullanılmış.

| Kategori | Proje | > %80 | En sık 5 | İlk 3 seçim (farklı küme) |
|---|---|---|---|---|
| web | 144 | — | feedback 75%, templates 67%, adminPanel 65%, seo 61%, usagePricing 60% | 94/144 |
| api | 168 | — | slaPlans 71%, usagePricing 70%, usageDashboard 70%, docs 66%, webhooks 66% | 101/168 |
| mobile | 120 | — | feedback 74%, aso 71%, offlineMode 67%, paywall 63%, deepLinks 62% | 81/120 |
| ai | 120 | — | usagePricing 70%, evals 70%, feedback 67%, rag 67%, referral 62% | 84/120 |
| marketplace | 120 | payments | payments 86%, reviews 76%, search 71%, feedback 71%, sellerDashboard 68% | 92/120 |
| game | 96 | — | dailyRewards 75%, leaderboard 73%, feedback 69%, onboarding 68%, liveEvents 65% | 71/96 |

Kullanılan modül: 65/65. Yalnız arketip koşularında (kategorileri sabit, bilgi): > %80 olan 4 modül · web — · api — · mobile aso/deepLinks · ai — · marketplace reviews/payments.

Kapsam: 64/65 modül en az bir koşuda kuruldu; kurulmayan: esports.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 3 / 5 | 23% | 9% | 51 | 0 | 886 | 69 | 6.7 dk / 6.7 dk · 15.7 dk / 15.9 dk · 27.0 dk / 28.0 dk · 73.1 dk / 75.9 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 16% | 10% | 57 | 24 | 840 | 56 | 7.3 dk / 7.3 dk · 13.4 dk / 14.3 dk · 21.8 dk / 21.7 dk · 56.2 dk / 59.9 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 32% | 5% | 24 | 0 | 399 | 69 | 6.3 dk / 6.3 dk · 14.6 dk / 15.4 dk · 24.3 dk / 25.9 dk · 61.8 dk / 62.9 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 18% | 10% | 75 | 0 | 954 | 63 | 7.4 dk / 7.4 dk · 15.4 dk / 16.2 dk · 25.3 dk / 27.4 dk · 69.6 dk / 87.2 dk |
| careless | 0 / 0 / 5 | 6 | 3 / 5 | 28% | 1% | 0 | 0 | 152 | 62 | 6.5 dk · 14.8 dk · — · — |
| greedyGood | 0 / 0 / 0 | 0 | 5 / 5 | 18% | 9% | 71 | 53 | 775 | 64 | 6.2 dk · 10.8 dk · 19.6 dk · 58.0 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 5 (hedef ≥ 2) · Seed morali medyan 62 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 201.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 24/24 | 62% | 81% | 14% |
| coasterModules | 0/24 | — | 23/24 | 61% | 80% | 15% |
| idleAfterProfit | 0/24 | — | 0/24 | 93% | 78% | 3% |
| greedyGood | 24/24 | 58.0 dk | 0/24 | 15% | 0% | 8% |
| burner | 24/24 | 68.7 dk | 0/24 | 29% | 0% | 7% |
| frugal | 24/24 | 77.8 dk | 0/24 | 74% | 0% | 6% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 6% | 0% | 64% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 76.4 KB · maks 99.5 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 55–90 dk: medyanlar 73.1 / 56.2 / 61.8 / 69.6 dk → **hedef aralıkta**; arketip farkı 1.30× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **HAYIR**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 51% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %14 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 9 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Modül yoğunlaşması (B2): kategori projelerinin > %80’inde olan modül 1 (hedef 0) · marketplace/payments 86%: **HAYIR**
- Kullanılan modül (B2): 65/65 (hedef ≥ 40): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 78% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 63.7 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 63.7 dk (%135): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 68.7 dk ↔ 77.8 dk (%12): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 33% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 93/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 36% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.5 (3–6) · Series A 4.4 (4–8) · Series B 3.7 (5–9) · Series C 6.1 (6–10): **HAYIR** (3/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 39% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 3.7 (hedef 20–40) · hız çarpanı 0.93 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 90/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–90 dk ve fark ≤ 1.6×: 73.1 / 56.2 / 61.8 / 69.6 dk · 1.30×: **EVET**
- Kayıt boyutu medyan 76.4 KB (hedef < 70) · maks 99.5 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3167 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 38
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.4 ↔ hazırlanmayan 5.4 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 391/391
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1051 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 36.1 ↔ kriz içeriği olmadan aynı seed'ler 30.1 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 18.3 ↔ 17.0 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 63.7 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 58.2 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 1/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 1 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.07
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 167/1306 (hedef %30–50 → 392–653/1306): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C, çeyrek): 13/18 (hedef ≥ %80 → 15–18/18): **HAYIR** · A'ya ulaşan 1/24
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 3.6 (hedef 4–10) · yenilenen 99% (hedef ≥ %60): **HAYIR** · koşu başına 0–13 · satıcılar (bootstrap + niche, 48 koşu) 7.2
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 1/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 25/505 (hedef %10–20 → 51–101/505): **HAYIR** · down round 22 · kredi çağrısı 0
- Bilgi: careless: kredi 10/24 · çağrı 0 · düşen tur 6 · down round 5 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 2 · down round 2 · iplik adımı / koşu (iyi, medyan) 10
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 18/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 1/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 18/18 (hedef ≥ %60 → 11–18/18): **EVET** · n = 18
- Bilgi (maaş masası): iyi botlar masa 115 · erteleme 115 · careless masa 19 · erteleme 17 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.5 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 77 (hedef ≤ 80): **EVET** · medyan 25.5 · 80'i aşan 0/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 85% / 80% / 79% / 78% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7.5 · greedyGood 7 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 96 · founder-no-pay 89 · lean-office 96 · deferred-pay 48 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı salary-freeze, lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 21/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 12 · team-mutiny 0 · rival-dies 3 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 3552.3 sn · `npm run sim -- --seeds 24 --days 4500`_
