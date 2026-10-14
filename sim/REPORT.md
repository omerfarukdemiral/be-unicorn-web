# Be Unicorn — Denge Simülasyonu Raporu

24 seed × 4 arketip, en fazla 4500 oyun günü (150 dk @1x). 1 gün = 2 sn, 5 dk = 150 gün, 10 dk = 300 gün.
Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).

## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)

| Arketip | Pre-seed | Seed | Series A | Series B | Series C | Unicorn |
|---|---|---|---|---|---|---|
| bootstrap | 4.7 dk · g142 (24/24) | 7.0 dk · g211 (24/24) | 16.4 dk · g494 (24/24) | 27.2 dk · g817 (24/24) | 40.5 dk · g1215 (24/24) | 70.4 dk · g2112 (24/24) |
| vcRocket | 4.2 dk · g126 (24/24) | 7.1 dk · g214 (24/24) | 12.6 dk · g378 (24/24) | 20.7 dk · g621 (24/24) | 32.0 dk · g960 (24/24) | 53.8 dk · g1613 (24/24) |
| niche | 4.6 dk · g137 (24/24) | 6.3 dk · g191 (24/24) | 12.8 dk · g385 (24/24) | 22.6 dk · g677 (24/24) | 38.5 dk · g1156 (24/24) | 66.8 dk · g2005 (24/24) |
| platform | 4.5 dk · g135 (24/24) | 7.3 dk · g220 (24/24) | 14.7 dk · g442 (24/24) | 24.6 dk · g737 (24/24) | 38.7 dk · g1162 (24/24) | 66.9 dk · g2008 (24/24) |

## Sonuç, iflas, kavramlar

| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |
|---|---|---|---|---|---|---|
| bootstrap | 0% | unicorn 24 | 8 / 7 | 10 / 10 | %50 | 36 |
| vcRocket | 0% | unicorn 24 | 7 / 6 | 10 / 7 | %38 | 36 |
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
| bootstrap | founderAction:talkToUsers 255.5 | 255 | 14 sn / 23 sn | 0.24× |
| vcRocket | founderAction:talkToUsers 316 | 309 | 14 sn / 40 sn | 0.32× |
| niche | founderAction:findUsers 244.5 | 244.5 | 14 sn / 32 sn | 0.30× |
| platform | founderAction:talkToUsers 270 | 253 | 14 sn / 40 sn | 0.23× |

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
| best | 70.4 dk | 24/24 | 0% | %50 |
| worst | 66.4 dk | 18/24 | 0% | %41 |
| first | 70.5 dk | 24/24 | 0% | %43 |

## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm

Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.

| Arketip | Küçük (8 ay) | Hedef (12 ay) | Büyük (16 ay) | Süre farkı | Baskın büyüklük |
|---|---|---|---|---|---|
| bootstrap | 79.4 dk · %61 · 24/24 | 70.4 dk · %50 · 24/24 | 69.3 dk · %40 · 24/24 | %15 | — |
| vcRocket | 67.6 dk · %58 · 24/24 | 58.9 dk · %47 · 24/24 | 53.8 dk · %38 · 24/24 | %26 | — |

Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).

| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |
|---|---|---|---|
| bootstrap | 69.8 dk · %50 | 70.4 dk · %50 | hayır |
| platform | 63.5 dk · %49 | 66.9 dk · %48 | EVET |

Tur kapanışları (iyi botlar, 480 tur): metrik kısmı tavanda 17% · metrik tavanda **ve** pitch tavanda 0% (hedef ≤ %30) · tutarı burn × ay belirledi 37% · tablo tavanı 0% · tablo tabanı 63%.

Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.

| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |
|---|---|---|---|---|---|---|
| Garaj | 416 | 0.8 | 2.0 | 0% | 0.0 | 1.0 |
| Pre-seed | 217 | 5.0 | 33.2 | 18% | 3.8 | 5.7 |
| Seed | 702 | 19.9 | 99.0 | 49% | 4.7 | 6.3 |
| Series A | 931 | 8.2 | 99.0 | 37% | 4.5 | 6.0 |
| Series B | 1349 | 10.6 | 99.0 | 39% | 3.7 | 9.9 |
| Series C | 2505 | 22.2 | 99.0 | 48% | 6.5 | 15.3 |

Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).

| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |
|---|---|---|---|---|
| Garaj | 96 | 4 | 8% | 0.0 |
| Pre-seed | 93 | 0 | 15% | 0.0 |
| Seed | 96 | 0 | 12% | 1.1 |
| Series A | 96 | 0 | 10% | 3.2 |
| Series B | 96 | 0 | 10% | 3.2 |
| Series C | 96 | 0 | 12% | 2.7 |

Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).

| Arketip | Garaj | Pre-seed | Seed | Series A | Series B | Series C |
|---|---|---|---|---|---|---|
| bootstrap | 7 | 4 | 29 | 21 | 25 | 78.5 |
| vcRocket | 8 | 4 | 17 | 20 | 29 | 67.5 |
| niche | 8 | 3 | 12 | 11 | 19 | 39 |
| platform | 7 | 3.5 | 33 | 30.5 | 49.5 | 120.5 |

En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan 21%, en kötü 27% (hedef ≤ %35).

## Modüller (W2b)

Proje modülleri: iyi botlar MVP sonrası sırayla kurar, bayatlayanı (< %70) yeniler. Önce/sonra aynı seed’lerde modülsüz koşuyla.

| Bot | Modül kuran koşu | Kurulan modül (medyan) | Yenileme (medyan) | İlk seçim | En sık 3 modül | Tur haftası, hamlesiz bitiş | Reklam odağı değişimi (medyan) |
|---|---|---|---|---|---|---|---|
| bootstrap | 24/24 | 30 | 30.5 | paywall 23, feedback 1 | referral 48, feedback 48, security 48 | 68% (358 hafta) | 1 |
| vcRocket | 24/24 | 30 | 16.5 | paywall 20, aso 4 | referral 48, feedback 48, onboarding 48 | 58% (337 hafta) | 1 |
| niche | 24/24 | 15 | 15 | usagePricing 22, paywall 2 | sdks 24, rateLimit 24, feedback 24 | 65% (361 hafta) | 0 |
| platform | 24/24 | 45.5 | 36.5 | paywall 18, reviews 6 | referral 72, feedback 72, onboarding 72 | 69% (393 hafta) | 1 |
| careless | 24/24 | 31 | 124 | paywall 19, teamPlans 5 | referral 48, feedback 48, security 48 | 96% (185 hafta) | 456.5 |
| coasterModules | 24/24 | 15 | 8.5 | paywall 23, feedback 1 | paywall 24, referral 24, templates 24 | 76% (98 hafta) | 0 |

Önce (modülsüz) / sonra (modüllü), Unicorn’a ulaşan koşu · Unicorn medyanı · iflas:

| Grup | Bot | Önce | Sonra |
|---|---|---|---|
| tek ürün | niche | 24/24 · 70.3 dk · 0 iflas | 24/24 · 66.8 dk · 0 iflas |
| ek kategori | bootstrap | 21/24 · 87.0 dk · 0 iflas | 24/24 · 70.4 dk · 0 iflas |
| ek kategori | vcRocket | 24/24 · 62.5 dk · 0 iflas | 24/24 · 53.8 dk · 0 iflas |
| ek kategori | platform | 24/24 · 76.8 dk · 0 iflas | 24/24 · 66.9 dk · 0 iflas |
| dikkatsiz | careless | 0/24 · — · 0 iflas | 0/24 · — · 0 iflas |

Anti-coast: coasterModules Unicorn 0/24 (hedef 0) · ulaştığı en yüksek aşama: Seed · kurulan modül (medyan) 15

## Modüller v2 (MV2d)

Botlar sabit liste yerine tür-ağırlık planıyla kurar: skor = (ağırlık × $karşılık − kira) / maliyet, $karşılık arayüzdeki `moduleEstimate`. Koşu sonu, proje başına.

