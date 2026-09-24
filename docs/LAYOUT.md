# Be Unicorn — Ekran Yerleşimi ("Üst bar + sağ panel + alt bar")

Durum: **UYGULANDI** (2026-09-24, commit "ui: relayout — top bar, bottom bar, notification strip, metrics tab"; ekran görüntüleri
`docs/screenshots/layout-int-*.png`). Ölçümle değişen yerler §1.3 notunda. Kaynak şikayet: "Arayüz yerleşimi çok dağınık, tutarsız ve karmaşık."
Bu doküman `docs/DESIGN.md` (renk, tipografi, yüzey) ve `docs/CORE_LOOP.md` (döngü, popup bütçesi) ile
birlikte okunur. Çakışırsa **yerleşim konusunda bu doküman**, renk tokenlarında DESIGN.md geçerlidir.

Hedef tek cümle: **ekranda üç sabit yüzey (üst bar, sağ panel, alt bar) ve tek bir bildirim şeridi olur;
her bilgi bunlardan yalnızca birinde, yalnızca bir kez görünür; kırmızı yalnızca oyunu bitirebilecek tehlikededir.**

---

## 0. Bugünkü envanter (src/ui, 2026-09-24)

Masaüstünde aynı anda **9 ayrı yüzen kart** var, her biri kendi boyut/hiza/gölgesiyle:

| # | Yüzey | Bileşen | Konum (masaüstü) | İçerik |
|---|---|---|---|---|
| 1 | Ana göstergeler | `Hud.tsx › DesktopHud` + `widgets.tsx` (tier `primary`) | sol üst, 260/300px | Kasa (kullanılabilir + aylık net + günlük net + "Maaş gününe N gün · $X ayrıldı · kasada $Y" + runway), Kullanıcı, Moral |
| 2 | İkincil metrik ızgarası | `Hud.tsx` + `widgets.tsx` (tier `secondary`) | 1'in altı, 2 sütun, kaydırmalı | 19 widget: Runway, Yakıt, Tutunma, Kâr tahmini, Cap table, Tur, Ekip morali, Churn, ARPU, İtibar, Kurucu payı, LTV:CAC, Kanallar, Teknik borç, Koordinasyon, Kültür, Gelir dağılımı, Yolun |
| 3 | Aşama/zaman kartı | `Hud.tsx › StageBar` + `time.tsx › DayClock/TimeStatusPill` + `SpeedControl` | üst orta, 560px | aşama adı, ay halkası + tarih, zaman durumu pill'i, değerleme ilerlemesi, "Tur: N hafta"/"Tur başlat" butonu, hız segmentleri. **2px kenarı hız renginde (duraklatınca kırmızı)** |
| 4 | Ufuk şeridi | `Horizon.tsx › HorizonStrip` | 3'ün altı | 6 haftalık çizgi, üst üste binen ikonlar, tek başlık |
| 5 | Sıradaki adım | `NextStepChip.tsx` | 4'ün altı | "6 · 12 kullanıcıya ulaş · Yap ›" |
| 6 | Anlık kartlar | `Moments.tsx` + `momentRules.ts` | 5'in altı, 2 kart | ay fişi (Maaş/Kira/Kurucu/Net/Runway), sürüm, karar→sonuç, hedef, tur penceresi/haftası |
| 7 | Görünüm araçları | `Hud.tsx › ViewControls` | sağ üst | zoom −/+, TR (yer tutucu), ayarlar |
| 8 | Kurucu aksiyonları | `FounderActions.tsx` | sol alt | enerji çubuğu + 6 **etiketsiz** yuvarlak ikon (masaüstü) |
| 9 | Aktivite satırı | `ActivityLine.tsx` | 8'in altı | son aktivite + geçmiş listesi |
| 10 | Dock | `Dock.tsx` | alt orta (panel açıkken panelin soluna yaslanır) | Mağaza · Ekip · Projeler · Büyüme · Kazanımlar |
| 11 | Sağ panel | `RightPanel.tsx` (`top-[76px]`, `PANEL_W=400`) | sağ | tek panel (dokunulmayacak, yalnız konum) |
| 12 | Geri bildirim | `Feedback.tsx › ErrorToast, PlacingBanner` | alt orta, dock'un üstü (`bottom-[84px]`) | hata toast'u, yerleştirme pankartı |
| 13 | Ekran çerçevesi | `time.tsx › ScreenFrame` | viewport kenarı | hız renginde 3px; duraklatınca **kırmızı** |
| 14 | Başlat çağrısı / perde | `time.tsx › StartCall, PauseVeil` | sahne ortası | yalnız ilk duraklı açılışta |
| 15 | Balonlar | `bubbles/index.tsx › BubbleTray` (`top-[84px]`) | üst orta | karar / kavram / ortam balonları |

Mobil (`MobileHud`): aşama satırı + 3'lü gösterge + "+N" açılır ızgara + çip/ufuk satırı + anlık kart; altta
aktivite + kurucu aksiyonları (etiketli) + sabit dock + sheet.

### Tespit edilen tekrarlar

| Bilgi | Bugün kaç yerde | Nerede |
|---|---|---|
| Tur (haftalar) | 5–7 | StageBar "Tur: 9 hafta" butonu, `RoundTimerWidget`, ActivityLine (roundProgress), NextStepChip (tur halkası), ufuk `roundClose`, Moments `roundWeek`, panel `RoundSection` |
| Runway | 2–3 | `CashWidget` alt satırı "runway 4.8 ay", `RunwayWidget`, ay fişi |
| Gider | 3 farklı rakam | Kasa'da "−$8.1K/ay" (= **net**, MRR − burn), Kasa'da "−$270/gün" (= net/30), Yakıt "$13.9K/ay" (= **burn**). Hepsi doğru ama etiketsiz yan yana tutarsız okunuyor |
| Maaş günü | 3 | Kasa alt satırı "Maaş gününe 29 gün · $85 ayrıldı", ufuk şeridi, ay fişi |
| Kurucu payı | 2 | `CapTableWidget` ve `EquityWidget` ikisi de `stats.equity` gösterir |
| Tutunma / Churn | 2 | `RetentionWidget` = 1 − churn, `ChurnWidget` = churn |
| Zamanı başlat | 2 | `StartCall` kartı ve NextStepChip "Zamanı başlat (Space)" |

### Kırmızı gürültü

`--color-speed-pause` = `--color-negative` (#E0483E) olduğu için duraklı her an ekranın dört kenarı, aşama
kartının 2px kenarı, "DURAKLATILDI" pill'i ve oynat segmenti aynı anda kırmızı. Üstüne Kasa (günlük −$ rozeti,
her gün süzülen kırmızı "−50"), runway turuncu/kırmızı, düşük enerji, hata ikonu, Dock rozetleri, ufukta maaş
işareti kırmızı. Sonuç: kırmızı artık "tehlike" demiyor.

---

