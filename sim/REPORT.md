# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.5 dk · g135 (24/24) | 7.0 dk · g211 (24/24) | 15.8 dk · g476 (24/24) | 26.5 dk · g795 (24/24) | 39.1 dk · g1174 (24/24) | 68.6 dk · g2058 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.3 dk · g220 (24/24) | 13.8 dk · g415 (24/24) | 21.7 dk · g652 (24/24) | 35.7 dk · g1072 (24/24) | 58.2 dk · g1746 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.4 dk · g192 (24/24) | 14.6 dk · g437 (24/24) | 22.6 dk · g677 (24/24) | 40.0 dk · g1200 (24/24) | 61.2 dk · g1837 (24/24) |
| platform | 4.5 dk · g135 (24/24) | 7.3 dk · g219 (24/24) | 15.2 dk · g457 (24/24) | 25.2 dk · g755 (24/24) | 38.3 dk · g1149 (24/24) | 65.8 dk · g1975 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %46 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %33 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 9 | %48 | 36 |
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
| bootstrap | founderAction:talkToUsers 260.5 | 255 | 14 sn / 14 sn | 0.24× |
| vcRocket | founderAction:talkToUsers 337 | 334 | 14 sn / 39 sn | 0.32× |
| niche | founderAction:findUsers 212 | 212 | 14 sn / 32 sn | 0.30× |
| platform | founderAction:talkToUsers 281 | 264 | 14 sn / 40 sn | 0.23× |

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
| best | 68.6 dk | 24/24 | 0% | %46 |
| worst | 63.2 dk | 21/24 | 0% | %38 |
| first | 65.3 dk | 24/24 | 0% | %40 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 79.1 dk · %57 · 24/24 | 68.6 dk · %46 · 24/24 | 63.6 dk · %36 · 24/24 | %24 | — |
| vcRocket | 78.3 dk · %55 · 24/24 | 62.4 dk · %43 · 24/24 | 58.2 dk · %33 · 24/24 | %35 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 67.9 dk · %44 | 68.6 dk · %46 | hayır |
| platform | 64.5 dk · %44 | 65.8 dk · %44 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 19% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 39% · tablo tavanı 0% · tablo tabanı 61%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 408 | 0.8 | 2.0 | 0% | 0.0 | 1.2 |
| Pre-seed | 229 | 5.8 | 42.0 | 22% | 3.7 | 5.8 |
| Seed | 733 | 23.6 | 99.0 | 50% | 4.5 | 6.5 |
| Series A | 931 | 7.9 | 99.0 | 37% | 4.4 | 6.0 |
| Series B | 1371 | 8.9 | 99.0 | 36% | 3.6 | 6.9 |
| Series C | 2399 | 17.3 | 99.0 | 42% | 5.6 | 10.6 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 95 | 0 | 17% | 0.0 |
| Seed | 96 | 0 | 13% | 3.6 |
| Series A | 96 | 0 | 10% | 3.2 |
| Series B | 96 | 0 | 10% | 4.3 |
| Series C | 96 | 0 | 13% | 2.8 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 4 | 25 | 22 | 24 | 66 |
| vcRocket | 8 | 4 | 19 | 23 | 31 | 72 |
| niche | 8 | 3 | 13 | 11 | 17 | 30.5 |
| platform | 7 | 3 | 33.5 | 32.5 | 48 | 108.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 27% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 20 | 19.5 | usagePricing 12, paywall 4, teamPlans 3, notifications 2, adminPanel 1, support 1, templates 1 | feedback 37, usagePricing 29, support 28 | 66% (367 hafta) | 1 |
| vcRocket | 24/24 | 20 | 14 | aso 8, analytics 3, referral 2, notifications 1, inAppPurchase 1, deepLinks 1, paywall 1, support 1, usagePricing 1, openApi 1, freemium 1, evals 1, widgets 1, feedback 1 | referral 38, feedback 33, analytics 31 | 58% (343 hafta) | 1 |
| niche | 24/24 | 10 | 10 | usagePricing 10, paywall 4, notifications 3, support 2, docs 2, feedback 2, webhooks 1 | notifications 18, docs 18, usageDashboard 18 | 62% (386 hafta) | 0 |
| platform | 24/24 | 30 | 28 | notifications 5, paywall 4, referral 3, usagePricing 2, payments 2, onboarding 2, sellerDashboard 1, feedback 1, search 1, security 1, freemium 1, reviews 1 | feedback 50, notifications 43, referral 43 | 63% (389 hafta) | 1 |
| careless | 24/24 | 19 | 88 | usagePricing 13, teamPlans 3, analytics 2, paywall 2, referral 1, landingPages 1, feedback 1, seo 1 | usagePricing 30, feedback 29, onboarding 29 | 95% (192 hafta) | 451 |
| coasterModules | 24/24 | 10 | 10.5 | usagePricing 10, paywall 10, integrations 2, templates 1, onboarding 1 | adminPanel 17, landingPages 17, support 16 | 62% (97 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 71.3 dk · 0 iflas | 24/24 · 61.2 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 78.2 dk · 0 iflas | 24/24 · 68.6 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 63.9 dk · 0 iflas | 24/24 · 58.2 dk · 0 iflas |
| ek kategori | platform | 24/24 · 71.1 dk · 0 iflas | 24/24 · 65.8 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 10

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = ağırlık × $karşılık × zevk − kira − maliyet / geri dönüş ayı (B2; para 12, büyüme 18, erişim 15, tutundurma 12 ay), $karşılık arayüzdeki `moduleEstimate`; zevk ve tür ağırlıkları seed ve bota göre değişir. Slot: v1 3, v2 6, v3 8, v4 9, v5+ 10. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 10 | 10 | 478 / 479 | 124 / 355 | 258 · 90 · 117 · 12 · 1 |
| vcRocket | 5 / 6 | 10 | 10 | 480 / 480 | 121 / 359 | 244 · 94 · 104 · 22 · 16 |
| niche | 5 / 6 | 10 | 10 | 240 / 240 | 60 / 180 | 118 · 56 · 55 · 9 · 2 |
| platform | 5 / 6 | 10 | 10 | 715 / 717 | 151 / 565 | 371 · 153 · 160 · 27 · 4 |
| careless | 6.5 / 10 | 9.5 | 9.5 | 449 / 450 | 103 / 347 | 233 · 93 · 106 · 16 · 1 |
| coasterModules | 5.5 / 9 | 10 | 10 | 238 / 239 | 47 / 191 | 114 · 43 · 60 · 18 · 3 |

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 68.6 dk | 0 |
| büyüme (vcRocket) | 24/24 | 66.3 dk | 0 |
| tutundurma (niche) | 24/24 | 68.3 dk | 0 |
| erişim (platform) | 24/24 | 68.2 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.03× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 24/24 | 70.6 dk | 0 | 24/24 · 80.5 dk | adminPanel 22, feedback 17, notifications 17, landingPages 15, usagePricing 14 |
| mobile | 24/24 | 77.6 dk | 0 | 24/24 · 77.8 dk | aso 21, feedback 19, crashReports 18, paywall 17, offlineMode 15 |
| api | 24/24 | 73.2 dk | 0 | 24/24 · 86.2 dk | slaPlans 22, rateLimit 22, sdks 17, docs 17, usageDashboard 17 |
| marketplace | 24/24 | 73.6 dk | 0 | 23/24 · 77.8 dk | payments 23, search 20, reviews 16, notifications 16, feedback 16 |
| ai | 24/24 | 59.1 dk | 0 | 24/24 · 65.9 dk | evals 20, usagePricing 18, modelRouter 18, feedback 17, referral 16 |
| game | 24/24 | 68.9 dk | 0 | 22/24 · 74.7 dk | dailyRewards 19, liveEvents 18, notifications 18, feedback 18, leaderboard 18 |

Kategori × bot (tek kategori, Unicorn / seed · medyan):

| Kategori | bootstrap | vcRocket | niche | platform |
|---|---|---|---|---|
| web | 24/24 · 70.6 dk | 24/24 · 73.2 dk | 24/24 · 58.5 dk | 24/24 · 83.5 dk |
| mobile | 24/24 · 77.6 dk | 23/24 · 79.5 dk | 24/24 · 62.9 dk | 23/24 · 86.9 dk |
| api | 24/24 · 73.2 dk | 24/24 · 72.2 dk | 24/24 · 61.2 dk | 24/24 · 91.9 dk |
| marketplace | 24/24 · 73.6 dk | 24/24 · 72.4 dk | 24/24 · 57.8 dk | 24/24 · 89.2 dk |
| ai | 24/24 · 59.1 dk | 24/24 · 60.5 dk | 24/24 · 48.6 dk | 24/24 · 69.2 dk |
| game | 24/24 · 68.9 dk | 24/24 · 70.2 dk | 24/24 · 58.5 dk | 24/24 · 71.9 dk |

Her kategori her botta ≥ 21/24 Unicorn: **EVET**

Modül yoğunlaşması (B2): koşu sonunda kategorinin projelerinin kaçında kurulu; arketip koşuları + kategori × bot turu. Hedef: hiçbir modül > %80, en az 40/65 modül kullanılmış.

| Kategori | Proje | > %80 | En sık 5 | İlk 3 seçim (farklı küme) |
|---|---|---|---|---|
| web | 144 | — | adminPanel 75%, feedback 73%, templates 65%, notifications 63%, seo 62% | 91/144 |
| api | 168 | — | slaPlans 72%, usagePricing 67%, docs 67%, feedback 65%, usageDashboard 65% | 108/168 |
| mobile | 120 | — | feedback 72%, aso 68%, offlineMode 67%, paywall 64%, support 64% | 87/120 |
| ai | 120 | — | feedback 74%, usagePricing 72%, evals 72%, referral 68%, onboarding 62% | 79/120 |
| marketplace | 120 | payments | payments 91%, feedback 70%, reviews 69%, search 69%, paywall 61% | 86/120 |
| game | 96 | — | feedback 76%, leaderboard 75%, dailyRewards 73%, notifications 68%, liveEvents 66% | 60/96 |

Kullanılan modül: 64/65 (kurulmayan: esports). Yalnız arketip koşularında (kategorileri sabit, bilgi): > %80 olan 3 modül · web — · api — · mobile aso · ai referral · marketplace payments.

Plan seçimleri (B2 inceleme): kategori × bot turunda yalnız botun karttaki tahmine göre seçtiği modüller (slot doldurucunun çekilişi hariç); pay = planın seçtiği koşu / plan seçimi olan koşu.

| Kategori | Plan payı (kurulan) | Plan seçimi olan koşu | > %80 | En sık 5 plan seçimi |
|---|---|---|---|---|
| web | 23% | 95/96 | — | usagePricing 61%, adminPanel 47%, paywall 28%, abTest 28%, teamPlans 23% |
| mobile | 19% | 93/96 | — | paywall 58%, abTest 34%, aso 30%, inAppPurchase 28%, deepLinks 13% |
| api | 23% | 96/96 | — | usagePricing 65%, slaPlans 34%, abTest 27%, paywall 26%, usageDashboard 21% |
| marketplace | 30% | 96/96 | — | paywall 54%, payments 54%, search 44%, recommendations 39%, abTest 31% |
| ai | 25% | 95/96 | — | usagePricing 73%, abTest 40%, fineTune 29%, paywall 23%, aiAssistant 19% |
| game | 24% | 96/96 | — | paywall 60%, battlePass 55%, abTest 39%, shop 30%, aiAssistant 13% |

Kapsam: 62/65 modül en az bir koşuda kuruldu; kurulmayan: ugcEditor, crossPlay, esports.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 3 / 5 | 23% | 8% | 51 | 0 | 750 | 68 | 7.0 dk / 7.0 dk · 15.8 dk / 16.6 dk · 26.5 dk / 27.1 dk · 68.6 dk / 68.8 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 14% | 10% | 55 | 24 | 842 | 56 | 7.3 dk / 7.3 dk · 13.8 dk / 14.3 dk · 21.7 dk / 23.1 dk · 58.2 dk / 59.6 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 32% | 5% | 24 | 0 | 409 | 69 | 6.4 dk / 6.4 dk · 14.6 dk / 15.2 dk · 22.6 dk / 24.3 dk · 61.2 dk / 62.7 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 16% | 10% | 75 | 0 | 983 | 62 | 7.3 dk / 7.3 dk · 15.2 dk / 15.4 dk · 25.2 dk / 26.6 dk · 65.8 dk / 82.7 dk |
| careless | 0 / 0 / 5 | 13 | 3 / 5 | 31% | 1% | 0 | 0 | 418 | 63 | 6.3 dk · 14.6 dk · 85.7 dk · — |
| greedyGood | 0 / 0 / 0 | 0 | 4 / 5 | 18% | 8% | 74 | 56 | 689 | 65 | 6.0 dk · 10.8 dk · 19.5 dk · 56.1 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 5 (hedef ≥ 2) · Seed morali medyan 63 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 216.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 24/24 | 61% | 82% | 16% |
| coasterModules | 0/24 | — | 23/24 | 64% | 82% | 15% |
| idleAfterProfit | 0/24 | — | 1/24 | 93% | 18% | 3% |
| greedyGood | 24/24 | 56.1 dk | 0/24 | 14% | 0% | 8% |
| burner | 24/24 | 64.9 dk | 0/24 | 29% | 0% | 7% |
| frugal | 24/24 | 72.5 dk | 0/24 | 72% | 0% | 6% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 5% | 0% | 63% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 78.1 KB · maks 105.7 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 55–90 dk: medyanlar 68.6 / 58.2 / 61.2 / 65.8 dk → **hedef aralıkta**; arketip farkı 1.18× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 50% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %9 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 8 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Modül yoğunlaşması (B2): kategori projelerinin > %80’inde olan modül 1 (hedef 0) · marketplace/payments 91%: **HAYIR**
- Kullanılan modül (B2): 64/65 (hedef ≥ 40): **EVET**
- Plan seçimlerinde yoğunlaşma (B2 inceleme; karttaki tahmine göre seçen oyuncu): plan seçimi olan koşuların > %80’inde seçilen modül 0 (hedef 0) · plan payı 24% (bilgi): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 18% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 63.6 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 63.6 dk (%136): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 64.9 dk ↔ 72.5 dk (%10): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 30% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 95/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 31% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.5 (3–6) · Series A 4.4 (4–8) · Series B 3.6 (5–9) · Series C 5.6 (6–10): **HAYIR** (2/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 37% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 2.8 (hedef 20–40) · hız çarpanı 0.94 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 81/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–90 dk ve fark ≤ 1.6×: 68.6 / 58.2 / 61.2 / 65.8 dk · 1.18×: **EVET**
- Kayıt boyutu medyan 78.1 KB (hedef < 70) · maks 105.7 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3104 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 20
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.6 ↔ hazırlanmayan 5.4 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 384/384
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1033 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 35.3 ↔ kriz içeriği olmadan aynı seed'ler 30.5 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 18.5 ↔ 17.2 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 63.6 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 58.7 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 1/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 1 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.05
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 150/1253 (hedef %30–50 → 376–626/1253): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 3.4 (hedef 4–10) · yenilenen 99% (hedef ≥ %60): **HAYIR** · koşu başına 0–11 · satıcılar (bootstrap + niche, 48 koşu) 6.8
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 0/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 0/0 (hedef ≥ %50 → 0–0/0): **EVET** (kredi alan yok)
- Düşen tur payı, iyi botlar (tur denemesi): 20/500 (hedef %10–20 → 50–100/500): **HAYIR** · down round 18 · kredi çağrısı 0
- Bilgi: careless: kredi 14/24 · çağrı 0 · düşen tur 5 · down round 4 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 7 · down round 4 · iplik adımı / koşu (iyi, medyan) 10
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 12/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 1/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 12/12 (hedef ≥ %60 → 8–12/12): **EVET** · n = 12
- Bilgi (maaş masası): iyi botlar masa 113 · erteleme 113 · careless masa 18 · erteleme 16 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.4 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 73 (hedef ≤ 80): **EVET** · medyan 25 · 80'i aşan 0/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 85% / 80% / 80% / 78% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 93 · founder-no-pay 90 · lean-office 96 · deferred-pay 41 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 20/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 7 · team-mutiny 0 · rival-dies 1 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 3922.3 sn · `npm run sim -- --seeds 24 --days 4500`_