| Bot | Sürüm (medyan / en yüksek) | Kurulu modül (medyan) | Açık slot (medyan) | Dolu / açık slot | Tier dağılımı T1·T2·T3·T4·T5 |
|---|---|---|---|---|---|
| bootstrap | 5 / 6 | 15 | 15 | 715 / 720 | 285 · 305 · 124 · 1 · 0 |
| vcRocket | 5 / 6 | 15 | 15 | 706 / 711 | 264 · 310 · 109 · 23 · 0 |
| niche | 5 / 6 | 15 | 15 | 372 / 384 | 144 · 168 · 57 · 3 · 0 |
| platform | 5 / 6 | 15 | 15 | 1101 / 1125 | 424 · 467 · 209 · 1 · 0 |
| careless | 5.5 / 9 | 16 | 16.5 | 746 / 780 | 265 · 257 · 146 · 57 · 21 |
| coasterModules | 5 / 6 | 15 | 15 | 349 / 378 | 143 · 134 · 67 · 5 · 0 |

Baskınlık (bilgi): bir kategorinin koşularının > %90’ında kurulan modül (T1 çekirdek hariç). Botlar boş slotu doldurur (15 slot, kategori başına 22 modül), bu yüzden listedekiler baskın değil, ucuz ve her yerde faydalı olanlardır; oyuncu seçer, bot doldurur.

Baskın modül: web/templates 100%, web/security 100%, web/onboarding 100%, web/notifications 100%, web/cicd 100%, web/support 98%, web/teamPlans 94%, web/abTest 94%, web/integrations 96%, api/sdks 100%, api/security 100%, api/onboarding 100%, api/notifications 100%, api/cicd 99%, api/webhooks 99%, api/sandbox 96%, mobile/offlineMode 100%, mobile/tabletApp 96%, mobile/onboarding 100%, mobile/deepLinks 100%, mobile/notifications 100%, mobile/cicd 100%, mobile/support 100%, mobile/inAppPurchase 100%, mobile/abTest 100%, ai/modelRouter 100%, ai/onboarding 100%, ai/guardrails 100%, ai/notifications 100%, ai/cicd 100%, marketplace/sellerDashboard 100%, marketplace/onboarding 100%, marketplace/notifications 100%, marketplace/cicd 100%, marketplace/promotedListings 100%, marketplace/support 100%, marketplace/search 100%, marketplace/abTest 100%, marketplace/buyerProtection 100%

Plan özgürlüğü (bootstrap seed’leri, dört plan; Unicorn medyanı 15 % içinde olmalı):

| Plan | Unicorn | Medyan | İflas |
|---|---|---|---|
| para (bootstrap) | 24/24 | 70.4 dk | 0 |
| büyüme (vcRocket) | 23/24 | 70.0 dk | 0 |
| tutundurma (niche) | 24/24 | 71.0 dk | 0 |
| erişim (platform) | 23/24 | 70.0 dk | 0 |

Plan farkı (en yavaş / en hızlı medyan): 1.02× (hedef ≤ 1.15×): **EVET**

Kategori turu (bootstrap planı, tek kategori, sınır: 12+ seed): Unicorn · en sık 5 modül

| Kategori | Unicorn | Medyan | İflas | En sık 5 modül |
|---|---|---|---|---|
| web | 21/24 | 81.8 dk | 0 | paywall 24, referral 24, feedback 24, templates 24, security 24 |
| mobile | 24/24 | 63.5 dk | 0 | paywall 24, referral 24, feedback 24, offlineMode 24, onboarding 24 |
| api | 24/24 | 71.9 dk | 0 | rateLimit 24, docs 24, feedback 24, webhooks 24, sdks 24 |
| marketplace | 24/24 | 66.6 dk | 0 | paywall 24, reviews 24, referral 24, feedback 24, sellerDashboard 24 |
| ai | 24/24 | 55.4 dk | 0 | modelRouter 24, referral 24, feedback 24, evals 24, onboarding 24 |
| game | 13/24 | 79.7 dk | 0 | paywall 24, referral 24, feedback 24, liveEvents 24, security 24 |

Kapsam: 61/65 modül en az bir koşuda kuruldu; kurulmayan: watchApp, agents, recommendations, cityLaunch.

## Efor yönetimi (E2)

İyi botlar yorgunluğa göre tempo/izin verir, boşta kalanı yüke göre taşır, 6+ kişilik projeye lider koyar (vcRocket ve greedyGood sprint de atar). Dikkatsiz bot hiçbirini yapmaz. Aşama varışı: yönetimli / yönetimsiz (aynı seed’ler, medyan dk).