## 1. Bölgeler ve piksel ölçüleri

### 1.1 Ortak ölçek (tek ızgara)

- **Spacing birimi 8px.** Bar içi boşluklar 4/8, bölgeler arası 8, bölüm ayıracı 16. 12/6/10 gibi ara değerler yeni kodda yok.
- **Kenar boşluğu `EDGE = 8px`** + ilgili `env(safe-area-inset-*)`. Tüm yüzeyler ekran kenarına 8px'ten yaslanır.
- **Yüzey ailesi (tek):** `.ui-card` = `surface` (barlarda `bg-surface/95 backdrop-blur-sm`), 1px `border`,
  `--radius-card` 14px, `--shadow-card`. Üst bar, alt bar, bildirim şeridi, sağ panel, mobil sheet hepsi bu.
  Bar içindeki kontroller `--radius-control` 10px. Kart içinde kart yok (bar içi bölümler 1px dikey ayraçla ayrılır).
- **Yükseklikler:** masaüstü bar `BAR_H = 56` (içerik 40 + 8/8 dolgu), bar içi kontrol `CONTROL = 40`;
  bildirim şeridi `STRIP_H = 40` (mobil 36); mobilde dokunma hedefi `44`.
- **z-index:** sahne < PauseVeil < BubbleTray (z-10) < sağ panel / sheet (z-20) < üst bar, alt bar (z-30) <
  bildirim şeridi + popover'ları (z-40) < ModalHost (z-50) < ScreenFrame (z-55, pointer-events yok).

