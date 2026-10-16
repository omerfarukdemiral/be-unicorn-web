# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g142 (24/24) | 7.1 dk · g213 (24/24) | 16.4 dk · g493 (24/24) | 28.6 dk · g858 (24/24) | 45.4 dk · g1361 (24/24) | 83.5 dk · g2504 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.1 dk · g213 (24/24) | 13.0 dk · g389 (24/24) | 21.2 dk · g637 (24/24) | 34.8 dk · g1045 (24/24) | 59.9 dk · g1796 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.4 dk · g191 (24/24) | 14.5 dk · g434 (24/24) | 23.1 dk · g692 (24/24) | 40.0 dk · g1200 (24/24) | 60.1 dk · g1805 (24/24) |
| platform | 4.5 dk · g135 (24/24) | 7.3 dk · g218 (24/24) | 15.6 dk · g469 (24/24) | 26.2 dk · g786 (24/24) | 43.0 dk · g1290 (24/24) | 76.8 dk · g2304 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %39 | 36 |
| niche | 0% | unicorn 24 | 8 / 7 | 9 / 9 | %51 | 36 |
| platform | 0% | unicorn 24 | 8 / 7 | 10 / 9 | %49 | 36 |

Toplam iflas oranı: **0%** (0/96).

## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)

| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |
|---|---|---|---|---|
| idle (hiçbir şey yapmaz) | 24/24 | 43.0 dk · g1290 | 0 | 0 |
| random (rastgele aksiyon) | 24/24 | 6.0 dk · g180 | 0 | 2 |

## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)

| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |
|---|---|---|---|---|
| bootstrap | founderAction:talkToUsers 323 | 318 | 14 sn / 34 sn | 0.23× |
| vcRocket | founderAction:talkToUsers 339.5 | 335.5 | 14 sn / 39 sn | 0.31× |
| niche | founderAction:findUsers 216.5 | 216.5 | 14 sn / 33 sn | 0.30× |
| platform | founderAction:talkToUsers 325.5 | 313 | 14 sn / 40 sn | 0.23× |

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
| best | 83.5 dk | 24/24 | 0% | %50 |
| worst | 72.9 dk | 16/24 | 0% | %41 |
| first | 77.7 dk | 24/24 | 0% | %43 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 93.7 dk · %61 · 24/24 | 83.5 dk · %50 · 24/24 | 74.6 dk · %39 · 24/24 | %26 | — |
| vcRocket | 82.6 dk · %59 · 24/24 | 63.9 dk · %48 · 24/24 | 59.9 dk · %39 · 24/24 | %38 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 83.1 dk · %50 | 83.5 dk · %50 | hayır |
| platform | 73.5 dk · %49 | 76.8 dk · %49 | hayır |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 18% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 37% · tablo tavanı 0% · tablo tabanı 63%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 414 | 0.8 | 2.0 | 0% | 0.0 | 1.0 |
| Pre-seed | 223 | 5.5 | 37.9 | 20% | 3.9 | 6.2 |
| Seed | 771 | 99.0 | 99.0 | 55% | 4.6 | 6.4 |
| Series A | 993 | 7.6 | 99.0 | 38% | 4.2 | 5.6 |
| Series B | 1526 | 9.8 | 99.0 | 39% | 3.5 | 7.7 |
| Series C | 2812 | 18.9 | 99.0 | 45% | 5.6 | 12.0 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 95 | 0 | 17% | 0.0 |
| Seed | 96 | 0 | 13% | 3.8 |
| Series A | 96 | 0 | 10% | 2.3 |
| Series B | 96 | 0 | 10% | 4.1 |
| Series C | 96 | 0 | 14% | 2.1 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 4 | 27 | 22.5 | 29 | 100 |
| vcRocket | 8 | 4 | 20 | 22 | 34.5 | 78.5 |
| niche | 8 | 3 | 13 | 12 | 18 | 31 |
| platform | 7 | 4 | 38 | 29.5 | 52.5 | 142 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 27% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 33 | 43.5 | paywall 22, teamPlans 2 | feedback 48, onboarding 48, openApi 48 | 70% (378 hafta) | 1 |
| vcRocket | 24/24 | 30.5 | 26 | paywall 13, aso 8, referral 2, inAppPurchase 1 | feedback 48, security 48, openApi 48 | 57% (326 hafta) | 1 |
| niche | 24/24 | 15 | 15 | paywall 12, usagePricing 12 | sdks 24, rateLimit 24, docs 24 | 65% (375 hafta) | 0 |
| platform | 24/24 | 47 | 54.5 | paywall 17, referral 3, promotedListings 2, reviews 2 | feedback 72, security 72, openApi 72 | 64% (401 hafta) | 1 |
| careless | 24/24 | 31 | 115.5 | paywall 22, teamPlans 2 | feedback 48, openApi 47, security 40 | 97% (181 hafta) | 460.5 |
| coasterModules | 24/24 | 15 | 25.5 | paywall 22, teamPlans 2 | paywall 24, teamPlans 24, templates 24 | 74% (93 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 71.3 dk · 0 iflas | 24/24 · 60.1 dk · 0 iflas |
| ek kategori | bootstrap | 23/24 · 87.0 dk · 0 iflas | 24/24 · 83.5 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 64.0 dk · 0 iflas | 24/24 · 59.9 dk · 0 iflas |
| ek kategori | platform | 24/24 · 76.6 dk · 0 iflas | 24/24 · 76.8 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 15

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = (ağırlık × $karşılık − kira) / maliyet, $karşılık arayüzdeki `moduleEstimate`. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Plan seçimi / slot doldurucu (kurulan) | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 15 | 15 | 757 / 762 | 576 / 182 | 246 · 193 · 204 · 49 · 65 |
| vcRocket | 5 / 6 | 15 | 15 | 743 / 759 | 547 / 197 | 251 · 205 · 203 · 56 · 28 |
| niche | 5 / 6 | 15 | 15 | 363 / 363 | 289 / 74 | 122 · 93 · 96 · 28 · 24 |
| platform | 5 / 7 | 15 | 15 | 1118 / 1131 | 837 / 284 | 345 · 321 · 295 · 69 · 88 |
| careless | 5 / 9 | 15 | 15 | 754 / 810 | 480 / 274 | 209 · 243 · 206 · 72 · 24 |
| coasterModules | 5 / 6 | 15 | 15 | 357 / 369 | 274 / 83 | 96 · 84 · 106 · 36 · 35 |

Baskınlık: bir kategorinin koşularının > %90’ında planın kendi seçtiği (doldurucu değil) kurulu modül, T1 çekirdek hariç; yalnızca gerçek seçim olan katmanlarda (projeler katmanın %80’inden azını kuruyorsa) sayılır, bir katmanı tümden kuran herkes tek modülü üstün kılmaz. Plan skoru sıfırın altındaysa bot boş slotu gün ve projeye bağlı bir karma ile doldurur (rastgele ama tekrarlanabilir); “Plan seçimi / doldurucu” sütunu hangisinin kaç modül kurduğunu gösterir.

Baskın modül (hedef: yok): **HAYIR** · web/teamPlans 100%, web/templates 100%, web/pwa 100%, api/sdks 100%, api/webhooks 100%, mobile/deepLinks 100%, mobile/inAppPurchase 100%, mobile/offlineMode 100%, mobile/watchApp 100%, ai/security 100%, ai/openApi 100%, ai/guardrails 100%, ai/fineTune 92%, ai/abTest 96%, marketplace/promotedListings 100%, marketplace/search 100%, marketplace/sellerDashboard 100%, marketplace/security 100%, marketplace/openApi 100%, marketplace/sso 100%, marketplace/buyerProtection 100%

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 83.5 dk | 0 |
| büyüme (vcRocket) | 24/24 | 82.4 dk | 0 |
| tutundurma (niche) | 24/24 | 81.8 dk | 0 |
| erişim (platform) | 24/24 | 79.8 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.05× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | Modülsüz Unicorn · medyan | En sık 5 modül |
|---|---|---|---|---|---|
| web | 18/24 | 93.8 dk | 0 | 4/24 · 106.8 dk | paywall 24, teamPlans 24, templates 24, feedback 24, seo 24 |
| mobile | 24/24 | 74.6 dk | 0 | 24/24 · 77.8 dk | paywall 24, aso 24, referral 24, inAppPurchase 24, deepLinks 24 |
| api | 24/24 | 73.5 dk | 0 | 24/24 · 86.2 dk | rateLimit 24, docs 24, sdks 24, feedback 24, usageDashboard 24 |
| marketplace | 24/24 | 70.2 dk | 0 | 23/24 · 77.8 dk | paywall 24, promotedListings 24, reviews 24, search 24, feedback 24 |
| ai | 24/24 | 60.4 dk | 0 | 24/24 · 65.9 dk | feedback 24, evals 24, modelRouter 24, security 24, openApi 24 |
| game | 18/24 | 87.8 dk | 0 | 8/24 · 119.6 dk | paywall 24, shop 24, leaderboard 24, referral 24, feedback 24 |

Kapsam: 65/65 modül en az bir koşuda kuruldu.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 4 / 5 | 20% | 12% | 54 | 0 | 1455 | 69 | 7.1 dk / 7.1 dk · 16.4 dk / 16.8 dk · 28.6 dk / 28.5 dk · 83.5 dk / 79.8 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 14% | 12% | 57 | 24 | 1020 | 55 | 7.1 dk / 7.1 dk · 13.0 dk / 13.3 dk · 21.2 dk / 21.5 dk · 59.9 dk / 59.5 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 30% | 9% | 24 | 0 | 698 | 67 | 6.4 dk / 6.4 dk · 14.5 dk / 14.6 dk · 23.1 dk / 23.3 dk · 60.1 dk / 64.5 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 15% | 12% | 75 | 0 | 1360 | 61 | 7.3 dk / 7.3 dk · 15.6 dk / 15.9 dk · 26.2 dk / 28.7 dk · 76.8 dk / 91.2 dk |
| careless | 0 / 0 / 4.5 | 124 | 3 / 5 | 33% | 2% | 0 | 0 | 419 | 62 | 6.6 dk · 14.8 dk · 97.3 dk · — |
| greedyGood | 0 / 0 / 0 | 0 | 4 / 5 | 17% | 13% | 75 | 48 | 1232 | 65 | 6.0 dk · 10.6 dk · 19.4 dk · 62.4 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 4.5 (hedef ≥ 2) · Seed morali medyan 62 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 230.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 24/24 | 61% | 81% | 15% |
| coasterModules | 0/24 | — | 23/24 | 64% | 78% | 12% |
| idleAfterProfit | 0/24 | — | 1/24 | 93% | 75% | 3% |
| greedyGood | 24/24 | 62.4 dk | 0/24 | 18% | 0% | 8% |
| burner | 24/24 | 75.2 dk | 0/24 | 34% | 0% | 6% |
| frugal | 24/24 | 85.7 dk | 0/24 | 77% | 0% | 5% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 6% | 0% | 60% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 83.5 KB · maks 113.1 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 55–90 dk: medyanlar 83.5 / 59.9 / 60.1 / 76.8 dk → **hedef aralıkta**; arketip farkı 1.39× (hedef ≤ 1.6×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **EVET**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 55% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %14 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 9 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 75% (hedef ≥ %30): **EVET**
- İyi bot Unicorn medyanı: 69.6 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 69.6 dk (%116): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 75.2 dk ↔ 85.7 dk (%12): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 33% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 93/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 41% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.6 (3–6) · Series A 4.2 (4–8) · Series B 3.5 (5–9) · Series C 5.6 (6–10): **HAYIR** (2/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 40% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 2.1 (hedef 20–40) · hız çarpanı 0.96 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 4 (hedef 3–8): **EVET**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 86/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–90 dk ve fark ≤ 1.6×: 83.5 / 59.9 / 60.1 / 76.8 dk · 1.39×: **EVET**
- Kayıt boyutu medyan 83.5 KB (hedef < 70) · maks 113.1 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3367 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.6 ↔ hazırlanmayan 5.8 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 437/437
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1092 kriz): 3% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 37.2 ↔ kriz içeriği olmadan aynı seed'ler 30.5 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 17.5 ↔ 16.0 · kriz / koşu medyanı 9
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 69.6 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 63.0 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 1/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 0 (hedef 0): **EVET**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.10
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 240/1452 (hedef %30–50 → 436–726/1452): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 4.2 (hedef 4–10) · yenilenen 98% (hedef ≥ %60): **EVET** · koşu başına 0–16 · satıcılar (bootstrap + niche, 48 koşu) 8.3
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 0/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 0/0 (hedef ≥ %50 → 0–0/0): **EVET** (kredi alan yok)
- Düşen tur payı, iyi botlar (tur denemesi): 28/508 (hedef %10–20 → 51–101/508): **HAYIR** · down round 25 · kredi çağrısı 0
- Bilgi: careless: kredi 12/24 · çağrı 0 · düşen tur 4 · down round 3 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 4 · down round 4 · iplik adımı / koşu (iyi, medyan) 10
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 27/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 2/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 27/27 (hedef ≥ %60 → 17–27/27): **EVET** · n = 27
- Bilgi (maaş masası): iyi botlar masa 112 · erteleme 112 · careless masa 20 · erteleme 20 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.4 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 92 (hedef ≤ 80): **HAYIR** · medyan 25 · 80'i aşan 13/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 85% / 81% / 80% / 77% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 8 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 95 · founder-no-pay 94 · lean-office 96 · deferred-pay 52 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 20/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 11 · team-mutiny 0 · rival-dies 3 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 9058.5 sn · `npm run sim -- --seeds 24 --days 4500`_