| Bot | Ayrılma (medyan): moral / tükenme / sıkılma | Tükenme olayı | Yorgunluk ort. / p90 | Sıkılan gün payı | Akış gün payı | Lider | Sprint | Kalite artışı | Moral Seed (medyan) | Aşama varışı Seed·A·B·Unicorn (yönetimli / yönetimsiz) |
|---|---|---|---|---|---|---|---|---|---|---|
| bootstrap | 0 / 0 / 0 | 0 | 4 / 5 | 24% | 9% | 52 | 0 | 874 | 67 | 7.0 dk / 7.2 dk · 16.4 dk / 15.9 dk · 27.2 dk / 27.4 dk · 70.4 dk / 71.9 dk |
| vcRocket | 0 / 0 / 0 | 0 | 4 / 5 | 14% | 12% | 55 | 24 | 921 | 57 | 7.1 dk / 7.1 dk · 12.6 dk / 13.2 dk · 20.7 dk / 21.0 dk · 53.8 dk / 54.8 dk |
| niche | 0 / 0 / 0 | 0 | 3 / 5 | 28% | 8% | 24 | 0 | 705 | 67 | 6.3 dk / 6.3 dk · 12.8 dk / 14.7 dk · 22.6 dk / 22.4 dk · 66.8 dk / 68.4 dk |
| platform | 0 / 0 / 0 | 0 | 5 / 5 | 17% | 10% | 76 | 0 | 930 | 62 | 7.3 dk / 7.4 dk · 14.7 dk / 16.4 dk · 24.6 dk / 28.0 dk · 66.9 dk / 87.0 dk |
| careless | 0 / 0 / 4 | 59 | 3 / 5 | 30% | 2% | 0 | 0 | 283 | 63 | 6.5 dk · 15.4 dk · 80.5 dk · — |
| greedyGood | 0 / 0 / 0 | 0 | 4 / 5 | 19% | 10% | 74 | 49 | 850 | 65 | 6.1 dk · 10.8 dk · 19.7 dk · 57.2 dk |

Dikkatsiz: sıkılma + tükenme ayrılması (medyan) 4 (hedef ≥ 2) · Seed morali medyan 63 (hedef ≤ 52) · ekip isyanı 0/24 (hedef 1–8/24 aralığı). Rastgele botun reddedilen efor eylemi: 230.

## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)

coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.

| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |
|---|---|---|---|---|---|---|
| coaster | 0/24 | — | 24/24 | 60% | 81% | 15% |
| coasterModules | 0/24 | — | 24/24 | 60% | 81% | 16% |
| idleAfterProfit | 0/24 | — | 1/24 | 93% | 15% | 3% |
| greedyGood | 24/24 | 57.2 dk | 0/24 | 15% | 0% | 8% |
| burner | 24/24 | 68.8 dk | 0/24 | 31% | 0% | 7% |
| frugal | 24/24 | 76.5 dk | 0/24 | 76% | 0% | 6% |
| burner (dikkatsiz) | 0/24 | — | 24/24 | 6% | 0% | 61% |

Kayıt boyutu (koşu sonu, 288 koşu): medyan 77.6 KB · maks 105.1 KB (bulut sınırı 160 KB).

## §9 / §10 kriterleri

- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **EVET**
- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **EVET**
- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **EVET**
- Unicorn’a varış 60–90 dk: medyanlar 70.4 / 53.8 / 66.8 / 66.9 dk → **hedefin 6 dk altında (en hızlı)**; arketip farkı 1.31× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan 4/4 arketip sayıldı
- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **EVET** (en kötü arketip 2.0 sn)
- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar 0% (hedef ≤ %5): **EVET** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) 0% (hedef %40–60): **HAYIR** · idle 100% ve kaos (random) 100%: sonunda batabilir, 4 dk’dan önce batan 0: **EVET**
- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): 0 (hedef 0–1): **EVET**
- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **EVET** · erken tur (0.6) baskın değil: **HAYIR**
- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **EVET** (0%)
- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): 49% (hedef ≤ %30): **HAYIR**
- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **EVET**
- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %6 (hedef ≥ %15): **HAYIR** · kurucu hissesi farkı 9 puan