Bu sabitler tek dosyada: `src/ui/layout/tokens.ts` (içerik §7.4'te birebir).

### 1.2 Masaüstü şeması

```
┌─────────────────────────────────────────────────────────────────────────────┐ ← EDGE 8 (+safe-top)
│ ÜST BAR (h56)  [A: Aşama · tarih · ilerleme · tur]  [B: Kasa Runway Kullanıcı Moral │ pin pin]  [C: ⏸ 1× 2× 4× │ − + │ TR │ ⚙] │
└─────────────────────────────────────────────────────────────────────────────┘ y=64
                                                         ┌──────────────────┐ y=72
                                                         │                  │
            S A H N E  (sceneInset içinde ortalanır)      │   SAĞ PANEL       │
            balonlar: üst kenardan 8px aşağı              │   (tek panel,     │
                                                         │    bugünkü gibi)  │
      ┌──────────────── BİLDİRİM ŞERİDİ (h40, max 760) ─┐  │                  │
      │ [ikon] metin …………… [Yap ›] │ ⓢ 29 gün · Maaş −$2.6K │ ⌃ │  │                  │
      └─────────────────────────────────────────────────┘  └──────────────────┘ y=H−72
┌─────────────────────────────────────────────────────────────────────────────┐ y=H−64
│ ALT BAR (h56) [⚡ 84 ▰▰▱] [🔍 Bul][💬 Konuş][♥ Motive][☕][🤝][🛏 Dinlen]      [Mağaza][Ekip][Projeler][Büyüme][Metrikler][Kazanımlar] │
└─────────────────────────────────────────────────────────────────────────────┘ ← EDGE 8 (+safe-bottom)
```

Dikey hesap (H = viewport yüksekliği, safe-area 0 kabul):

| Öğe | top | bottom | yükseklik |
|---|---|---|---|
| Üst bar | 8 | — | 56 (alt kenar y=64) |
| Sağ panel | 72 | 72 (alt barın 8px üstü) | H − 144 |
| Bildirim şeridi | — | 72 | 40 (üst kenar y = H − 112) |
| Alt bar | — | 8 | 56 (üst kenar y = H − 64) |
| Sahne alanı (inset) | 72 | 120 | H − 192 |

Yatay: üst bar ve alt bar **tam genişlik** (left/right 8). Panel `right: 8`. Şerit panel kapalıyken
`left 8 / right 8`, açıkken `right = PANEL_W + 16` (panelin 8px soluna kadar); içerik `max-width: 760px`, alanında ortalı.

### 1.3 Genişliğe göre bütçe

`PANEL_W`: ≥1280 → **400**, 1024–1279 → **360**. Üst bar üç sütunlu grid: `[A auto] [B 1fr, ortalı] [C auto]`, sütun arası 16.

| | 1440 | 1280 | 1024 |
|---|---|---|---|
| Kullanılabilir genişlik (− 2×EDGE − 2×8 dolgu) | 1408 | 1248 | 992 |
| **A — Aşama** | 272 (ilerleme + "$142K / $500K") | 272 | 216 (ilerleme çubuğu, rakam tooltip'te) |
| **B — Göstergeler** Kasa / Runway / Kullanıcı / Moral | 160 / 88 / 88 / 104 | aynı | 128 (Kasa alt satırı değerin altına) / 88 / 80 / 96 |
| B — Sabitlenmiş (104 her biri) | **2** görünür | **1** görünür (+1 "…" düğmesi) | **0** görünür ("📌 2" düğmesi → Metrikler) |
| **C — Zaman + görünüm** | hız 4×36 (+duraklı etiket ≤ 84) · zoom 2×40 · TR 48 · ⚙ 40 | TR gizli (dil ayarlarda) | zoom 2×36 |
| Alt bar: kurucu aksiyonları | ikon 20 + kısa etiket, çip h40 (~80px); kilitli = yalnız 40px kilit ikonu | aynı | aynı |
| Alt bar: sekmeler | ikon + etiket (~96px), kbd ipucu yalnız tooltip'te | ikon + etiket (bar genişliği ≥ 1240px ise, `@container`) | yalnız ikon 40×40, **aktif sekme etiketli** |
| Sahne alanı panel kapalı / açık (1440×900, 1280×800, 1024×768) | 1440×708 / 1024×708 | 1280×608 / 872×608 | 1024×576 / 656×576 |

**Uygulamada ölçümle değişenler:** TR düğmesi yalnız ≥ **1536** (1440'ta tur çipi + 2 sabit barı dolduruyor); hız durum etiketi
yalnız ≥ **1440** (altında segment tooltip'lerinde); gösterge hücreleri sabit genişlik yerine içerik kadar (min genişlikli, etiket kesilmez);
A bölümü sabit değil **en az** 256 (≥1280) / 216 (<1280) ve aşama adı kesilmesin diye büyür; sabitli çip bar içinde en fazla 136px.
1024'te A büyüdüğü için B'nin sonundaki "📌 N" düğmesi taşabilir (Metrikler sekmesi yine erişim yolu). Telefon üst barı 98px (spec 96).
Sahne inset'i ölçülen değerler: masaüstü `top 72 · bottom 120 · right 416 (400) / 376 (360)`, 390×844 `top 114 · bottom 164`, sheet açık `bottom 519`.

Sığma kontrolü (en kötü durum, duraklı etiket açık): 1440 → 272+648+356+56+48 = 1380 ≤ 1408; 1280 → 272+544+356+48 = 1220 ≤ 1248;
1024 → 216+392+348+32 = 988 ≤ 992. Alt bar 1280'de: enerji 112 + 6×80 + 5×4 = 612, sekmeler 6×96 + 5×4 = 596, arada ≥ 16 → 1224 ≤ 1248.
Oyunun başında çoğu aksiyon kilitli (40px) olduğundan pratikte bol yer kalır.

### 1.4 Mobil (390×844, safe-top 47, safe-bottom 34)

```
┌──────────────────────────────── ÜST BAR (h96, 2 satır) ┐  top = safe-top + 8 = 55
│ ● Garaj ◔ A2·G2  [Tur 3hf]          [▶1×] [−] [+] [⚙] │  satır 1 h44; altında 2px ilerleme çizgisi
│ Kasa $12.1K ↓$84/g │ Runway 4.8 │ 👥 12 │ ♥ 67          │  satır 2 h44, grid 1.4fr 1fr 1fr 1fr
└─────────────────────────────────────────────────────────┘  alt kenar 151 → inset.top 159
                    S A H N E  (159 … 654 → 495px)
┌── BİLDİRİM ŞERİDİ h36 ─────────────────── [ⓢ 3g] [⌃] ┐  bottom = 34 + 104 + 8 = 146
└─────────────────────────────────────────────────────────┘
┌──────────────────────────────── ALT BAR (h104, 2 satır) ┐  bottom = max(8, safe-bottom) = 34
│ ⚡84  [🔍][💬][♥][☕][🤝][🛏]                             │  aksiyon satırı h44, yalnız ikon (etiket aria + uzun basış ipucu)
│ [Mağaza][Ekip][Projeler][Büyüme][Metrikler][Kazanımlar] │  sekme satırı h48, ikon 20 + 10px etiket; < 360px'te yatay kaydırılır
└─────────────────────────────────────────────────────────┘
```

- **Üst bar:** en fazla 2 satır. Satır 1 = aşama + tarih + tur göstergesi + hız (tek buton, 0→1→2→4 döngüsü, 44) + zoom −/+ (44) + ⚙ (44).
  Aşama ilerlemesi satır 1'in altında 2px brand çizgi, rakamsız. Satır 2 = 4 ana gösterge (sabitlenenler mobilde üst barda **görünmez**, Metrikler'in başında durur).
- **Alt bar:** tek yüzey, iki satır. Sheet açıkken aksiyon satırı gizlenir, bar yalnız sekme satırı (h56) olur; sheet bu barın 8px üstünden başlar.
  (Not: "kaydırılabilir tek satır" yerine iki satır seçildi: 390px'te 6 aksiyon + 6 sekme = 12 × 44px tek satıra sığmıyor ve kaydırınca
  sekmeler görünmez olur. Sekme satırı dar ekranda yine kaydırılabilir.)
- **Bildirim şeridi:** tek satır h36, sağda kompakt ufuk rozeti (ikon + gün) ve geçmiş düğmesi.
  Sheet açıkken yalnız P0/P1/P2 öğeleri (bkz. §3) sheet'in 8px üstünde görünür; P3 (sıradaki adım) gizlenir.
- **Sheet:** bugünkü `max-h 52vh` korunur; `left/right 8`, radius 14, alt bar sekme satırının 8px üstü.
- **Yatay telefon** (`useIsMobile` landscape): üst bar **tek satır** (aşama + 4 gösterge + hız + ⚙, h52), alt bar **tek satır**
  (aksiyonlar + sekmeler, h52), şerit h36 → 390px yükseklikte ~210px sahne kalır.

---

## 2. Her bilginin TEK evi

Kural: kalıcı bir bilgi ekranda **tek bir** yerde durur. Bildirim şeridi **olay** anlatır (değişim, "önce → sonra"),
kalıcı değer göstermez; bu yüzden fişteki "runway 4.8 → 4.6" gibi bir delta tekrar sayılmaz. Panel içerikleri (Büyüme,
Ekip…) kontroller ve dökümler içindir; üst barda/Metrikler'de duran bir sayıyı başlık olarak tekrar etmezler (§2.3).

### 2.1 Tablo

| Öğe | Bölge | Bileşen (yeni) | Kaynak alan (store) | Not / kaldırılan tekrar |
|---|---|---|---|---|
| Aşama adı | Üst bar A | `layout/StageSection.tsx` | `state.stage`, `STAGES` | |
| Tarih (Ay/Gün) + ay halkası | Üst bar A | `StageSection` (`time.tsx › DayClock` sadeleşmiş) | `state.time.day/month` | halka **nötr** (`ink-2`), hız rengi değil |
| Aşama ilerlemesi (değerleme / hedef) | Üst bar A | `StageSection` | `derived.stageProgress`, `finance.valuation`, `derived.valuationParts` | döküm tooltip'te (`valuationLine`) |
| Tur sürüyor "Tur 3/10 hf" | Üst bar A (küçük çip, h24) | `StageSection` | `round.active/weeksLeft/weeksTotal` | **tek ev.** `RoundTimerWidget` sayısı, StageBar "Tur: N hafta" butonu kalkar; tık → Büyüme › Tur |
| "Tur başlat" CTA | Üst bar A (aynı yuva, brand buton h32) | `StageSection` | `derived.canStartRound` | nextStep = tur ise şerit bu adımı göstermez |
| Kasa (kullanılabilir) | Üst bar B | `layout/TopMetrics.tsx › CashChip` | `cashFlow(s).usable` | tooltip: "Kasada $Y − maaşa ayrılan $X" |
| Kasa günlük net "net −$270/gün" | Üst bar B (Kasa alt satırı) | `CashChip` | `cashFlow(s).netDay` | **aylık net Kasa'dan kalkar** (Kâr tahmini'nin evi) |
| Günlük süzülen delta / maaş günü düşüşü | Üst bar B (Kasa üzerinde animasyon) | `CashChip` | `useFreshEvents('payday')`, günlük `netDay` | renk kuralı §4 |
| Runway | Üst bar B | `TopMetrics › RunwayChip` | `finance.runway` | Kasa alt satırındaki "runway 4.8 ay" kalkar. Kavram (`runway`) öğrenilene kadar yuva boş |
| Kullanıcı (+ aşırı yük) | Üst bar B | `TopMetrics › UsersChip` | `stats.users`, `derived.overload` | |
| Moral | Üst bar B | `TopMetrics › MoraleChip` | `stats.morale` | 2px alt çizgi bar |
| Sabitlenmiş metrik 1–2 | Üst bar B (sağ uç) | `WIDGETS[id].Component variant="bar"` | `ui.pinnedMetrics` | aynı metrik Metrikler'de de listelenir ama **üst barda görünürken** panelde "Üst barda" etiketiyle yalnız sabitleme düğmesi kalır (değer çizilmez) |
| Hız kontrolü + zaman durumu | Üst bar C | `layout/SpeedControl.tsx` | `effectiveSpeed`, `time.speed`, `ui.pauseReasons`, `ui.slowdownAt` | "DURAKLATILDI · Karar · 2×'e dönecek" pill'i DayClock'tan **buraya** taşınır (duraklı segmentin etiketi olur) |
| Zoom, dil, ayarlar | Üst bar C | `layout/ViewControls.tsx` | `ui.zoom` | TR yalnız ≥1440 |
| Yakıt (aylık burn) + döküm | Metrikler | `widgets.tsx › BurnWidget` | `cashFlow(s).burn`, `finance.burnBreakdown` | "Yakıt $13.9K/ay = maaş + kira + kurucu + altyapı + reklam" (kurucu payı çubukta eksikti, eklenir) |
| Net aylık (kâra uzaklık) | Metrikler | `ProfitWidget` ("Kâr tahmini") | `cashFlow(s).mrr/burn/netMonth` | "Gelir $5.8K − Yakıt $13.9K = −$8.1K/ay". Kilitliyken aylık net hiçbir yerde yok (Hisset kuralı) |
| Kasa dökümü (bankada / ayrılan) | Metrikler › Para (sabitlenemez satır) | `MetricsPanel` | `cashFlow(s).bank/owed` | eski "Maaş gününe N gün · $X ayrıldı · kasada $Y" satırının evi; gün sayısı **yok** (ufkun evi) |
| Cap table + kurucu payı | Metrikler (tek kart) | `CapTableWidget` (`equity` birleşir) | `stats.equity` | `equity` kilidi karta "kontrol: çoğunluk / paylaşılmış" satırı ekler; ayrı kart yok |
| Tutunma + churn | Metrikler (tek kart) | `RetentionWidget` (`churn` birleşir) | `stats.churn` | "Tutunma %96.5 · churn %3.5/ay" |
| Diğer ikincil metrikler | Metrikler | `widgets.tsx` | bkz. §5.1 | |
| Tur detayı (teklif, pitch) | Sağ panel › Büyüme › Tur | `RoundSection` (değişmez) | `round.*` | Metrikler'de "Tur" satırı değer göstermez, yalnız "Büyüme › Tur'a git" bağlantısı |
| Sıradaki adım | Bildirim şeridi (dinlenme öğesi, P3) | `NotificationStrip` + `NextStepChip variant="strip"` | `derived.nextStep` | StartCall görünürken ve adım "tur" iken gizli |
| Ufuk (en yakın öğe) | Bildirim şeridi sağ yuvası | `Horizon.tsx › HorizonMini` | `derived.horizon[0]` | 6 haftalık çizgi kalkar; tüm liste şerit popover'ında |
| Ufuk listesi + aktivite geçmişi | Şerit popover'ı (⌃) | `Horizon.tsx › HorizonList` + `ActivityHistory` | `derived.horizon`, `state.activity` | `useExclusiveExpander` kuralı korunur |
| Anlık kartlar (fiş, sürüm, sonuç, hedef, tur penceresi/haftası) | Bildirim şeridi (P2) | `NotificationStrip` (`Moments.tsx` → kaynak hook) | engine events | tek satır |
| Yeni metrik duyurusu | Bildirim şeridi (P2) + Metrikler rozeti | `NotificationStrip`, `Dock` rozeti | `state.unlockedWidgets` farkı | |
| Aktivite (son olay) | Bildirim şeridi (P2-düşük) | `NotificationStrip` | `state.activity` | yalnız §3.3 listesindeki türler |
| Hata (reddedilen aksiyon) | Bildirim şeridi (P2, öne geçer) | `NotificationStrip` (`Feedback.tsx › ErrorToast` içeriği) | `ui.lastError` | |
| Yerleştirme modu | Bildirim şeridi (P1) | `NotificationStrip` (`PlacingBanner` içeriği) | `ui.placing` | "İptal" düğmesi korunur |
| Kurucu enerjisi | Alt bar sol | `layout/FounderBar.tsx` | `founder.energy` | |
| Kurucu aksiyonları (+ bekleme, doygunluk ½) | Alt bar sol | `FounderBar` (`FounderActions.tsx` mantığı) | `founder.*`, `derived.findUsers/salesCall` | masaüstünde **etiketli** |
| Panel sekmeleri | Alt bar sağ | `layout/BottomBar.tsx` (`Dock.tsx › DOCK_TABS`) | `ui.panel.kind` | + Metrikler |
| Karar / kavram balonları | Sahne (üst kenar + 8) | `BubbleTray` / world bubbles | — | `top` = `sceneInset.top + 8` |
| Başlat çağrısı | Sahne ortası | `StartCall` | — | `sceneInset` içinde ortalı |
| Zaman akışı | Ekran kenarı (ince) + hız kontrolü | `ScreenFrame`, `SpeedControl` | — | §4 |

### 2.2 Kaldırılanlar

- `Hud.tsx` tümüyle (DesktopHud, MobileHud, StageBar, ViewControls) → `layout/*`.
- Sol üst kart + ikincil ızgara + mobil "+N" açılır ızgara → Metrikler sekmesi.
- `HorizonStrip` (çizgi) → `HorizonMini` + `HorizonList`.
- `MomentFeed`'in yüzen kartları → şeritteki tek satır (içerik `Moments.tsx`'te hook olarak kalır).
- `ActivityLine` yüzen butonu → şerit + popover (`activityText` export'u kalır).
- `GameUI`'deki toast kapsayıcıları (`bottom-[84px]`, mobil `sheetTop + 8`) → şerit.
- `CashWidget`'ın aylık net, owed satırı ve runway parçası; `RoundTimerWidget`'ın sayısı; `EquityWidget` ve `ChurnWidget` ayrı kartları.

### 2.3 Gider: tek tanım

Tek kaynak: `src/ui/cashflow.ts › cashFlow(state)` (türetilmiş, formül yok, engine alanlarını adlandırır):

```
burn     = finance.burn                     // "Yakıt", aylık: maaş + kira + kurucu + altyapı + reklam
mrr      = finance.mrr                      // "Gelir", aylık
netMonth = finance.net                      // = mrr − burn  ("Kâr tahmini" kartı)
netDay   = finance.net / 30                 // "net −$270/gün" (Kasa alt satırı)
owed     = ledger toplamı (maaş günü birikeni)
usable   = stats.cash − owed               // Kasa değeri
bank     = stats.cash                       // Metrikler › Kasa dökümü
```

Etiketler (içerik, bkz. §7): Kasa altı **"net −$270/gün"** (her zaman "net" kelimesiyle), Yakıt **"$13.9K/ay"** alt satırı
"maaş + kira + kurucu + altyapı + reklam", Kâr tahmini **"Gelir $5.8K − Yakıt $13.9K = −$8.1K/ay"**. Böylece üç rakamın ilişkisi okunur ve
ekranda hiçbiri iki kez durmaz. Büyüme panelindeki MRR/CAC/LTV:CAC/kanal `Stat`'ları bu turda kalır (panel içi), izleyen işte
Büyüme yalnız kontrollere indirgenir (açık konu).

---

## 3. Bildirim şeridi

Tek kanal, tek stil, tek satır. Aynı anda **bir** ana mesaj + sağda ufuk yuvası + geçmiş düğmesi.

```
[ikon 24] Ana metin (13px ink semibold) · ikincil (12px ink-2)   [eylem çipi]  │ [ⓢ 29 gün · Maaş −$2.6K] │ [⌃]
```

- Yüzey `.ui-card`, h40 (mobil 36), dolgu 8, ikon karosu 24 (radius 7, öğe renginin %16'sı).
- Tüm metin **tek satır**; sığmayan kısım `truncate` + `title`. Uzun içerik (ay fişi dökümü) tıklayınca panelde açılır.
- Geçici öğelerde altta 2px ilerleme çizgisi kalan süreyi gösterir. Hover (masaüstü) süreyi durdurur.
- Tıklama ilgili paneli açar ve geçici öğeyi kapatır. Değişim animasyonu: 150ms `slide-up` + crossfade.
- `aria-live="polite"`; P0 `role="alert"`.

### 3.1 Öncelik

Üstteki alttakini **ezer** (ana yuvayı alır). Ezilen geçici öğe kuyrukta bekler (süresi işlemez), kalıcı öğe geri gelir.

| P | Tür | Örnek metin | Süre | Tık → |
|---|---|---|---|---|
| **P0** | İflas sayacı (`finance.payrollMissed`) | "Maaş ödenemedi · iflasa {60 − negativeCashDays} gün" | koşul sürdükçe, kapatılamaz | Metrikler › Para |
| P0 | Runway 3 ayın altına indi (geçiş anı) | "Runway 3 ayın altında: {v} ay" | 6 sn (sonra yalnız üst barda kırmızı) | Metrikler › Kâr tahmini |
| **P1** | Yerleştirme modu (`ui.placing`) | "Masa seç: Ayşe · [İptal]" | mod sürdükçe | — |
| **P2** | Hata (`ui.lastError`) | "Enerjin yetmiyor, önce dinlen" | 2.6 sn, kuyruğu beklemeden öne geçer | — |
| P2 | Ay fişi (payday) | "Ay 1 fişi · ödenen −$1.5K · net −$2.5K · runway 4.8 → 4.6 ay" | 4 sn | Metrikler › Yakıt |
| P2 | Sürüm anı | "web-1 v1 yayında · +9 kullanıcı · +$27/ay" | 4 sn | Projeler |
| P2 | Karar → sonucu | "Yan iş seçiminden: +$1.5K" | 4 sn | Büyüme |
| P2 | Hedef tamam | "☆ Hedef tamam: İlk sürümü çıkar" | 3.5 sn | Büyüme |
| P2 | Tur penceresi / tur haftası | "Tur penceresi açıldı" / "Tur 3/10 · teklif $1.2M → $1.3M" | 4 / 3.5 sn | Büyüme › Tur |
| P2 | Yeni metrik | "Yeni gösterge: Yakıt · üst bara sabitlendi" / "… · Metrikler'de" | 5 sn | Metrikler (odak) |
| P2-düşük | Aktivite (§3.3) | "Ayşe işe başladı" | 3 sn | ilgili panel |
| **P3** | Sıradaki adım (dinlenme) | "6/8 · 12 kullanıcıya ulaş · 50 hedef [Yap ›]" | kalıcı | `followStep` |
| P4 | Boş durum | (şerit gizlenir; inset değişmez, bkz. §6) | — | — |

Kuyruk kuralları (`src/ui/layout/stripRules.ts`, React'siz, test edilir; `momentRules.ts`'teki `mergeMoments`, `MOMENT_LIFE_MS`,
`MOMENT_QUEUE_MAX` yeniden kullanılır):

1. Aynı anda **1** öğe görünür (masaüstü ve mobil). Bekleyen en fazla 3; taşarsa en eski **bekleyen** düşer.
2. Fiş ve tur haftası aynı türden eskisini yerinde değiştirir (bugünkü `MERGE_KINDS`). Fiş şeritte **her zaman** tek satırdır.
3. 4× hızda geçici süreler 0.75× olur (min 2.5 sn); kuyrukta aynı türden 2'den fazla öğe birikmez.
4. Aktivite öğesi, son 2 sn içinde aynı olayı anlatan bir P2 anlık öğe geldiyse gösterilmez.
5. Sıradaki adım şu durumlarda gizli: `StartCall` görünür, `nextStep.id === 'round'` ve üst barda "Tur başlat" var, oyun bitti.
6. Mobilde sheet açıkken P3 gizlenir; P0–P2 sheet'in üstünde gösterilir.

### 3.2 Ufuk yuvası

- Masaüstü (şerit ≥ 560px): `HorizonMini` = ikon + "{gün} · {etiket}" ("29 gün · Maaş −$2.6K"), en yakın öğe. Dar: yalnız ikon + gün.
- Mobil: kompakt rozet "ⓢ 3g" (ikon + gün, 56px).
- Tık veya ⌃ → popover (şeridin üstünde, max-h 280): **Yaklaşan** (tüm `derived.horizon`, gün sırasıyla, etiketli) + **Son olaylar** (son 8 aktivite).
- Ufuk ikonları artık bir çizgi üzerinde üst üste binmez; liste satırlarıdır.

### 3.3 Şeritte gösterilen aktivite türleri

Göster: `hired, fired, resigned, resignWarning, retained, projectLaunched, founderActionDone, roundStarted, roundClosed, roundShrunk,
milestone, enterpriseWon, enterpriseLost, decisionDefaulted`.
Gösterme (oyuncunun kendi tıkı zaten görünür ya da P0/P2 anlatıyor): `itemPlaced, itemSold, itemMoved, ringOpened, projectStarted,
founderActionStarted, payday, release, goalDone, roundWindow, roundOffer, roundPitch, roundProgress, delayedEffect, stageUp,
bankruptWarning, payrollMissed`. Hepsi popover geçmişinde durur.

---

## 4. Kırmızı ve hız rengi

### 4.1 Tek kırmızı kuralı

`--color-negative` / `negative-ink` **yalnız oyunu bitirebilecek tehlikede**:

| Tehlike | Nerede kırmızı |
|---|---|
| Runway < 3 ay | Üst bar Runway değeri + nokta + `animate-danger-pulse` (Kasa **değil**) |
| Kullanılabilir kasa < 0 / iflas sayacı (`payrollMissed`) | Üst bar Kasa değeri + şerit P0 |
| Maaş günü kaçtı (`payrollMissed` olayı) | Şerit P0 |
| Moral < 28 (istifa dalgası) | Üst bar Moral değeri + nokta; Metrikler › Ekip morali'nde tükenmiş bandı |

Kırmızıdan **çıkanlar** (yeni renk):

| Öğe | Eskisi | Yenisi |
|---|---|---|
| Duraklatma (çerçeve, segment, pill) | kırmızı | nötr `ink-3`, kesik çizgi (§4.2) |
| Aşama kartı kenarı | hız renginde 2px | yok (bar 1px `border`) |
| Kasa günlük net negatif, günlük süzülen "−$50" | kırmızı | `ink-2` (pozitifse `positive-ink`) |
| Maaş günü büyük düşüş "−$1.5K" | kırmızı | `ink`, kalın (tehlike değil, ritim) |
| Ufukta maaş işareti (runway dar) | kırmızı | nötr (tehlikenin evi Runway) |
| Fiş "Net −$2.5K" | kırmızı | `ink` |
| Tur haftası teklif düştü | kırmızı | **uyarı** |
| Düşük enerji (< 20) | kırmızı | **uyarı** |
| Eşik uyarıları: LTV:CAC < 3, churn > %8, teknik borç > 50, koordinasyon kaybı, gelir yoğunlaşması > %30, kurucu payı < %50, runway 3–6 | kırmızı nokta/sayı | **uyarı** |
| Hata ikonu | kırmızı | **uyarı** |
| Dock rozetleri (ayrılan çalışan, bekleyen kavram, yeni metrik) | kırmızı | `brand` dolgu (sayaç), ayrılan çalışan **uyarı** |

**Uyarı** = mevcut `energy` (nokta/dolgu) + `energy-ink` (sayı metni, AA). Yeni token açılmaz. Runway 6–12 ay bandı
(`lemon-600`) ve 3–6 (`peach-600`) bugünkü gibi kalır ama yalnız Runway değerinde.

### 4.2 Hız rengi

Hız rengi (`--color-speed-1/2/4`) **yalnız iki yerde**: hız kontrolünün aktif segmenti ve ince ekran kenarı (`ScreenFrame`).
Ay halkası, aşama bölümü, tarih yanındaki nabız noktası hız rengi **taşımaz** (nötr `ink-2`; nabız noktası kalkar,
çünkü akışı kenar zaten söylüyor).

| Durum | Ekran kenarı | Hız kontrolü |
|---|---|---|
| Akıyor 1×/2×/4× | 2px (mobil) / 3px düz, hız renginde, günlük hafif parıltı | aktif segment %22 dolgu + 2px iç halka, hız renginde |
| Oyuncu duraklattı | 2/3px **kesik**, `--color-speed-pause` = **`ink-3` (#9B978F)** | ⏸ segmenti `surface-2` + `ink-3` halka, "▶" gösterir; etiket "Duraklatıldı" (`ink-2`) |
| Odak duraklaması (karar/kavram/teklif/modal) | kesik `ink-3` + seçili hızın %22'lik iç bandı | ⏸ segmenti aktif (nötr), seçili hız segmentinde kesik çerçeve; etiket "Karar · 2×'e dönecek" |
| 4× → 1× otomatik yavaşlama | 1× rengi | 3.5 sn "Önemli an · 1×" etiketi |
| Oyun bitti | yok | devre dışı |

Duraklatma tehlike değildir: kırmızı değil, gri + kesik (renk tek sinyal değil, düz/kesik ayrımı da taşır).
`docs/DESIGN.md` › Time state bölümü buna göre güncellendi.

---

## 5. Metrikler sekmesi ve sabitleme

### 5.1 Sekme

Dock sırası: **Mağaza (M) · Ekip (E) · Projeler (P) · Büyüme (B) · Metrikler (G) · Kazanımlar (K)**. Kısayol `G` ("gösterge";
M ve E dolu). İkon `bars`. Panel `{ kind: 'metrics'; focus?: HudWidget }` (odak verilirse o karta kaydırır ve 1.5 sn vurgular).
Metrikler **hiçbir zaman duraklatmaz** (pauseReasons'a girmez).

İçerik (açılan metriklere göre, gruplar yalnız dolu ise görünür):

| Grup | Kartlar (HudWidget) | Sabitlenebilir |
|---|---|---|
| Para | *Kasa dökümü* (bankada / maaşa ayrılan), Yakıt (`burnBreakdown`), Kâr tahmini (`profitProjection`), Cap table (`capTable` + `equity`), Gelir dağılımı (`revenueDistribution`) | Kasa dökümü hayır, diğerleri evet |
| Büyüme | Tutunma (`retention` + `churn`), ARPU (`arpu`), LTV:CAC (`ltvCac`), Kanallar (`channelBreakdown`), İtibar (`reputation`) | evet |
| Ekip | Ekip morali (`moraleHeatmap`), Koordinasyon (`coordinationWarning`), Kültür (`cultureBadge`), Teknik borç (`debtCounter`) | Kültür hayır (rozet), diğerleri evet |
| Yol | Tur (`roundTimer`: değer yok, "Büyüme › Tur'a git" bağlantısı), Yolun (`archetypeBadge`) | hayır |

`cash, users, morale, runway` üst barın sabit göstergeleridir, Metrikler'de kart olarak yer almaz, sabitlenemez.
`candidateQuality` bugünkü gibi Ekip panelinde kalır.

Kart satırı: `WidgetChip` (panel varyantı, tam genişlik) + sağda sabitleme düğmesi (IconButton `pin`, 36 masaüstü / 44 mobil,
`aria-pressed`) + bir satır açıklama ("Kavram: Burn ›" → Kazanımlar'da o kart). Sabitli kart üst barda görünürken
panelde değerini çizmez, "Üst barda" etiketi taşır (tekrar yok); görünmüyorsa (dar ekran) değeri çizer.
Listenin sonunda: "{n} gösterge daha kavramlarla açılacak" (isim yok, Hisset kuralı).

Yeni açılan metrik (PLAN Hisset → Adlandır → **Kullan**): Dock'ta Metrikler rozeti (brand, sayı = görülmemiş sabitlenebilir
metrik), şeritte P2 duyuru, panelde kartta "Yeni" etiketi + `brand-soft` zemin 4 sn. Panel açıldıktan 1.5 sn sonra görülenler
`seenMetrics`'e yazılır.

### 5.2 Veri modeli (store — yalnız METRICS şeridi)

`src/store/types.ts`:

```ts
export type DockTab = 'shop' | 'team' | 'projects' | 'growth' | 'metrics' | 'journal'
// Panel union'a:
| { kind: 'metrics'; focus?: HudWidget }

// UiState'e:
/** Üst bara sabitlenen en fazla 2 metrik, eskiden yeniye. Kilitli olan görünmez ama yerini korur. */
pinnedMetrics: HudWidget[]
/** Metrikler sekmesinde görülmüş metrikler; geri kalan açık + sabitlenebilir olanlar "yeni" sayılır. */
seenMetrics: HudWidget[]
/** Oyuncu en az bir kez elle sabitledi/kaldırdı: otomatik sabitleme artık çalışmaz. */
pinTouched: boolean

// GameStore'a:
pinMetric(id: HudWidget): void      // zaten varsa no-op; 2 doluysa EN ESKİYİ (index 0) çıkarır; pinTouched = true
unpinMetric(id: HudWidget): void    // pinTouched = true
markMetricsSeen(ids: readonly HudWidget[]): void
```

Kurallar (`gameStore.ts`):

- `PIN_MAX = 2`. Sabitlenebilirlik registry'den (`WIDGETS[id].pinnable`); store bunu `src/ui`'dan import etmez,
  `src/store/metricPins.ts` içinde saf bir `PINNABLE` kümesi tutulur (registry testle eşitliği doğrular).
- **Otomatik sabitleme:** her `dispatch`/`tick` sonrası `state.unlockedWidgets` uzadıysa, yeni her `id` için:
  `!pinTouched && PINNABLE.has(id) && effectivePins.length < 2` → sona ekle. `effectivePins = pinnedMetrics ∩ unlockedWidgets`.
- `newGame()`: `pinnedMetrics` ve `pinTouched` korunur (zoom gibi, `keptUi`), `seenMetrics = INITIAL_WIDGETS`.
  `load()`: üçü de kayıttan; kayıtta `seenMetrics` yoksa `= state.unlockedWidgets` (rozet yağmuru olmaz).
- **Kalıcılık:** `src/store/save.ts`'e `UI_KEY = 'be-unicorn:ui'`, `readUiSave(): Partial<{pinnedMetrics, seenMetrics, pinTouched}>`,
  `writeUiSave(...)` (sürümlü `{ v: 1, ... }`, her erişim try/catch, bilinmeyen id'ler süzülür). Pin/unpin/markSeen sonrası yazılır.
  Oyun kaydı (`be-unicorn:save`) değişmez, engine'e dokunulmaz.
- `pauseReasonsOf` değişmez; `togglePanel('metrics')` diğer sekmeler gibi.

### 5.3 Registry sözleşmesi (`widgets.tsx`, METRICS)

```ts
export interface WidgetDef {
  id: HudWidget
  icon: IconName
  color: string
  tier: 'primary' | 'secondary' | 'hidden'
  /** i18n anahtarı (hud.*): şerit duyurusu ve sabitli çip bunu okur. */
  labelKey: string
  group: 'money' | 'growth' | 'team' | 'path'
  pinnable: boolean
  /** Başka bir kartın içine katlanır (churn → retention, equity → capTable). */
  mergedInto?: HudWidget
  /** variant: 'panel' (Metrikler kartı), 'bar' (üst bar çipi, h40, alt çubuk yok), 'compact' (eski mobil; geçiş süresince). */
  Component: ComponentType<{ compact?: boolean; variant?: 'panel' | 'bar' | 'compact' }>
}
```

`ledgerMoney`, `runwayTone`, `WidgetChip` export'ları korunur (TOP import eder, `momentRules.test.ts` kullanır).

---

## 6. sceneInset hesabı

`SceneInset { top, right, bottom }` sözleşmesi değişmez; yazan **tek** yer `src/ui/layout/useSceneInset.ts` olur
(RightPanel'deki `useSceneInsetReporter` kalkar). Ölçüm DOM'dan, `ResizeObserver` + `resize` + sheet animasyonu için 350 ms gecikmeli
ikinci ölçüm (bugünkü gibi). İşaretler:

| Öznitelik | Eleman |
|---|---|
| `data-scene-top` | TopBar kökü (BubbleAnchor bunu zaten okuyor, korunur) |
| `data-scene-bottom` | Şerit + alt bar sarmalayıcısı (şerit boşken yalnız alt bar) |
| `data-scene-right` | Masaüstü sağ panel `<aside>` |
| `data-scene-sheet` | Mobil sheet `<section>` |

```
GAP = 8
top    = topBar.bottom + GAP
bottom = vh − min(bottomStackTop, sheetTop ?? ∞) + GAP      // bottomStackTop: bar üstü, şerit varken şerit üstü
right  = masaüstü && panel açık ? vw − panel.left + GAP : 0
```

- Şerit **dinlenme durumunda da** yer tutar (P3 sıradaki adım neredeyse hep var); şerit tamamen boşken bile
  `bottomStackTop` şeridin rezerve yüksekliğini sayar (kamera her mesajda zıplamasın diye `STRIP_H + GAP` sabit rezerv).
  Mobilde sheet açıkken şerit inset'e **katılmaz** (geçici).
- Sonuç değerler: masaüstü `top 72, bottom 120, right 0 | 416 (PANEL 400) | 376 (PANEL 360)`; mobil 390×844 `top 159, bottom 190 (safe dahil: 34 + 104 + 8 + 36 + 8), right 0`, sheet açık `bottom ≈ 545`.
- Tüketiciler değişmez: `render/OfficeScene.tsx › CameraRig` (availW/availH), `render/BubbleAnchor.tsx › sceneViewport`.
  `BubbleTray` `top` değeri sabit 84/128 yerine `sceneInset.top + 8`; `StartCall` sahne alanında (`top/right/bottom` inset'ten) ortalanır.

---

## 7. Dosya sahipliği (3 paralel şerit + Integrate)

Başka bir oturum da çalışıyor olabilir: her şerit işe `git status`/dosya tarihleriyle başlar, kendi başlatmadığı
değişikliği silmez/üstüne yazmaz, **Edit** ile çalışır. Kimse commit etmez. Tarayıcı kontrolü `npx playwright` (chromium headless),
package.json'a eklenmez; dev sunucusu http://localhost:5173 kapatılmaz.

### 7.1 TOP şeridi

Yeni: `src/ui/layout/TopBar.tsx`, `StageSection.tsx`, `TopMetrics.tsx` (Cash/Runway/Users/Morale çipleri; `CashWidget`
mantığı buraya taşınır: tween, günlük/maaş günü düşüşleri), `SpeedControl.tsx` (Hud'dan taşınır + zaman durumu etiketi),
`ViewControls.tsx`, `src/content/topBarText.ts` (+ `content/index.ts`'e tek satır spread).
Değişir: `src/ui/time.tsx` (DayClock nötr halka, nabız noktası kalkar, `TimeStatusPill` SpeedControl'e taşınır ve nötr,
`ScreenFrame` duraklı = `ink-3` kesik), `src/index.css` **yalnız** `--color-speed-pause: #9b978f` (+ yorum satırı).
Sözleşme: `TopBar({ pinned }: { pinned: HudWidget[] })` — store'daki `pinnedMetrics`'i okumaz (METRICS ile paralel
derlensin diye); Integrate bağlar. Sabitli çipi `WIDGETS[id].Component` ile `variant="bar"` çizer. Kök `data-scene-top`.
Dokunmaz: store, `Hud.tsx` (Integrate siler), `widgets.tsx` (yalnız import).

### 7.2 BOTTOM şeridi

Yeni: `src/ui/layout/BottomBar.tsx` (FounderBar + sekmeler, `@container` ile etiket kırılımı, mobil iki satır),
`FounderBar.tsx`, `NotificationStrip.tsx`, `stripRules.ts` + `stripRules.test.ts`, `src/content/bottomBarText.ts` (+ index spread).
Değişir (içerikleri buraya akar): `FounderActions.tsx` (mantık `FounderBar`'a; etiketli çip, uyarı rengi), `Dock.tsx`
(`DOCK_TABS`'e `{ id: 'metrics', icon: 'bars', key: 'g' }` Büyüme'den sonra; rozet renkleri; yüzen dock kalkar),
`ActivityLine.tsx` (`activityText` kalır, `ActivityHistory` listesi), `Horizon.tsx` (`HorizonMini`, `HorizonList`; çizgi kalkar),
`NextStepChip.tsx` (`variant="strip"`), `Moments.tsx` (kartlar → `useMomentSource()` hook + tek satır gövde), `momentRules.ts`
(+ test: fiş şeritte hep tek satır, 4× süre çarpanı), `Feedback.tsx` (ErrorToast/PlacingBanner gövdesi şeride).
Yeni metrik duyurusu için `state.unlockedWidgets` farkını kendisi izler (`ui.generation` değişince sıfırlar) ve etiketi
`t(WIDGETS[id].labelKey)` ile alır. Kök sarmalayıcı `data-scene-bottom`.
Dokunmaz: store (`DockTab`'e `'metrics'` METRICS ekler; o gelene kadar tsc hatası beklenir, cast yazılmaz), `GameUI.tsx`, `RightPanel.tsx`.

### 7.3 METRICS şeridi

İlk adım (diğer şeritler buna dayanır): `src/store/types.ts` (DockTab, Panel, UiState alanları, aksiyonlar) ve `src/ui/cashflow.ts`.
Sonra: `src/store/gameStore.ts` (başlangıç, `keptUi`, aksiyonlar, otomatik sabitleme, kalıcılık), `src/store/metricPins.ts`,
`src/store/save.ts` (`be-unicorn:ui`), `src/store/gameStore.test.ts` (pin kuralları: 3.'sü en eskiyi atar, otomatik sabitleme,
pinTouched, newGame/load), `src/ui/widgets.tsx` (§5.3 registry, `bar` varyantı, churn/equity birleşmesi, kırmızı → uyarı,
Yakıt çubuğuna kurucu payı), `src/ui/panels/MetricsPanel.tsx`, `src/content/metricsText.ts` (+ index spread),
`src/ui/RightPanel.tsx` **yalnız** `PanelBody` case'i ve `panelMeta` ikonu, `src/ui/icons.tsx` **yalnız** yeni `pin` ikonu (bugün yok).
Dokunmaz: `layout/*`, `Hud.tsx`, `GameUI.tsx`, `time.tsx`.

### 7.4 Paylaşılan: `src/ui/layout/tokens.ts`

İlk ihtiyaç duyan şerit **birebir** bu içerikle oluşturur; varsa dokunmaz:

```ts
// Layout scale (docs/LAYOUT.md §1). One spacing unit, one surface family.
export const GAP = 8
export const EDGE = 8
export const BAR_H = 56
export const CONTROL = 40
export const STRIP_H = 40
export const STRIP_H_MOBILE = 36
export const MOBILE_TOP_H = 96
export const MOBILE_BOTTOM_H = 104
export const MOBILE_BOTTOM_TABS_H = 56
export const PANEL_W = 400
export const PANEL_W_NARROW = 360
export const PANEL_NARROW_BELOW = 1280
export const PIN_VISIBLE = (vw: number): number => (vw >= 1440 ? 2 : vw >= 1280 ? 1 : 0)
```

`src/ui/cashflow.ts` (METRICS oluşturur; TOP erken ihtiyaç duyarsa birebir aynısını yazar):

```ts
// One definition of money flow (docs/LAYOUT.md §2.3). Names engine fields, no new formulas.
import type { GameState } from '../engine/types'

export interface CashFlow { mrr: number; burn: number; netMonth: number; netDay: number; owed: number; usable: number; bank: number }

export function cashFlow(s: Pick<GameState, 'stats' | 'finance'>): CashFlow {
  const l = s.finance.ledger
  const owed = l ? l.salaries + l.rent + l.infra + l.ads + (l.founder ?? 0) : 0
  return { mrr: s.finance.mrr, burn: s.finance.burn, netMonth: s.finance.net, netDay: s.finance.net / 30, owed, usable: s.stats.cash - owed, bank: s.stats.cash }
}
```

(Selector'da `useShallow` ile kullanılır.)

### 7.5 Integrate ajanı (şeritler bittikten sonra)

`src/ui/GameUI.tsx` birleşimi (TopBar + RightPanel + şerit/alt bar; `pinned` bağlama; toast kapsayıcıları kalkar),
`src/ui/Hud.tsx` silinir (importçu kalmadığı doğrulanarak), `src/ui/layout/useSceneInset.ts`, `RightPanel.tsx` konumu
(`top 72`, `bottom 72`, `PANEL_W` 400/360, `data-scene-right/sheet`, eski inset raporlayıcı kalkar, mobil sheet alt bar üstü),
`src/ui/bubbles/index.tsx` (`BubbleTray` top = inset), `StartCall` sınırları, `momentPanel('receipt')` → `{ kind: 'metrics', focus: 'burnBreakdown' }`,
`shortcut.tabs` metni, `docs/DESIGN.md` §6 şerit tablosu. Doğrulama: `npx tsc -b`, `npx vitest run`, Playwright ekran görüntüleri
1440×900, 1280×800, 1024×768, 390×844 (panel kapalı/açık, duraklı/akan, runway < 3) → `docs/screenshots/layout-*.png`.

### 7.6 Bozulmayacak davranışlar (kabul listesi)

- `pauseReasons` (modal/decision/concept/offer) aynen; Metrikler duraklatmaz.
- Kısayollar: Space, 1/2/3, M/E/P/B/K (+ G), Esc, +/−; `isTypingTarget` kuralı.
- Tek panel: sekme aynı sekmeyle kapanır, `openPanel({root})`, geri düğmesi; mobilde şerit popover'ı ve sheet `useExclusiveExpander` ile birbirini kapatır.
- Balon yerleşimi `sceneInset` + `[data-scene-top]` ile çalışır; world bubbles modu etkilenmez.
- `ScreenFrame` `data-testid="screen-frame"` ve `data-state` değerleri (`1x/2x/4x/focus/paused`) korunur (testler okuyor olabilir).
- Mobil dokunma hedefleri ≥ 44, masaüstü kontroller 40; kesilen etiket yok (sığmayan kısaltma + `title`/`aria-label`).
