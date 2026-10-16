# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.5 dk · g135 (24/24) | 7.0 dk · g211 (24/24) | 15.6 dk · g468 (24/24) | 26.0 dk · g781 (24/24) | 38.7 dk · g1162 (24/24) | 67.7 dk · g2032 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.3 dk · g220 (24/24) | 13.4 dk · g403 (24/24) | 21.8 dk · g655 (24/24) | 35.3 dk · g1059 (24/24) | 56.0 dk · g1681 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.3 dk · g191 (24/24) | 14.6 dk · g437 (24/24) | 24.3 dk · g728 (24/24) | 40.0 dk · g1201 (24/24) | 61.8 dk · g1854 (24/24) |
| platform | 4.5 dk · g135 (24/24) | 7.4 dk · g222 (24/24) | 15.1 dk · g453 (24/24) | 24.9 dk · g748 (24/24) | 37.9 dk · g1136 (24/24) | 65.9 dk · g1978 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %46 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %34 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 9 | %49 | 36 |
| platform | 0% | unicorn 24 | 8 / 7 | 10 / 8 | %44 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 39.0 dk · g1170 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 6.0 dk · g180 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:talkToUsers 253 | 247.5 | 14 sn / 14 sn | 0.24× |
| vcRocket | founderAction:talkToUsers 326.5 | 319.5 | 14 sn / 40 sn | 0.32× |
| niche | founderAction:findUsers 211 | 211 | 14 sn / 32 sn | 0.30× |
| platform | founderAction:talkToUsers 275 | 260 | 14 sn / 40 sn | 0.24× |

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
| best | 67.7 dk | 24/24 | 0% | %46 |
| worst | 61.6 dk | 21/24 | 0% | %38 |
| first | 64.5 dk | 24/24 | 0% | %40 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 75.0 dk · %56 · 23/24 | 67.7 dk · %46 · 24/24 | 63.2 dk · %36 · 24/24 | %19 | — |
| vcRocket | 72.0 dk · %54 · 24/24 | 61.1 dk · %43 · 24/24 | 56.0 dk · %34 · 24/24 | %29 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 66.8 dk · %45 | 67.7 dk · %46 | hayır |
| platform | 63.2 dk · %43 | 65.9 dk · %44 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 18% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 37% · tablo tavanı 0% · tablo tabanı 63%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 410 | 0.8 | 2.0 | 0% | 0.0 | 1.2 |
| Pre-seed | 221 | 5.7 | 37.9 | 21% | 3.6 | 5.8 |
| Seed | 743 | 26.9 | 99.0 | 51% | 4.4 | 6.4 |
| Series A | 917 | 7.7 | 99.0 | 36% | 4.4 | 5.6 |
| Series B | 1350 | 9.3 | 99.0 | 37% | 3.7 | 10.6 |
| Series C | 2395 | 18.4 | 99.0 | 44% | 5.6 | 12.0 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 93 | 0 | 16% | 0.0 |
| Seed | 96 | 0 | 14% | 4.2 |
| Series A | 96 | 0 | 10% | 3.6 |
| Series B | 96 | 0 | 10% | 3.8 |
| Series C | 96 | 0 | 13% | 2.9 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 3.5 | 26.5 | 22.5 | 24 | 67 |
| vcRocket | 8 | 4 | 19 | 22.5 | 32.5 | 67.5 |
| niche | 8 | 3 | 12.5 | 11.5 | 17 | 30 |
| platform | 7 | 3 | 34.5 | 31.5 | 41.5 | 108.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 28% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 20 | 20 | usagePricing 10, paywall 3, templates 3, teamPlans 2, notifications 2, analytics 1, adminPanel 1, support 1, freemium 1 | feedback 37, notifications 30, usagePricing 27 | 63% (384 hafta) | 1 |
| vcRocket | 24/24 | 20 | 14 | aso 10, paywall 2, analytics 2, notifications 1, inAppPurchase 1, tabletApp 1, usagePricing 1, openApi 1, freemium 1, crashReports 1, widgets 1, onboarding 1, referral 1 | analytics 33, referral 30, abTest 29 | 62% (330 hafta) | 1 |
| niche | 24/24 | 10 | 10 | usagePricing 10, paywall 6, notifications 2, feedback 2, support 1, referral 1, webhooks 1, docs 1 | usageDashboard 19, usagePricing 18, docs 18 | 65% (369 hafta) | 0 |
| platform | 24/24 | 30 | 29 | paywall 5, usagePricing 3, notifications 3, openApi 2, referral 2, sellerDashboard 2, promotedListings 1, search 1, shipping 1, security 1, onboarding 1, reviews 1, support 1 | feedback 51, onboarding 44, support 41 | 65% (394 hafta) | 1 |
| careless | 24/24 | 18.5 | 88 | usagePricing 11, paywall 4, teamPlans 3, freemium 1, landingPages 1, templates 1, feedback 1, seo 1, openApi 1 | onboarding 30, usagePricing 29, feedback 28 | 96% (201 hafta) | 453.5 |
| coasterModules | 24/24 | 10 | 10 | usagePricing 10, paywall 10, integrations 2, teamPlans 1, onboarding 1 | landingPages 21, templates 16, adminPanel 16 | 64% (95 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 70.3 dk · 0 iflas | 24/24 · 61.8 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 77.0 dk · 0 iflas | 24/24 · 67.7 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 63.0 dk · 0 iflas | 24/24 · 56.0 dk · 0 iflas |
| ek kategori | platform | 24/24 · 72.3 dk · 0 iflas | 24/24 · 65.9 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 10

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = ağırlık × $karşılık × zevk − kira − maliyet / geri dönüş ayı (B2; para 12, büyüme 18, erişim 15, tutundurma 12 ay), $karşılık arayüzdeki `moduleEstimate`; zevk ve tür ağırlıkları seed ve bota göre değişir. Slot: v1 3, v2 6, v3 8, v4 9, v5+ 10. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 10 | 10 | 479 / 479 | 120 / 359 | 254 · 95 · 113 · 15 · 2 |
| vcRocket | 5 / 6 | 10 | 10 | 479 / 480 | 128 / 352 | 229 · 101 · 113 · 22 · 14 |
| niche | 5 / 6 | 10 | 10 | 240 / 240 | 64 / 176 | 117 · 50 · 62 · 8 · 3 |
| platform | 5 / 6 | 10 | 10 | 717 / 717 | 155 / 562 | 373 · 149 · 154 · 37 · 4 |
| careless | 6.5 / 10 | 9.5 | 9.5 | 444 / 444 | 93 / 351 | 225 · 103 · 104 · 12 · 0 |
| coasterModules | 6 / 10 | 10 | 10 | 239 / 240 | 49 / 190 | 123 · 41 · 58 · 13 · 4 |

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 67.7 dk | 0 |
| büyüme (vcRocket) | 24/24 | 67.5 dk | 0 |
| tutundurma (niche) | 23/24 | 68.0 dk | 1 |
| erişim (platform) | 24/24 | 69.4 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.03× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 24/24 | 71.0 dk | 0 | 24/24 · 81.7 dk | feedback 21, adminPanel 20, notifications 18, usagePricing 16, templates 16 |
| mobile | 24/24 | 76.7 dk | 0 | 24/24 · 80.1 dk | feedback 23, crashReports 20, notifications 17, paywall 17, aso 15 |
| api | 24/24 | 74.1 dk | 0 | 24/24 · 83.6 dk | rateLimit 22, slaPlans 20, usagePricing 18, usageDashboard 18, docs 15 |
| marketplace | 24/24 | 71.8 dk | 0 | 23/24 · 77.9 dk | search 23, payments 20, feedback 19, reviews 18, sellerDashboard 17 |
| ai | 24/24 | 58.7 dk | 0 | 24/24 · 67.0 dk | modelRouter 20, rag 19, evals 19, usagePricing 17, referral 16 |
| game | 23/24 | 66.1 dk | 0 | 20/24 · 78.3 dk | dailyRewards 22, feedback 20, notifications 19, leaderboard 16, guilds 15 |

Kategori × bot (tek kategori, Unicorn / seed · medyan):

| Kategori | bootstrap | vcRocket | niche | platform |
|---|---|---|---|---|
| web | 24/24 · 71.0 dk | 24/24 · 71.8 dk | 24/24 · 57.5 dk | 24/24 · 83.3 dk |
| mobile | 24/24 · 76.7 dk | 24/24 · 77.7 dk | 24/24 · 64.0 dk | 23/24 · 87.0 dk |
| api | 24/24 · 74.1 dk | 24/24 · 72.9 dk | 24/24 · 61.8 dk | 24/24 · 89.6 dk |
| marketplace | 24/24 · 71.8 dk | 24/24 · 73.8 dk | 24/24 · 60.0 dk | 23/24 · 86.5 dk |
| ai | 24/24 · 58.7 dk | 24/24 · 60.3 dk | 24/24 · 49.0 dk | 24/24 · 68.6 dk |
| game | 23/24 · 66.1 dk | 23/24 · 67.0 dk | 24/24 · 63.1 dk | 23/24 · 74.3 dk |

Her kategori her botta ≥ 21/24 Unicorn: **EVET**

Modül yoğunlaşması (B2): koşu sonunda kategorinin projelerinin kaçında kurulu; arketip koşuları + kategori × bot turu. Hedef: hiçbir modül > %80, en az 40/65 modül kullanılmış.

| Kategori | Proje | > %80 | En sık 5 | İlk 3 seçim (farklı küme) |
|---|---|---|---|---|
| web | 144 | — | feedback 76%, adminPanel 74%, notifications 64%, templates 64%, usagePricing 62% | 97/144 |
| api | 168 | — | slaPlans 73%, usageDashboard 71%, usagePricing 70%, webhooks 66%, docs 62% | 105/168 |
| mobile | 120 | — | feedback 75%, aso 73%, offlineMode 68%, paywall 63%, deepLinks 61% | 82/120 |
| ai | 120 | — | evals 71%, usagePricing 70%, feedback 67%, rag 67%, referral 62% | 84/120 |
| marketplace | 120 | payments | payments 85%, reviews 73%, feedback 72%, search 70%, sellerDashboard 68% | 96/120 |
| game | 96 | — | feedback 78%, leaderboard 74%, dailyRewards 72%, liveEvents 68%, notifications 61% | 68/96 |

Kullanılan modül: 64/65 (kurulmayan: cityLaunch). Yalnız arketip koşularında (kategorileri sabit, bilgi): > %80 olan 3 modül · web — · api — · mobile aso/deepLinks · ai — · marketplace reviews.

Plan seçimleri (B2 inceleme): kategori × bot turunda yalnız botun karttaki tahmine göre seçtiği modüller (slot doldurucunun çekilişi hariç); pay = planın seçtiği koşu / plan seçimi olan koşu.

| Kategori | Plan payı (kurulan) | Plan seçimi olan koşu | > %80 | En sık 5 plan seçimi |
|---|---|---|---|---|
| web | 23% | 95/96 | — | usagePricing 61%, adminPanel 42%, abTest 34%, paywall 27%, teamPlans 26% |
| mobile | 19% | 91/96 | — | paywall 63%, abTest 41%, aso 27%, inAppPurchase 23%, deepLinks 19% |
| api | 23% | 94/96 | — | usagePricing 65%, abTest 34%, slaPlans 34%, usageDashboard 33%, paywall 24% |
| marketplace | 31% | 96/96 | — | paywall 58%, payments 47%, search 41%, recommendations 40%, abTest 33% |
| ai | 24% | 95/96 | — | usagePricing 71%, abTest 40%, fineTune 29%, paywall 25%, aiAssistant 22% |
| game | 23% | 95/96 | — | paywall 58%, battlePass 53%, abTest 39%, shop 34%, aiAssistant 11% |

Kapsam: 63/65 modül en az bir koşuda kuruldu; kurulmayan: esports, cityLaunch.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 4 / 5 | 23% | 8% | 50 | 0 | 799 | 68 | 7.0 dk / 7.0 dk · 15.6 dk / 15.8 dk · 26.0 dk / 27.5 dk · 67.7 dk / 72.8 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 16% | 10% | 57 | 24 | 850 | 56 | 7.3 dk / 7.3 dk · 13.4 dk / 14.3 dk · 21.8 dk / 21.7 dk · 56.0 dk / 59.7 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 32% | 5% | 24 | 0 | 399 | 69 | 6.3 dk / 6.3 dk · 14.6 dk / 15.4 dk · 24.3 dk / 25.9 dk · 61.8 dk / 62.9 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 16% | 10% | 74 | 0 | 959 | 61 | 7.4 dk / 7.4 dk · 15.1 dk / 15.2 dk · 24.9 dk / 26.8 dk · 65.9 dk / 78.6 dk |
| careless | 0 / 0 / 5 | 1 | 3 / 5 | 31% | 1% | 0 | 0 | 256 | 62 | 6.3 dk · 14.8 dk · 117.0 dk · — |
| greedyGood | 0 / 0 / 0 | 0 | 5 / 5 | 16% | 10% | 73 | 54 | 817 | 65 | 6.2 dk · 10.6 dk · 19.2 dk · 56.4 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 5 (hedef ≥ 2) · Seed morali medyan 62 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 216.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 23/24 | 59% | 81% | 15% |
| coasterModules | 0/24 | — | 22/24 | 64% | 82% | 14% |
| idleAfterProfit | 0/24 | — | 1/24 | 93% | 81% | 3% |
| greedyGood | 24/24 | 56.4 dk | 0/24 | 14% | 0% | 8% |
| burner | 24/24 | 63.1 dk | 0/24 | 30% | 0% | 7% |
| frugal | 24/24 | 74.7 dk | 0/24 | 73% | 0% | 6% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 3% | 0% | 66% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 75.5 KB · maks 102.7 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 55–90 dk: medyanlar 67.7 / 56.0 / 61.8 / 65.9 dk → **hedef aralıkta**; arketip farkı 1.21× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 51% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %10 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 8 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Modül yoğunlaşması (B2): kategori projelerinin > %80’inde olan modül 1 (hedef 0) · marketplace/payments 85%: **HAYIR**
- Kullanılan modül (B2): 64/65 (hedef ≥ 40): **EVET**
- Plan seçimlerinde yoğunlaşma (B2 inceleme; karttaki tahmine göre seçen oyuncu): plan seçimi olan koşuların > %80’inde seçilen modül 0 (hedef 0) · plan payı 24% (bilgi): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 81% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 63.1 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 63.1 dk (%138): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 63.1 dk ↔ 74.7 dk (%16): **EVET**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 31% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 93/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 32% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.4 (3–6) · Series A 4.4 (4–8) · Series B 3.7 (5–9) · Series C 5.6 (6–10): **HAYIR** (2/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 38% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 2.9 (hedef 20–40) · hız çarpanı 0.94 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 83/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–90 dk ve fark ≤ 1.6×: 67.7 / 56.0 / 61.8 / 65.9 dk · 1.21×: **EVET**
- Kayıt boyutu medyan 75.5 KB (hedef < 70) · maks 102.7 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3108 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 30
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.4 ↔ hazırlanmayan 5.2 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 378/378
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1033 kriz): 3% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 35.3 ↔ kriz içeriği olmadan aynı seed'ler 30.2 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 18.6 ↔ 17.2 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 63.1 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 58.0 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 1/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 1 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.06
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 140/1244 (hedef %30–50 → 374–622/1244): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C, çeyrek): 8/16 (hedef ≥ %80 → 13–16/16): **HAYIR** · A'ya ulaşan 1/24
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 3.3 (hedef 4–10) · yenilenen 99% (hedef ≥ %60): **HAYIR** · koşu başına 0–12 · satıcılar (bootstrap + niche, 48 koşu) 6.6
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 1/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 20/500 (hedef %10–20 → 50–100/500): **HAYIR** · down round 20 · kredi çağrısı 0
- Bilgi: careless: kredi 11/24 · çağrı 0 · düşen tur 6 · down round 5 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 1 · down round 1 · iplik adımı / koşu (iyi, medyan) 10
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 19/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 1/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 19/19 (hedef ≥ %60 → 12–19/19): **EVET** · n = 19
- Bilgi (maaş masası): iyi botlar masa 115 · erteleme 115 · careless masa 18 · erteleme 16 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.5 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 75 (hedef ≤ 80): **EVET** · medyan 25.5 · 80'i aşan 0/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 85% / 80% / 79% / 78% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 96 · founder-no-pay 89 · lean-office 96 · deferred-pay 40 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı salary-freeze, lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 22/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 11 · team-mutiny 0 · rival-dies 2 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 4556.4 sn · `npm run sim -- --seeds 24 --days 4500`_