## §15 kriterleri (koşu sayısı · tolerans)

- İyi bot iflas: 0/96 (hedef ≤ %5 → 0–4/96): **EVET**
- İz: iyi bot + greedyGood iflaslarında son 180 günde tanımlı kötü karar: n = 0, ölçülmedi: **HAYIR**
- Careless iflas: 0/24 (hedef %40–60 → 10–14/24): **HAYIR**
- greedyGood iflas: 0/24 (hedef %15–30 → 4–7/24): **HAYIR**
- coaster Unicorn (E1 nihai): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- coasterModules Unicorn (W2b anti-coast): 0/24 (hedef ≤ %0 → 0–0/24): **EVET**
- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): bootstrap 0/24 ↔ 0/24 (+0 puan) · vcRocket 0/24 ↔ 0/24 (+0 puan) (hedef ≥ +25 puan): **HAYIR**
- idleAfterProfit Unicorn: 0/24 (hedef ≤ %0 → 0–0/24) · tepe sonrası düşüş medyanı 15% (hedef ≥ %30): **HAYIR**
- İyi bot Unicorn medyanı: 65.5 dk (tolerans 55–95 dk): **EVET**
- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = 150 dk): 150.0 dk ↔ 65.5 dk (%129): **EVET**
- Dikkatsiz burner iflas: 24/24 (hedef ≥ %40 → 10–24/24): **EVET**
- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = 150 dk): 68.8 dk ↔ 76.5 dk (%10): **HAYIR**
- Kârda geçirilen maaş günü payı, iyi botlar (medyan): 32% (hedef ≤ %35): **EVET** · B’den önce kâra geçen koşu 94/96 (bilgi)
- Kârda geçirilen maaş günü payı, bootstrap (medyan): 34% (hedef ≤ %50): **EVET**
- Aşama min-runway medyanı: Seed 4.7 (3–6) · Series A 4.5 (4–8) · Series B 3.7 (5–9) · Series C 6.5 (6–10): **HAYIR** (3/4 bantta)
- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): 7% (hedef %15–25): **HAYIR**
- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): 40% (hedef ≤ %30): **HAYIR**
- Teknik borç Series C sonu medyanı (iyi botlar, 96 koşu): 2.7 (hedef 20–40) · hız çarpanı 0.95 (hedef ≥ 0.7): **HAYIR**
- refactorSprint koşu başına (iyi botlar, medyan): 2 (hedef 3–8): **HAYIR**
- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): 10% / 10%: **HAYIR**
- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): 3 / 1 (hedef ≥ 2 / ≥ 1): **EVET** · satın alan koşu 83/96
- Ufukta 'saturation' koşu başına (iyi botlar, medyan): 0 (hedef ≥ 1): **HAYIR** · hiç görmeyen koşu 96/96
- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: 70.4 / 53.8 / 66.8 / 66.9 dk · 1.31×: **HAYIR**
- Kayıt boyutu medyan 77.6 KB (hedef < 70) · maks 105.1 KB (hedef < 120): **HAYIR**
- Krizler arası boşluk (3075 aralık): 150–300 gün (hedef 150–300): **EVET** · çözülmüş olduğu için atlanan tarih 0
- C'de kriz, iyi botlar (C'ye ulaşan 96 koşu, medyan): 3 (hedef ≥ 2): **EVET** · ≥ 2 krizli koşu 96/96
- Kriz hazırlığı (bootstrap + vcRocket, aynı seed'ler): kriz sonrası 120 gün min runway medyanı hazırlanan 5.5 ↔ hazırlanmayan 5.7 ay (hedef ≥ +2): **HAYIR** · hazırlık modunda gelen kriz 380/380
- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, 1046 kriz): 2% (hedef ≥ %40): **HAYIR**
- Kart / koşu, iyi botlar (ortalama): 35.4 ↔ kriz içeriği olmadan aynı seed'ler 30.7 (hedef artış ≤ 0, mutlak ≤ 45): **HAYIR** · 1000 günde 18.4 ↔ 17.1 · kriz / koşu medyanı 8
- İyi bot Unicorn medyanı, ulaşmayan = 150 dk (96/96 ulaştı): 65.5 dk (tolerans 55–95 dk): **EVET** · kriz içeriği olmadan 60.8 dk (96/96)
- Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan): 3/96 (hedef %10–30 → 10–28/96): **HAYIR** · geçili gün medyanı 0
- Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan): 24/24 (hedef ≥ %50 → 12–24/24): **EVET**
- İyi bot Seed'in ilk 90 gününde rivalPassed: 3 (hedef 0): **HAYIR**
- Rakip Σpay Series B sonu medyanı (iyi botlar, 96 koşu): 0.00 (hedef 0.15–0.35): **HAYIR** · Seed / A / C 0.00 / 0.00 / 0.06
- Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek): 188/1282 (hedef %30–50 → 385–641/1282): **HAYIR**
- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster 0/24): **HAYIR**
- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan 96 koşu, ortalama): 4.0 (hedef 4–10) · yenilenen 99% (hedef ≥ %60): **EVET** · koşu başına 0–14 · satıcılar (bootstrap + niche, 48 koşu) 8.1
- 'acquired' bitişi, iyi botlar: 0/96 (hedef ≤ %0 → 0–0/96): **EVET**
- 'acquired' bitişi, careless: C'ye ulaşan careless 0/24, ölçülmedi: **HAYIR**
- İyi botlarda kredi alan koşu: 1/96 (hedef ≤ %30 → 0–28/96): **EVET**
- Kredi alan iyi botların 12 ay sonra hayatta olanı: 1/1 (hedef ≥ %50 → 1–1/1): **EVET**
- Düşen tur payı, iyi botlar (tur denemesi): 24/504 (hedef %10–20 → 51–100/504): **HAYIR** · down round 23 · kredi çağrısı 0
- Bilgi: careless: kredi 11/24 · çağrı 0 · düşen tur 6 · down round 5 · greedyGood: kredi 24/24 · çağrı 0 · düşen tur 2 · down round 2 · iplik adımı / koşu (iyi, medyan) 10
- Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B): 13/96 (hedef ≥ %40 → 39–96/96): **HAYIR**
- Yakın ölüm careless (maaş günü runway < 2, Seed/A/B): 2/24 (hedef ≥ %50 → 12–24/24): **HAYIR**
- Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3): 13/13 (hedef ≥ %60 → 8–13/13): **EVET** · n = 13
- Bilgi (maaş masası): iyi botlar masa 114 · erteleme 114 · careless masa 20 · erteleme 20 · greedyGood masa 24 · erteleme 24
- Pre-seed varış medyanı, iyi botlar: 4.5 dk (hedef ≤ 5 dk) · 5 dk'da kavram medyanı 8 (hedef ≥ 3): **EVET**
- salesCall / koşu, iyi botlar (en çok): 82 (hedef ≤ 80): **HAYIR** · medyan 25 · 80'i aşan 1/96
- topActionShare, iyi botlar (medyan): 21% (hedef ≤ %30): **EVET**
- Series C'de hamle kullanım payı, iyi botlar (medyan): 82% (hedef ≥ %70): **EVET** · Pre-seed → C 85% / 82% / 80% / 78% / 82%
- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika 11/12 (hedef ≥ 8): **EVET** · hiç imzalanmayan: layoff-round
- Politika / koşu (medyan): iyi 7 · greedyGood 8 · careless 0 (hedef 0) · imzalayan koşu: salary-freeze 91 · founder-no-pay 90 · lean-office 96 · deferred-pay 38 · layoff-round 0 · hire-fast 48 · ads-first 48 · crunch-culture 24 · quality-gate 48 · remote-first 72 · profit-share 48 · management 96
- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı lean-office, management: **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, iyi botlar: 15/96 (hedef ≥ %60 → 58–96/96): **HAYIR**
- İplik tamamlama threadsDone ≥ 3/5, careless: 0/24 (hedef ≥ %20 → 5–24/24): **HAYIR**
- Her gizli kart 2–12 koşuda (iyi botlar + careless, 120 koşu): viral-spike 7 · team-mutiny 0 · rival-dies 1 · founder-burnout 24: **HAYIR**
- Kart havuzu CONTENT.decisions ≤ 65: 68: **HAYIR**

_Süre: 1790.6 sn · `npm run sim -- --seeds 24 --days 4500`_
