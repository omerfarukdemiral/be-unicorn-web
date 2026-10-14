# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g142 (24/24) | 7.2 dk · g215 (24/24) | 15.9 dk · g478 (24/24) | 29.1 dk · g874 (24/24) | 45.8 dk · g1375 (24/24) | 83.1 dk · g2494 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.1 dk · g213 (24/24) | 12.7 dk · g381 (24/24) | 20.9 dk · g627 (24/24) | 34.5 dk · g1037 (24/24) | 57.9 dk · g1738 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.3 dk · g191 (24/24) | 14.4 dk · g432 (24/24) | 22.6 dk · g677 (24/24) | 36.6 dk · g1098 (24/24) | 61.0 dk · g1830 (24/24) |
| platform | 4.5 dk · g135 (24/24) | 7.4 dk · g223 (24/24) | 14.9 dk · g448 (24/24) | 25.3 dk · g758 (24/24) | 44.1 dk · g1323 (24/24) | 73.5 dk · g2206 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %39 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 9 | %50 | 36 |
| platform | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %48 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 43.0 dk · g1290 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 6.0 dk · g180 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:talkToUsers 308 | 303.5 | 14 sn / 21 sn | 0.23× |
| vcRocket | founderAction:talkToUsers 327.5 | 325.5 | 14 sn / 39 sn | 0.30× |
| niche | founderAction:findUsers 214 | 214 | 14 sn / 34 sn | 0.30× |
| platform | founderAction:talkToUsers 310 | 291.5 | 14 sn / 40 sn | 0.23× |

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
| idle | 100% (24/24) | 43.0 dk · g1290 | 5 |

