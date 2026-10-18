# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 3.8 dk · g115 (24/24) | 6.0 dk · g180 (24/24) | 14.8 dk · g444 (24/24) | 25.0 dk · g750 (24/24) | 38.1 dk · g1144 (24/24) | 65.0 dk · g1949 (24/24) |
| vcRocket | 3.5 dk · g105 (24/24) | 6.3 dk · g190 (24/24) | 13.4 dk · g403 (24/24) | 20.3 dk · g608 (24/24) | 31.9 dk · g957 (24/24) | 58.2 dk · g1745 (24/24) |
| niche | 3.7 dk · g111 (24/24) | 5.8 dk · g176 (24/24) | 14.0 dk · g420 (24/24) | 21.6 dk · g647 (24/24) | 38.2 dk · g1145 (24/24) | 59.9 dk · g1796 (24/24) |
| platform | 3.9 dk · g117 (24/24) | 6.8 dk · g206 (24/24) | 14.1 dk · g422 (24/24) | 23.3 dk · g700 (24/24) | 38.7 dk · g1162 (24/24) | 64.4 dk · g1932 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 8 | 10 / 10 | %45 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 7 | 10 / 10 | %34 | 36 |
| niche | 0% | unicorn 24 | 8 / 8 | 9 / 9 | %49 | 36 |
| platform | 0% | unicorn 24 | 8 / 8 | 10 / 10 | %45 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 39.0 dk · g1170 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 6.0 dk · g180 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Kullanıcı bul + konuş tıklaması (medyan / en çok) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | setAdBudget 123.5 | 9 / 11 | 14 sn / 14 sn | 0.23× |
| vcRocket | setAdBudget 114.5 | 11 / 13 | 14 sn / 14 sn | 0.33× |
| niche | respondResignation 147.5 | 9 / 11 | 14 sn / 14 sn | 0.30× |
| platform | setAdBudget 160.5 | 11 / 13 | 14 sn / 14 sn | 0.23× |

- findUsers hiçbir arketipte en sık aksiyon değil: **EVET**
- Kullanıcı bul + konuş tıklaması koşu başına ≤ 30 (en kötü koşu): **EVET** (13)
- Tur penceresinde en uzun boşluk ≤ 20 sn: **EVET**

## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)

Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.

| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |
|---|---|---|---|---|---|
| bootstrap | 2.0 sn | 6.5 sn / 16.0 sn | 2.0 sn / 8.0 sn | 0 | 0 |
| vcRocket | 2.5 sn | 8.0 sn / 12.0 sn | 2.0 sn / 7.5 sn | 0 | 0 |
| niche | 2.0 sn | 6.5 sn / 16.0 sn | 2.0 sn / 10.0 sn | 0 | 0 |
| platform | 2.5 sn | 7.5 sn / 14.0 sn | 2.0 sn / 8.0 sn | 0.5 | 0 |

| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |
|---|---|---|---|
| iyi (4 arketip) | 0% (0/96) | — | 0 |
| dikkatsiz (bootstrap planı, özensiz) | 0% (0/24) | — | 1 |
| kaos (random) | 100% (24/24) | 6.0 dk · g180 | 3 |
| idle | 100% (24/24) | 39.0 dk · g1170 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 65.0 dk | 24/24 | 0% | %45 |
| worst | 61.7 dk | 21/24 | 0% | %38 |
| first | 64.2 dk | 24/24 | 0% | %39 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 80.1 dk · %56 · 24/24 | 65.0 dk · %45 · 24/24 | 62.0 dk · %36 · 24/24 | %29 | — |
| vcRocket | 77.5 dk · %55 · 24/24 | 62.1 dk · %44 · 24/24 | 58.2 dk · %34 · 24/24 | %33 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 66.4 dk · %45 | 65.0 dk · %45 | hayır |
| platform | 61.0 dk · %44 | 64.4 dk · %45 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 17% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 41% · tablo tavanı 0% · tablo tabanı 59%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 303 | 1.2 | 2.1 | 0% | 0.3 | 1.5 |
| Pre-seed | 238 | 5.1 | 30.3 | 14% | 3.5 | 5.8 |
| Seed | 724 | 33.4 | 99.0 | 52% | 4.7 | 6.6 |
| Series A | 891 | 8.0 | 99.0 | 38% | 4.6 | 5.8 |
| Series B | 1353 | 9.3 | 99.0 | 36% | 3.8 | 9.0 |
| Series C | 2438 | 17.4 | 99.0 | 43% | 5.7 | 14.9 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 3 | 6% | 0.0 |
| Pre-seed | 96 | 0 | 16% | 0.0 |
| Seed | 96 | 0 | 14% | 4.2 |
| Series A | 96 | 0 | 11% | 3.1 |
| Series B | 96 | 0 | 10% | 2.9 |
| Series C | 96 | 0 | 13% | 3.3 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 3 | 25 | 24 | 27.5 | 64 |
| vcRocket | 7 | 4 | 23 | 21 | 29 | 81.5 |
| niche | 7 | 3 | 13 | 10 | 17 | 31 |
| platform | 7 | 4 | 30 | 37.5 | 49.5 | 107.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 19%, en kötü 40% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 20 | 19 | usagePricing 10, paywall 3, templates 2, onboarding 2, freemium 1, notifications 1, analytics 1, support 1, feedback 1, cicd 1, seo 1 | feedback 31, usagePricing 30, analytics 27 | 61% (373 hafta) | 1 |
| vcRocket | 24/24 | 20 | 19 | aso 8, deepLinks 4, crashReports 4, feedback 2, referral 1, freemium 1, paywall 1, offlineMode 1, notifications 1, analytics 1 | analytics 32, referral 32, onboarding 31 | 60% (341 hafta) | 1 |
| niche | 24/24 | 10 | 10 | usagePricing 11, paywall 5, support 2, analytics 1, sdks 1, rateLimit 1, feedback 1, webhooks 1, notifications 1 | slaPlans 21, rateLimit 20, docs 19 | 72% (359 hafta) | 0 |
| platform | 24/24 | 30 | 29 | openApi 4, paywall 4, payments 3, sellerDashboard 3, freemium 2, reviews 1, onboarding 1, support 1, referral 1, usagePricing 1, notifications 1, search 1, feedback 1 | referral 46, feedback 45, notifications 40 | 68% (404 hafta) | 1 |
| careless | 24/24 | 18 | 86 | usagePricing 13, paywall 5, teamPlans 2, templates 1, freemium 1, notifications 1, onboarding 1 | feedback 32, usagePricing 30, onboarding 29 | 96% (183 hafta) | 451.5 |
| coasterModules | 24/24 | 10 | 10 | usagePricing 10, paywall 5, support 3, teamPlans 2, onboarding 1, referral 1, analytics 1, notifications 1 | feedback 15, support 15, adminPanel 14 | 63% (114 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 68.0 dk · 0 iflas | 24/24 · 59.9 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 75.9 dk · 0 iflas | 24/24 · 65.0 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 63.1 dk · 0 iflas | 24/24 · 58.2 dk · 0 iflas |
| ek kategori | platform | 24/24 · 65.6 dk · 0 iflas | 24/24 · 64.4 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Series A · kurulan modül (medyan) 10

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = ağırlık × $karşılık × zevk − kira − maliyet / geri dönüş ayı (B2; para 12, büyüme 18, erişim 15, tutundurma 12 ay), $karşılık arayüzdeki `moduleEstimate`; zevk ve tür ağırlıkları seed ve bota göre değişir. Slot: v1 3, v2 6, v3 8, v4 9, v5+ 10. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 10 | 10 | 480 / 480 | 134 / 346 | 245 · 99 · 120 · 15 · 1 |
| vcRocket | 5.5 / 6 | 10 | 10 | 479 / 479 | 125 / 354 | 238 · 98 · 105 · 26 · 12 |
| niche | 5 / 6 | 10 | 10 | 240 / 240 | 62 / 178 | 114 · 53 · 63 · 9 · 1 |
| platform | 5 / 7 | 10 | 10 | 715 / 715 | 148 / 567 | 351 · 146 · 182 · 31 · 5 |
| careless | 6 / 10 | 9.5 | 9.5 | 434 / 435 | 95 / 340 | 236 · 105 · 80 · 13 · 0 |
| coasterModules | 6 / 7 | 10 | 10 | 239 / 240 | 51 / 188 | 119 · 42 · 54 · 23 · 1 |

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 65.0 dk | 0 |
| büyüme (vcRocket) | 24/24 | 65.2 dk | 0 |
| tutundurma (niche) | 24/24 | 64.4 dk | 0 |
| erişim (platform) | 24/24 | 64.5 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.01× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 24/24 | 70.9 dk | 0 | 24/24 · 78.9 dk | adminPanel 20, usagePricing 19, feedback 19, seo 16, analytics 16 |
| mobile | 24/24 | 71.7 dk | 0 | 24/24 · 74.1 dk | feedback 22, crashReports 19, notifications 18, paywall 16, support 16 |
| api | 24/24 | 71.5 dk | 0 | 24/24 · 78.5 dk | rateLimit 23, slaPlans 20, usagePricing 19, usageDashboard 18, feedback 16 |
| marketplace | 24/24 | 67.4 dk | 0 | 23/24 · 76.6 dk | payments 24, search 22, reviews 20, feedback 19, notifications 16 |
| ai | 24/24 | 62.1 dk | 0 | 24/24 · 69.7 dk | modelRouter 19, evals 19, usagePricing 18, feedback 18, rag 16 |
| game | 24/24 | 63.5 dk | 0 | 24/24 · 72.5 dk | feedback 19, dailyRewards 19, liveEvents 17, support 15, analytics 15 |

Kategori × bot (tek kategori, Unicorn / seed · medyan):

| Kategori | bootstrap | vcRocket | niche | platform |
|---|---|---|---|---|
| web | 24/24 · 70.9 dk | 24/24 · 70.6 dk | 24/24 · 57.6 dk | 24/24 · 82.3 dk |
| mobile | 24/24 · 71.7 dk | 24/24 · 71.8 dk | 24/24 · 63.7 dk | 22/24 · 87.7 dk |
| api | 24/24 · 71.5 dk | 24/24 · 71.1 dk | 24/24 · 59.9 dk | 24/24 · 87.7 dk |
| marketplace | 24/24 · 67.4 dk | 23/24 · 71.4 dk | 24/24 · 58.1 dk | 24/24 · 82.4 dk |
| ai | 24/24 · 62.1 dk | 24/24 · 59.7 dk | 24/24 · 52.1 dk | 24/24 · 68.4 dk |
| game | 24/24 · 63.5 dk | 24/24 · 62.8 dk | 24/24 · 59.1 dk | 24/24 · 71.4 dk |

Her kategori her botta ≥ 21/24 Unicorn: **EVET**

Modül yoğunlaşması (B2): koşu sonunda kategorinin projelerinin kaçında kurulu; arketip koşuları + kategori × bot turu. Hedef: hiçbir modül > %80, en az 40/65 modül kullanılmış.

| Kategori | Proje | > %80 | En sık 5 | İlk 3 seçim (farklı küme) |
|---|---|---|---|---|
| web | 144 | — | feedback 76%, adminPanel 73%, templates 64%, usagePricing 62%, analytics 60% | 94/144 |
| api | 168 | — | slaPlans 76%, usagePricing 70%, usageDashboard 70%, feedback 64%, docs 63% | 103/168 |
| mobile | 120 | — | aso 73%, feedback 73%, offlineMode 65%, onboarding 64%, crashReports 63% | 81/120 |
| ai | 120 | — | evals 73%, usagePricing 72%, feedback 67%, rag 64%, onboarding 58% | 82/120 |
| marketplace | 120 | payments | payments 88%, search 78%, reviews 71%, feedback 68%, paywall 62% | 89/120 |
| game | 96 | — | feedback 77%, dailyRewards 66%, liveEvents 65%, onboarding 64%, leaderboard 64% | 71/96 |

Kullanılan modül: 64/65 (kurulmayan: esports). Yalnız arketip koşularında (kategorileri sabit, bilgi): > %80 olan 4 modül · web adminPanel · api — · mobile aso · ai — · marketplace reviews/payments.

Plan seçimleri (B2 inceleme): kategori × bot turunda yalnız botun karttaki tahmine göre seçtiği modüller (slot doldurucunun çekilişi hariç); pay = planın seçtiği koşu / plan seçimi olan koşu.

| Kategori | Plan payı (kurulan) | Plan seçimi olan koşu | > %80 | En sık 5 plan seçimi |
|---|---|---|---|---|
| web | 25% | 96/96 | — | usagePricing 58%, abTest 48%, adminPanel 36%, paywall 31%, teamPlans 20% |
| mobile | 20% | 87/96 | — | paywall 56%, abTest 41%, aso 37%, inAppPurchase 36%, deepLinks 18% |
| api | 24% | 95/96 | — | usagePricing 69%, slaPlans 39%, abTest 33%, usageDashboard 26%, rateLimit 24% |
| marketplace | 30% | 96/96 | — | paywall 53%, payments 47%, search 45%, recommendations 38%, promotedListings 32% |
| ai | 25% | 95/96 | — | usagePricing 69%, abTest 41%, paywall 26%, fineTune 23%, agents 21% |
| game | 23% | 95/96 | — | paywall 54%, battlePass 48%, abTest 41%, shop 32%, aiAssistant 11% |

Kapsam: 63/65 modül en az bir koşuda kuruldu; kurulmayan: esports, cityLaunch.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 4 / 5 | 23% | 9% | 50 | 0 | 831 | 67 | 6.0 dk / 6.0 dk · 14.8 dk / 16.4 dk · 25.0 dk / 25.8 dk · 65.0 dk / 66.7 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 15% | 11% | 59 | 24 | 964 | 58 | 6.3 dk / 6.3 dk · 13.4 dk / 13.7 dk · 20.3 dk / 20.9 dk · 58.2 dk / 55.7 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 32% | 5% | 24 | 0 | 420 | 69 | 5.8 dk / 5.8 dk · 14.0 dk / 14.1 dk · 21.6 dk / 23.5 dk · 59.9 dk / 58.7 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 16% | 10% | 77 | 0 | 1005 | 61 | 6.8 dk / 6.8 dk · 14.1 dk / 14.7 dk · 23.3 dk / 25.3 dk · 64.4 dk / 73.9 dk |
| careless | 0 / 0 / 5 | 3 | 3 / 5 | 28% | 1% | 0 | 0 | 252 | 62 | 6.3 dk · 14.2 dk · 56.1 dk · — |
| greedyGood | 0 / 0 / 0 | 0 | 5 / 5 | 17% | 9% | 78 | 56 | 788 | 62 | 5.8 dk · 10.5 dk · 18.7 dk · 56.3 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 5 (hedef ≥ 2) · Seed morali medyan 62 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 216.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 22/24 | 61% | 82% | 14% |
| coasterModules | 0/24 | — | 24/24 | 62% | 82% | 13% |
| idleAfterProfit | 0/24 | — | 0/24 | 93% | 27% | 2% |
| greedyGood | 24/24 | 56.3 dk | 0/24 | 14% | 0% | 8% |
| burner | 24/24 | 62.4 dk | 0/24 | 30% | 0% | 6% |
| frugal | 24/24 | 74.8 dk | 0/24 | 76% | 0% | 5% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 6% | 0% | 60% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 78.4 KB · maks 106.2 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 55–90 dk: medyanlar 65.0 / 58.2 / 59.9 / 64.4 dk → **hedef aralıkta**; arketip farkı 1.12× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.5 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 52% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %5 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 7 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Modül yoğunlaşması (B2): kategori projelerinin > %80’inde olan modül 1 (hedef 0) · marketplace/payments 88%: **HAYIR**
- Kullanılan modül (B2): 64/65 (hedef ≥ 40): **EVET**
- Plan seçimlerinde yoğunlaşma (B2 inceleme; karttaki tahmine göre seçen oyuncu): plan seçimi olan koşuların > %80’inde seçilen modül 0 (hedef 0) · plan payı 25% (bilgi): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 27% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 62.1 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 62.1 dk (%141): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 62.4 dk ↔ 74.8 dk (%17): **EVET**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 31% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 93/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 33% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.7 (3–6) · Series A 4.6 (4–8) · Series B 3.8 (5–9) · Series C 5.7 (6–10): **HAYIR** (2/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 6% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 38% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 3.3 (hedef 20–40) · hız çarpanı 0.93 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 11% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 84/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–90 dk ve fark ≤ 1.6×: 65.0 / 58.2 / 59.9 / 64.4 dk · 1.12×: **EVET**
- Kayıt boyutu medyan 78.4 KB (hedef < 70) · maks 106.2 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3107 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.5 ↔ hazırlanmayan 5.1 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 379/379
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1034 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 32.7 ↔ kriz içeriği olmadan aynı seed'ler 28.1 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 17.4 ↔ 16.3 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 62.1 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 56.9 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 0/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.06
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 167/1264 (hedef %30–50 → 380–632/1264): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C, çeyrek): 13/23 (hedef ≥ %80 → 19–23/23): **HAYIR** · A'ya ulaşan 2/24
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 3.2 (hedef 4–10) · yenilenen 100% (hedef ≥ %60): **HAYIR** · koşu başına 0–11 · satıcılar (bootstrap + niche, 48 koşu) 6.4
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 0/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 0/0 (hedef ≥ %50 → 0–0/0): **EVET** (kredi alan yok)
- Düşen tur payı, iyi botlar (tur denemesi): 8/488 (hedef %10–20 → 49–97/488): **HAYIR** · down round 7 · kredi çağrısı 0
- Bilgi: careless: kredi 10/24 · çağrı 0 · düşen tur 6 · down round 4 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 4 · down round 3 · iplik adımı / koşu (iyi, medyan) 8
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 19/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 0/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 19/19 (hedef ≥ %60 → 12–19/19): **EVET** · n = 19
- Bilgi (maaş masası): iyi botlar masa 40 · erteleme 40 · careless masa 20 · erteleme 17 · greedyGood masa 21 · erteleme 21
- Pre-seed varış medyanı, iyi botlar: 3.7 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 66 (hedef ≤ 80): **EVET** · medyan 23.5 · 80'i aşan 0/96
- topActionShare, iyi botlar (medyan): 19% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 83% (hedef ≥ %70): **EVET** · Pre-seed → C 79% / 76% / 80% / 78% / 83%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 94 · founder-no-pay 91 · lean-office 96 · deferred-pay 36 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 4/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 4 · team-mutiny 0 · rival-dies 6 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 2440.5 sn · `npm run sim -- --seeds 24 --days 4500`_
