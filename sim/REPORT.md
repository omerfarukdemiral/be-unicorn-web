# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.5 dk · g135 (24/24) | 7.0 dk · g211 (24/24) | 15.8 dk · g475 (24/24) | 26.4 dk · g791 (24/24) | 38.1 dk · g1143 (24/24) | 67.8 dk · g2035 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.3 dk · g220 (24/24) | 13.9 dk · g418 (24/24) | 22.0 dk · g660 (24/24) | 35.7 dk · g1072 (24/24) | 56.7 dk · g1701 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.4 dk · g192 (24/24) | 14.6 dk · g437 (24/24) | 22.8 dk · g685 (24/24) | 40.6 dk · g1219 (24/24) | 61.4 dk · g1842 (24/24) |
| platform | 4.5 dk · g135 (24/24) | 7.3 dk · g219 (24/24) | 15.0 dk · g451 (24/24) | 25.4 dk · g764 (24/24) | 38.9 dk · g1166 (24/24) | 65.5 dk · g1964 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %46 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %33 | 36 |
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
| bootstrap | founderAction:talkToUsers 259 | 253 | 14 sn / 14 sn | 0.24× |
| vcRocket | founderAction:talkToUsers 327.5 | 319.5 | 14 sn / 39 sn | 0.34× |
| niche | founderAction:findUsers 215.5 | 215.5 | 14 sn / 32 sn | 0.30× |
| platform | founderAction:talkToUsers 279.5 | 264.5 | 14 sn / 40 sn | 0.23× |

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
| best | 67.8 dk | 24/24 | 0% | %46 |
| worst | 62.3 dk | 21/24 | 0% | %38 |
| first | 65.6 dk | 24/24 | 0% | %38 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 78.4 dk · %57 · 24/24 | 67.8 dk · %46 · 24/24 | 64.0 dk · %36 · 24/24 | %22 | — |
| vcRocket | 76.8 dk · %55 · 24/24 | 62.7 dk · %43 · 24/24 | 56.7 dk · %33 · 24/24 | %35 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 67.5 dk · %45 | 67.8 dk · %46 | hayır |
| platform | 65.0 dk · %44 | 65.5 dk · %44 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 19% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 41% · tablo tavanı 0% · tablo tabanı 59%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 408 | 0.8 | 2.0 | 0% | 0.0 | 1.2 |
| Pre-seed | 229 | 5.8 | 42.0 | 22% | 3.7 | 5.8 |
| Seed | 731 | 22.3 | 99.0 | 49% | 4.5 | 6.5 |
| Series A | 941 | 8.1 | 99.0 | 37% | 4.4 | 5.9 |
| Series B | 1370 | 8.9 | 99.0 | 35% | 3.7 | 7.7 |
| Series C | 2353 | 17.8 | 99.0 | 44% | 6.0 | 10.7 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 95 | 0 | 17% | 0.0 |
| Seed | 96 | 0 | 13% | 3.7 |
| Series A | 96 | 0 | 10% | 3.4 |
| Series B | 96 | 0 | 10% | 3.7 |
| Series C | 96 | 0 | 13% | 2.4 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 4 | 25 | 21.5 | 22.5 | 65 |
| vcRocket | 8 | 4 | 19.5 | 22.5 | 33 | 68.5 |
| niche | 8 | 3 | 13 | 11 | 16.5 | 31 |
| platform | 7 | 3 | 33 | 38 | 46 | 107.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 28% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 20 | 20 | usagePricing 12, paywall 4, teamPlans 3, notifications 2, adminPanel 1, support 1, templates 1 | feedback 37, usagePricing 29, referral 27 | 67% (368 hafta) | 1 |
| vcRocket | 24/24 | 20 | 17 | aso 8, analytics 3, referral 2, notifications 1, inAppPurchase 1, deepLinks 1, paywall 1, support 1, usagePricing 1, openApi 1, freemium 1, evals 1, widgets 1, feedback 1 | analytics 35, referral 33, abTest 33 | 58% (343 hafta) | 1 |
| niche | 24/24 | 10 | 10 | usagePricing 10, paywall 4, notifications 3, support 2, docs 2, feedback 2, webhooks 1 | docs 19, notifications 18, usageDashboard 18 | 61% (378 hafta) | 0 |
| platform | 24/24 | 30 | 28.5 | notifications 5, paywall 4, referral 3, usagePricing 2, payments 2, onboarding 2, sellerDashboard 1, feedback 1, search 1, security 1, freemium 1, reviews 1 | feedback 53, referral 46, notifications 44 | 65% (394 hafta) | 1 |
| careless | 24/24 | 19 | 90 | usagePricing 13, teamPlans 3, analytics 2, paywall 2, referral 1, landingPages 1, feedback 1, notifications 1 | feedback 31, usagePricing 30, onboarding 30 | 95% (194 hafta) | 448 |
| coasterModules | 24/24 | 10 | 12 | usagePricing 10, paywall 10, integrations 2, templates 1, onboarding 1 | landingPages 19, adminPanel 16, templates 16 | 62% (97 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 72.6 dk · 0 iflas | 24/24 · 61.4 dk · 0 iflas |
| ek kategori | bootstrap | 24/24 · 79.1 dk · 0 iflas | 24/24 · 67.8 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 64.2 dk · 0 iflas | 24/24 · 56.7 dk · 0 iflas |
| ek kategori | platform | 24/24 · 74.1 dk · 0 iflas | 24/24 · 65.5 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 10

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = ağırlık × $karşılık × zevk − kira − maliyet / geri dönüş ayı (B2; para 12, büyüme 18, erişim 15, tutundurma 12 ay), $karşılık arayüzdeki `moduleEstimate`; zevk ve tür ağırlıkları seed ve bota göre değişir. Slot: v1 3, v2 6, v3 8, v4 9, v5+ 10. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 10 | 10 | 478 / 479 | 125 / 353 | 258 · 86 · 117 · 14 · 3 |
| vcRocket | 5 / 6 | 10 | 10 | 480 / 480 | 122 / 358 | 240 · 97 · 103 · 24 · 16 |
| niche | 5 / 6 | 10 | 10 | 240 / 240 | 61 / 179 | 120 · 56 · 54 · 8 · 2 |
| platform | 5 / 6 | 10 | 10 | 716 / 717 | 160 / 556 | 376 · 161 · 153 · 20 · 6 |
| careless | 6.5 / 10 | 9.5 | 9.5 | 449 / 450 | 107 / 343 | 231 · 96 · 103 · 19 · 0 |
| coasterModules | 6 / 9 | 10 | 10 | 239 / 239 | 45 / 194 | 116 · 45 · 57 · 18 · 3 |

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 67.8 dk | 0 |
| büyüme (vcRocket) | 24/24 | 67.0 dk | 0 |
| tutundurma (niche) | 24/24 | 69.6 dk | 0 |
| erişim (platform) | 24/24 | 69.0 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.04× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 24/24 | 69.2 dk | 0 | 24/24 · 80.6 dk | adminPanel 21, feedback 19, landingPages 17, notifications 17, seo 15 |
| mobile | 24/24 | 76.0 dk | 0 | 21/24 · 80.9 dk | crashReports 23, feedback 19, aso 17, paywall 17, analytics 15 |
| api | 24/24 | 72.0 dk | 0 | 24/24 · 84.9 dk | rateLimit 23, slaPlans 22, docs 18, usagePricing 17, usageDashboard 16 |
| marketplace | 24/24 | 72.9 dk | 0 | 24/24 · 77.9 dk | payments 23, search 19, reviews 17, feedback 15, notifications 14 |
| ai | 24/24 | 59.7 dk | 0 | 24/24 · 68.4 dk | modelRouter 19, feedback 19, evals 19, usagePricing 18, rag 15 |
| game | 24/24 | 66.3 dk | 0 | 23/24 · 75.7 dk | dailyRewards 21, leaderboard 19, liveEvents 18, support 18, feedback 17 |

Kategori × bot (tek kategori, Unicorn / seed · medyan):

| Kategori | bootstrap | vcRocket | niche | platform |
|---|---|---|---|---|
| web | 24/24 · 69.2 dk | 23/24 · 74.9 dk | 24/24 · 58.1 dk | 24/24 · 84.1 dk |
| mobile | 24/24 · 76.0 dk | 24/24 · 81.4 dk | 24/24 · 64.1 dk | 24/24 · 89.8 dk |
| api | 24/24 · 72.0 dk | 24/24 · 72.3 dk | 24/24 · 61.4 dk | 24/24 · 89.5 dk |
| marketplace | 24/24 · 72.9 dk | 24/24 · 75.1 dk | 24/24 · 58.2 dk | 23/24 · 86.4 dk |
| ai | 24/24 · 59.7 dk | 24/24 · 60.9 dk | 24/24 · 48.3 dk | 24/24 · 69.3 dk |
| game | 24/24 · 66.3 dk | 24/24 · 68.2 dk | 24/24 · 60.6 dk | 24/24 · 73.8 dk |

Her kategori her botta ≥ 21/24 Unicorn: **EVET**

Modül yoğunlaşması (B2): koşu sonunda kategorinin projelerinin kaçında kurulu; arketip koşuları + kategori × bot turu. Hedef: hiçbir modül > %80, en az 40/65 modül kullanılmış.

| Kategori | Proje | > %80 | En sık 5 | İlk 3 seçim (farklı küme) |
|---|---|---|---|---|
| web | 144 | — | feedback 76%, adminPanel 76%, seo 64%, notifications 64%, templates 64% | 92/144 |
| api | 168 | — | slaPlans 72%, docs 70%, usagePricing 68%, webhooks 68%, feedback 66% | 108/168 |
| mobile | 120 | — | aso 68%, feedback 68%, offlineMode 65%, paywall 64%, support 63% | 84/120 |
| ai | 120 | — | feedback 76%, evals 74%, usagePricing 72%, support 67%, rag 63% | 81/120 |
| marketplace | 120 | payments | payments 90%, reviews 73%, feedback 72%, search 68%, paywall 61% | 85/120 |
| game | 96 | — | feedback 76%, leaderboard 74%, dailyRewards 73%, notifications 67%, liveEvents 66% | 60/96 |

Kullanılan modül: 65/65. Yalnız arketip koşularında (kategorileri sabit, bilgi): > %80 olan 4 modül · web feedback · api — · mobile aso · ai analytics · marketplace payments.

Plan seçimleri (B2 inceleme): kategori × bot turunda yalnız botun karttaki tahmine göre seçtiği modüller (slot doldurucunun çekilişi hariç); pay = planın seçtiği koşu / plan seçimi olan koşu.

| Kategori | Plan payı (kurulan) | Plan seçimi olan koşu | > %80 | En sık 5 plan seçimi |
|---|---|---|---|---|
| web | 23% | 94/96 | — | usagePricing 63%, adminPanel 52%, paywall 28%, abTest 27%, teamPlans 23% |
| mobile | 19% | 92/96 | — | paywall 59%, abTest 41%, aso 29%, inAppPurchase 28%, deepLinks 14% |
| api | 23% | 95/96 | — | usagePricing 67%, abTest 34%, slaPlans 33%, paywall 25%, usageDashboard 24% |
| marketplace | 31% | 95/96 | — | payments 56%, paywall 55%, search 40%, recommendations 39%, abTest 35% |
| ai | 24% | 95/96 | — | usagePricing 74%, abTest 40%, fineTune 28%, paywall 22%, modelRouter 17% |
| game | 23% | 95/96 | — | paywall 60%, battlePass 57%, abTest 34%, shop 31%, aiAssistant 12% |

Kapsam: 64/65 modül en az bir koşuda kuruldu; kurulmayan: esports.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 3 / 5 | 23% | 8% | 51 | 0 | 751 | 69 | 7.0 dk / 7.0 dk · 15.8 dk / 16.6 dk · 26.4 dk / 27.1 dk · 67.8 dk / 70.5 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 15% | 10% | 54 | 24 | 774 | 57 | 7.3 dk / 7.3 dk · 13.9 dk / 14.3 dk · 22.0 dk / 22.0 dk · 56.7 dk / 58.3 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 32% | 5% | 24 | 0 | 406 | 68 | 6.4 dk / 6.4 dk · 14.6 dk / 15.3 dk · 22.8 dk / 24.3 dk · 61.4 dk / 62.4 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 17% | 9% | 73 | 0 | 875 | 64 | 7.3 dk / 7.3 dk · 15.0 dk / 15.1 dk · 25.4 dk / 26.5 dk · 65.5 dk / 78.8 dk |
| careless | 0 / 0 / 6 | 4 | 3 / 5 | 28% | 2% | 0 | 0 | 566 | 63 | 6.3 dk · 14.6 dk · 72.0 dk · — |
| greedyGood | 0 / 0 / 0 | 0 | 4 / 5 | 16% | 10% | 75 | 55 | 926 | 65 | 6.0 dk · 10.7 dk · 19.7 dk · 56.8 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 6 (hedef ≥ 2) · Seed morali medyan 63 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 216.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 23/24 | 62% | 82% | 15% |
| coasterModules | 0/24 | — | 23/24 | 63% | 82% | 15% |
| idleAfterProfit | 0/24 | — | 1/24 | 93% | 18% | 3% |
| greedyGood | 24/24 | 56.8 dk | 0/24 | 14% | 0% | 8% |
| burner | 24/24 | 63.6 dk | 0/24 | 29% | 0% | 7% |
| frugal | 24/24 | 73.8 dk | 0/24 | 73% | 0% | 6% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 5% | 0% | 62% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 78.1 KB · maks 106.9 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 55–90 dk: medyanlar 67.8 / 56.7 / 61.4 / 65.5 dk → **hedef aralıkta**; arketip farkı 1.20× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 49% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %9 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 9 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Modül yoğunlaşması (B2): kategori projelerinin > %80’inde olan modül 1 (hedef 0) · marketplace/payments 90%: **HAYIR**
- Kullanılan modül (B2): 65/65 (hedef ≥ 40): **EVET**
- Plan seçimlerinde yoğunlaşma (B2 inceleme; karttaki tahmine göre seçen oyuncu): plan seçimi olan koşuların > %80’inde seçilen modül 0 (hedef 0) · plan payı 24% (bilgi): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 18% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 63.3 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 63.3 dk (%137): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 63.6 dk ↔ 73.8 dk (%14): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 31% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 94/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 32% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.5 (3–6) · Series A 4.4 (4–8) · Series B 3.7 (5–9) · Series C 6.0 (6–10): **HAYIR** (3/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 38% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 2.4 (hedef 20–40) · hız çarpanı 0.95 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 83/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–90 dk ve fark ≤ 1.6×: 67.8 / 56.7 / 61.4 / 65.5 dk · 1.20×: **EVET**
- Kayıt boyutu medyan 78.1 KB (hedef < 70) · maks 106.9 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3119 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 20
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.5 ↔ hazırlanmayan 5.1 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 380/380
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1035 kriz): 3% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 35.3 ↔ kriz içeriği olmadan aynı seed'ler 30.4 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 18.6 ↔ 17.3 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 63.3 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 58.7 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 1/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 1 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.05
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 144/1235 (hedef %30–50 → 371–617/1235): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 3.4 (hedef 4–10) · yenilenen 99% (hedef ≥ %60): **HAYIR** · koşu başına 0–10 · satıcılar (bootstrap + niche, 48 koşu) 6.8
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 0/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 0/0 (hedef ≥ %50 → 0–0/0): **EVET** (kredi alan yok)
- Düşen tur payı, iyi botlar (tur denemesi): 22/502 (hedef %10–20 → 51–100/502): **HAYIR** · down round 19 · kredi çağrısı 0
- Bilgi: careless: kredi 15/24 · çağrı 0 · düşen tur 5 · down round 4 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 7 · down round 5 · iplik adımı / koşu (iyi, medyan) 10
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 11/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 1/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 11/11 (hedef ≥ %60 → 7–11/11): **EVET** · n = 11
- Bilgi (maaş masası): iyi botlar masa 113 · erteleme 113 · careless masa 18 · erteleme 16 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.4 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 69 (hedef ≤ 80): **EVET** · medyan 26 · 80'i aşan 0/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 85% / 80% / 80% / 78% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 94 · founder-no-pay 89 · lean-office 96 · deferred-pay 33 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 19/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 7 · team-mutiny 0 · rival-dies 1 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 2819.3 sn · `npm run sim -- --seeds 24 --days 4500`_