Karar politikası (bootstrap, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.

| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |
|---|---|---|---|---|
| best | 83.1 dk | 24/24 | 0% | %50 |
| worst | 76.2 dk | 18/24 | 0% | %41 |
| first | 79.6 dk | 24/24 | 0% | %41 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 89.3 dk · %61 · 24/24 | 83.1 dk · %50 · 24/24 | 77.1 dk · %40 · 24/24 | %16 | — |
| vcRocket | 76.9 dk · %58 · 24/24 | 63.4 dk · %47 · 24/24 | 57.9 dk · %39 · 24/24 | %33 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 81.0 dk · %50 | 83.1 dk · %50 | hayır |
| platform | 71.7 dk · %49 | 73.5 dk · %48 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 14% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 31% · tablo tavanı 0% · tablo tabanı 69%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 416 | 0.8 | 2.0 | 0% | 0.0 | 1.0 |
| Pre-seed | 215 | 5.2 | 33.2 | 19% | 3.7 | 5.7 |
| Seed | 723 | 28.6 | 99.0 | 52% | 4.5 | 6.2 |
| Series A | 978 | 8.6 | 99.0 | 43% | 4.2 | 5.9 |
| Series B | 1479 | 9.0 | 99.0 | 38% | 3.6 | 5.2 |
| Series C | 2758 | 19.0 | 99.0 | 45% | 5.8 | 8.6 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 93 | 0 | 16% | 0.0 |
| Seed | 96 | 0 | 13% | 3.9 |
| Series A | 96 | 0 | 10% | 2.5 |
| Series B | 96 | 0 | 10% | 4.1 |
| Series C | 96 | 0 | 14% | 2.3 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 4 | 27.5 | 21.5 | 32 | 93.5 |
| vcRocket | 8 | 4 | 19 | 23 | 29 | 76 |
| niche | 8 | 3 | 12.5 | 11 | 16.5 | 36 |
| platform | 7 | 3.5 | 35.5 | 32 | 53 | 129 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 27% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 33 | 42 | paywall 22, teamPlans 2 | feedback 48, onboarding 48, openApi 48 | 69% (380 hafta) | 1 |
| vcRocket | 24/24 | 30 | 22 | paywall 13, aso 8, referral 2, inAppPurchase 1 | feedback 48, security 48, openApi 48 | 56% (331 hafta) | 1 |
| niche | 24/24 | 15 | 15 | paywall 12, usagePricing 12 | rateLimit 24, sdks 24, feedback 24 | 63% (362 hafta) | 0 |
| platform | 24/24 | 48 | 46.5 | paywall 18, promotedListings 2, referral 2, reviews 2 | feedback 72, security 72, openApi 72 | 64% (385 hafta) | 1 |
| careless | 24/24 | 31 | 116 | paywall 22, teamPlans 2 | feedback 48, openApi 47, security 39 | 94% (184 hafta) | 450.5 |
| coasterModules | 24/24 | 15 | 19 | paywall 22, teamPlans 2 | paywall 24, teamPlans 24, templates 24 | 79% (96 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 70.3 dk · 0 iflas | 24/24 · 61.0 dk · 0 iflas |
| ek kategori | bootstrap | 21/24 · 87.0 dk · 0 iflas | 24/24 · 83.1 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 62.5 dk · 0 iflas | 24/24 · 57.9 dk · 0 iflas |
| ek kategori | platform | 24/24 · 76.8 dk · 0 iflas | 24/24 · 73.5 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 15

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = (ağırlık × $karşılık − kira) / maliyet, $karşılık arayüzdeki `moduleEstimate`. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 15 | 15 | 759 / 765 | 586 / 176 | 245 · 190 · 202 · 54 · 68 |
| vcRocket | 5 / 6 | 15 | 15 | 735 / 747 | 552 / 185 | 243 · 206 · 199 · 60 · 27 |
| niche | 5 / 6 | 15 | 15 | 362 / 363 | 291 / 72 | 121 · 95 · 98 · 24 · 24 |
| platform | 5 / 6 | 15 | 15 | 1118 / 1131 | 834 / 287 | 341 · 324 · 285 · 70 · 98 |
| careless | 5 / 9 | 15 | 15 | 750 / 810 | 481 / 269 | 212 · 239 · 204 · 71 · 24 |
| coasterModules | 5 / 6 | 15 | 15 | 352 / 360 | 271 / 81 | 97 · 80 · 103 · 35 · 37 |

Baskınlık: bir kategorinin koşularının > %90’ında planın kendi seçtiği (doldurucu değil) kurulu modül, T1 çekirdek hariç; yalnızca gerçek seçim olan katmanlarda (projeler katmanın %80’inden azını kuruyorsa) sayılır, bir katmanı tümden kuran herkes tek modülü üstün kılmaz. Plan skoru sıfırın altındaysa bot boş slotu gün ve projeye bağlı bir karma ile doldurur (rastgele ama tekrarlanabilir); “Plan seçimi / doldurucu” sütunu hangisinin kaç modül kurduğunu gösterir.

Baskın modül (hedef: yok): **HAYIR** · web/teamPlans 100%, web/templates 100%, web/pwa 98%, api/sdks 100%, api/webhooks 100%, mobile/deepLinks 100%, mobile/inAppPurchase 100%, mobile/offlineMode 100%, mobile/watchApp 100%, ai/security 100%, ai/guardrails 100%, ai/openApi 100%, ai/abTest 92%, ai/fineTune 92%, marketplace/promotedListings 100%, marketplace/search 100%, marketplace/sellerDashboard 100%, marketplace/security 100%, marketplace/openApi 100%, marketplace/recommendations 100%, marketplace/buyerProtection 96%

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 83.1 dk | 0 |
| büyüme (vcRocket) | 24/24 | 79.2 dk | 0 |
| tutundurma (niche) | 24/24 | 80.1 dk | 0 |
| erişim (platform) | 24/24 | 81.4 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.05× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 19/24 | 91.0 dk | 0 | 6/24 · 110.4 dk | paywall 24, teamPlans 24, templates 24, feedback 24, seo 24 |
| mobile | 24/24 | 72.7 dk | 0 | 24/24 · 80.1 dk | paywall 24, inAppPurchase 24, aso 24, referral 24, deepLinks 24 |
| api | 24/24 | 75.2 dk | 0 | 24/24 · 83.6 dk | rateLimit 24, docs 24, sdks 24, feedback 24, usageDashboard 24 |
| marketplace | 24/24 | 71.2 dk | 0 | 23/24 · 77.9 dk | paywall 24, promotedListings 24, reviews 24, search 24, referral 24 |
| ai | 24/24 | 58.7 dk | 0 | 24/24 · 67.0 dk | feedback 24, evals 24, modelRouter 24, security 24, openApi 24 |
| game | 12/24 | 86.5 dk | 0 | 11/24 · 111.0 dk | paywall 24, shop 24, leaderboard 24, referral 24, feedback 24 |

Kapsam: 65/65 modül en az bir koşuda kuruldu.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 4 / 5 | 20% | 12% | 54 | 0 | 1414 | 67 | 7.2 dk / 7.0 dk · 15.9 dk / 15.9 dk · 29.1 dk / 28.1 dk · 83.1 dk / 79.9 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 14% | 12% | 56 | 24 | 967 | 58 | 7.1 dk / 7.1 dk · 12.7 dk / 13.5 dk · 20.9 dk / 21.4 dk · 57.9 dk / 59.8 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 30% | 9% | 24 | 0 | 704 | 66 | 6.3 dk / 6.3 dk · 14.4 dk / 14.7 dk · 22.6 dk / 22.4 dk · 61.0 dk / 63.3 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 15% | 11% | 74 | 0 | 1237 | 62 | 7.4 dk / 7.4 dk · 14.9 dk / 16.0 dk · 25.3 dk / 28.1 dk · 73.5 dk / 92.4 dk |
| careless | 0 / 0 / 4.5 | 78 | 3 / 5 | 30% | 2% | 0 | 0 | 311 | 63 | 6.6 dk · 15.1 dk · — · — |
| greedyGood | 0 / 0 / 0 | 0 | 4 / 5 | 17% | 12% | 75 | 48 | 1200 | 64 | 6.0 dk · 10.8 dk · 20.2 dk · 64.5 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 4.5 (hedef ≥ 2) · Seed morali medyan 63 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 230.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 24/24 | 60% | 81% | 15% |
| coasterModules | 0/24 | — | 22/24 | 64% | 81% | 14% |
| idleAfterProfit | 0/24 | — | 1/24 | 93% | 15% | 3% |
| greedyGood | 24/24 | 64.5 dk | 0/24 | 21% | 0% | 8% |
| burner | 24/24 | 76.8 dk | 0/24 | 33% | 0% | 6% |
| frugal | 24/24 | 85.0 dk | 0/24 | 75% | 0% | 6% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 5% | 0% | 62% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 80.8 KB · maks 101.0 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 55–90 dk: medyanlar 83.1 / 57.9 / 61.0 / 73.5 dk → **hedef aralıkta**; arketip farkı 1.44× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 52% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %9 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 9 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 15% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 67.6 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 67.6 dk (%122): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 76.8 dk ↔ 85.0 dk (%10): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 33% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 96/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 42% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.5 (3–6) · Series A 4.2 (4–8) · Series B 3.6 (5–9) · Series C 5.8 (6–10): **HAYIR** (2/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 40% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 2.3 (hedef 20–40) · hız çarpanı 0.95 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 3 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 81/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–90 dk ve fark ≤ 1.6×: 83.1 / 57.9 / 61.0 / 73.5 dk · 1.44×: **EVET**
- Kayıt boyutu medyan 80.8 KB (hedef < 70) · maks 101.0 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3299 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.3 ↔ hazırlanmayan 6.3 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 428/428
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1105 kriz): 3% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 36.2 ↔ kriz içeriği olmadan aynı seed'ler 30.6 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 17.5 ↔ 16.0 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 67.6 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 61.0 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 2/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 2 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.09
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 226/1416 (hedef %30–50 → 425–708/1416): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 3.9 (hedef 4–10) · yenilenen 97% (hedef ≥ %60): **HAYIR** · koşu başına 0–14 · satıcılar (bootstrap + niche, 48 koşu) 7.8
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 2/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 2/2 (hedef ≥ %50 → 1–2/2): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 22/502 (hedef %10–20 → 51–100/502): **HAYIR** · down round 21 · kredi çağrısı 0
- Bilgi: careless: kredi 11/24 · çağrı 0 · düşen tur 5 · down round 4 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 6 · down round 4 · iplik adımı / koşu (iyi, medyan) 9
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 29/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 1/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 29/29 (hedef ≥ %60 → 18–29/29): **EVET** · n = 29
- Bilgi (maaş masası): iyi botlar masa 114 · erteleme 114 · careless masa 20 · erteleme 20 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.5 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 89 (hedef ≤ 80): **HAYIR** · medyan 25.5 · 80'i aşan 8/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 85% / 81% / 80% / 77% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 8 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 96 · founder-no-pay 90 · lean-office 96 · deferred-pay 58 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı salary-freeze, lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 20/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 5 · team-mutiny 0 · rival-dies 2 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 2778.4 sn · `npm run sim -- --seeds 24 --days 4500`_
