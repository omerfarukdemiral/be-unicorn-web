# Be Unicorn — Şerit Sözleşmeleri

Tek gerçek kaynak: `docs/PLAN.md`. Kararlar: `docs/DECISIONS.md`. Bu belge, paralel çalışan şeritlerin (engine, content, render, ui, integrate) birbirini beklemeden çalışabilmesi için sınırları tanımlar.

- Kod, tanımlayıcılar, yorumlar: **İngilizce**, kısa. Oyuncuya görünen her metin: **Türkçe** ve yalnızca `src/content/` içinde.
- Görsel asset dosyası yok. 3D = prosedürel low-poly primitive, UI = HTML/CSS + inline SVG.
- Masaüstü web öncelikli, mobil tarayıcıda oynanabilir (dokunmatik + dar ekran).
- Importlar göreli yol ile (`../engine/types`), alias yok.

## 1. Katman grafiği

```
content ──(veri)──▶ engine ──▶ store ──▶ render
   │                             │  └──▶ ui
   └──────────(metin, katalog)───┴──────▶ render, ui
sim ──▶ engine + content (store/render/ui yok)
```

| Katman | Import edebilir | Import EDEMEZ |
|---|---|---|
| `src/engine` | `src/content` (yalnızca `src/content/index.ts` barrel'ı), kendi dosyaları | react, three, DOM, store, render, ui |
| `src/content` | `src/engine/types.ts` (**yalnızca `import type`**) | engine runtime, store, render, ui |
| `src/store` | engine, content | render, ui |
| `src/render` | store, content, `engine/types` (tipler + sabitler) | engine runtime fonksiyonları (`step`, `applyAction`…), ui |
| `src/ui` | store, content, `engine/types` (tipler + sabitler) | engine runtime fonksiyonları, render (tek istisna §6'daki `ObjectPreview`) |
| `sim/` | engine, content | store, render, ui, DOM |

**Kural:** render ve ui oyun durumunu yalnızca `useGameStore` üzerinden okur ve yalnızca `dispatch(action)` ile değiştirir. Formül ya da türetilmiş metrik hesaplamazlar; ihtiyaç duyulan her sayı `state.derived` / `state.finance` içinde gelir. Eksikse engine şeridinden alan istenir.

## 2. Dosya sahipliği

Bir dosyaya yalnızca sahibi yazar. Sözleşme dosyalarına yapılan değişiklikler **yalnızca ekleme** olabilir (yeni opsiyonel alan, yeni union üyesi). Yeniden adlandırma/silme yasak.

| Şerit | Sahip olduğu dosyalar |
|---|---|
| **scaffold** (bitti) | `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `.gitignore`, `docs/CONTRACTS.md` |
| **engine** | `src/engine/**` (`types.ts` yalnızca ekleme; `rng.ts` değiştirilmez, kullanılır), `sim/**` |
| **content** | `src/content/**` (`types.ts` yalnızca ekleme; `stages.ts` sayıları [DENGE] engine ile konuşularak) |
| **render** | `src/render/**` (`palette.ts` dahil) |
| **ui** | `src/ui/**`, `src/index.css` (tema token'ları) |
| **integrate** | `src/App.tsx`, `src/main.tsx`, `src/store/gameStore.ts`, `src/store/loop.ts`, `src/store/save.ts`, `src/store/bootstrapState.ts` (silinebilir) |

`src/store/types.ts` sözleşmedir: yalnızca ekleme, değişiklikleri integrate yapar.

## 3. Engine şeridi

**Sorumluluk:** PLAN §4–§6 mekaniklerinin tamamı; saf, deterministik.

- Giriş noktası `src/engine/index.ts`, şunları export eder (tip: `EngineApi`, `src/engine/types.ts`):
  - `createGame(opts: NewGameOptions): GameState`
  - `step(state: GameState, dtDays: number): GameState` — **tek tick fonksiyonu**, oyun ve sim aynısını çağırır.
  - `applyAction(state: GameState, action: Action): ActionResult` — geçersiz aksiyon `ok:false` + `error: ActionErrorCode` + değişmemiş state.
- Önerilen dosyalar (PLAN §8.2): `state.ts` (createGame), `tick.ts`, `economy.ts` (§5), `office.ts` (aşama başına slot yerleşimi, halka açma), `concepts.ts`, `decisions.ts`, `founder.ts`, `round.ts`, `balance.ts` (TÜM sabitler), `*.test.ts`.
- `step` ve `applyAction` girdiyi **mutasyona uğratmaz** (içeride `structuredClone` + mutasyon serbest). Aynı state + aynı girdi ⇒ aynı çıktı.
- Rastgelelik yalnızca `src/engine/rng.ts` (`new Rng(state.rng)` … `next.rng = r.snapshot()`). `Math.random`, `Date.now` yasak.
- `state.derived` her `step` sonunda (ve her başarılı `applyAction` sonunda) yeniden hesaplanır.
- Günlük mantık `time.day` tamsayı sınırını geçince çalışır; aylık mantık (MRR/users snapshot, maaş kesimi) 30 günde bir.
- Kavram tetikleri: her gün `CONCEPTS[].trigger(state)` değerlendirilir, tetiklenen `concepts.triggered` + `queue`'ya girer; `active` boşsa kuyruğun başı `active` olur. `openConcept` → `learned` + `unlocks` (widget ise `unlockedWidgets`, tool ise `unlockedTools`). `minimizeConcept` → `minimized` listesine taşır ve sıradakini açar.
- Karar kartları: engine seçer (aşama, `condition`, `once`, `weight`, deterministik RNG), `decisions.active` doldurur, genelde bir `Visitor` (purpose `'decision'`) yaratır. `answerDecision` efektleri uygular, `delayed` varsa `decisions.pending`'e ekler, `lastAnswer`'ı set eder.
- Ortam balonları: engine `OFFICE_LINES`'tan duruma göre seçer, `state.bubbles`'a yazar (`untilDay` ≈ şimdi + 1.5 gün = 3 sn @1x).
- Aktivite satırları `state.activity` (son ~30), tek seferlik efektler `state.events` (son ~64, artan `id`). Engine metin üretmez: `ActivityKind` + `params`, metni content çevirir.
- İflas: maaş günü kasayı eksiye düşürürse (`payrollMissed` olayı, `finance.payrollMissed = true`, kurtarma kartı `emergency-bridge` hemen gelir: bekleyen cevapsız kart kuyruğa geri döner, tekrar bekleme süresi atlanır ama `REPEAT_CARD_MAX` geçerli) sayaç başlar; `finance.negativeCashDays ≥ 60` veya ekip 0 (ilk işe alımdan sonra) ⇒ `gameOver` (tam 3 `PostMortemReason`). Maaş günleri arasındaki anlık eksi sayacı başlatmaz; `kasa − birikmiş borç ≥ 0` olunca sayaç sıfırlanır. Unicorn ⇒ `gameOver.kind = 'unicorn'`.
- Kararlar (Faz 3): cevapsız kart `DecisionCard.defaultAfterDays ?? DECISION_DEFAULT_AFTER_DAYS` (60; kurtarma kartı 14) gün sonra `DecisionCard.defaultOption` seçeneğini uygular (yoksa son seçenek; `decisionDefaulted` olayı). Gecikmeli etkiler en fazla `DECISION_DELAY_MAX_DAYS` (30) gün sonra gelir. `emergencyLoan` / `bridgeLoan` bayraklı seçeneğin getirdiği para `finance.debt` olur.
- İnceleme düzeltmeleri (DECISIONS #18):
  - Sürüm: 1.0'daki projenin yapıcıları güncelleme çıkarır (`Project.updateProgress`, `Project.updates`; `ReleaseEntry.update` ve `HorizonItem.update` dolu = güncelleme, `level` 5 kalır). `release` aktivitesi `update` parametresi taşır. `state.releaseCount` toplam sürüm + güncelleme.
  - Aşama hedefleri: `StageGoal.check(s, base)`; `state.stageStart` (`StageBaseline`) `enterStage` ve `createGame`'de yazılır, yoksa `checkGoals` o gün yazar ve o gün hedef kilitlemez.
  - Gelir: yayında proje yoksa MRR yalnızca kurumsal sözleşmelerdir (beta kullanıcı ödemez). Değerleme `max(gelir öncesi, MRR × 12 × çarpan × min(1, MRR / $1K))`. `derived.valuationParts` dökümü verir.
  - Satış görüşmesi: `derived.salesCall` önizleme; ayın ilk `SALES_CALL_FULL_PER_MONTH` anlaşması tam, sonrakiler × 0.5 katlanarak; `EnterpriseCustomer.untilDay` (`SALES_CONTRACT_DAYS` = 360) gelince müşteri `enterpriseLost` aktivitesiyle ayrılır. `talkToUsers` 1.0 projede sonraki güncellemeye ilerleme ekler.
  - Tur: tutar `roundBurn` (maaş + kira + altyapı + kurucu + min(reklam bütçesi, son maaş gününde ödenen reklam)) × `ROUND_NEW_BURN_MULT` × ay, taban ve tavan tablo × {0.5, 0.7} × ay/18; teklif her hafta bugünkü burn'le yeniden ölçülür (`round.amountBy`). Teklif çarpanı `clamp(0.5, 1.15, √(fiyat_başlangıç × fiyat_bugün) × due-diligence) + pitch izlenimi`; izlenim (`round.pitchBonus`) pitch'lerin ortalaması (pitch istenen her hafta paydada, `round.pitchWeeks`), ±0.15. "Hikâye anlat" `[min, max]` aralığında seeded rastgele (`PitchOption.min/max`). Due-diligence büyümesi ve "Metrik göster" 3 aylık ortalamaya bakar. `RoundView`: `ceiling`, `pitchBonus`, `pitchCap`, `weeksMin/Max`, `priceAtStart`.
  - Store: taşınma modalı ("Yeni ofise geç") kapanınca `time.speed = 0`, `ui.runStarted = false` (replay'e yazılmaz). 4× yavaşlatma: karar kartı yalnızca aşamanın ilk kartında, sürüm yalnızca sürüm seviyesinde (güncelleme değil), maaş günü yalnızca runway 3 ayın altına ilk düştüğünde.
- Para (Faz 3): `finance.burnBreakdown.founder` / `ledger.founder` / `lastReceipt.founder` = kurucu yaşam gideri (`FOUNDER_LIVING_COST[aşama]`). Çarpan `derived.momAvg` (son 3 ay MoM ortalaması) ve `derived.multipleCap` (aşama tavanı) ile hesaplanır. `SAVE_VERSION = 2` (v1 → v2 migrasyonu: sayacı işleyen eski kayıt `payrollMissed = true` olur).
- Sim (`sim/run.ts`, `npm run sim`): 4 arketip bot, engine'i doğrudan import eder, rapor yazar (§8.3).

## 4. Content şeridi

**Sorumluluk:** tüm Türkçe metin ve veri. Tipler `src/content/types.ts`.

- `src/content/index.ts` barrel'ı değişmeyen isimlerle export eder: `STAGES`, `CONCEPTS`, `DECISIONS`, `FURNITURE`, `OFFICE_LINES`, `EMPLOYEE_NAMES`, `ACTIVITY_TEXT`, `POST_MORTEM_TEXT`, `DEPT_TEXT`, `PROJECT_CATEGORY_TEXT`, `NPC_TEXT`, `UI_TEXT`, `CONTENT` (hepsi bir arada `ContentBundle`). Dosyalar şu an yer tutucu (boş diziler); içerik şeridi doldurur.
- `CONCEPTS`: PLAN §6.2'deki 27 kavram (`CONCEPT_IDS` ile birebir). Balon ≤ 12 kelime, kart toplamı ≤ 50 kelime, `where` oyuncunun sayılarıyla dolar.
- `DECISIONS`: PLAN §6.3 v1 listesi (~45 kart). Soru ≤ 2 cümle, 2–3 seçenek, her seçenekte `tradeoff.gain/cost`, `reflection` ≤ 1 cümle, yargılamaz. `cashPercent` gibi efektler küçük tutulur (engine ayrıca sınırlar).
- `FURNITURE`: **~30 eşya**, 4 slot tipine dağılmış (masa yükseltme zinciri basit → ergonomik → çift ekran; ortak alan: kahve köşesi, mutfak, oyun köşesi, bitkiler…; oda (size 2): toplantı, sunucu, kitaplık, telefon kabini…; özel: demo sahnesi, AR-GE lab, podcast stüdyosu…). `visual.primitives` render için geometri ipucudur (hücre birimi).
- `OFFICE_LINES`: tetik başına birkaç satır, `condition` ile durum uyumu (kârdaki şirkette runway paniği yok).
- Metinler anahtarlı: yeni UI metni `UI_TEXT['anahtar']`'a eklenir, bileşenlerde sabit Türkçe string yazılmaz (ui şeridi küçük etiketler için `UI_TEXT` anahtarı ister veya ekler — `src/content/text.ts` content'in; ui şeridi eksik anahtarı fallback ile gösterir ve listeyi raporlar).
- Kurallar: `trigger`/`where`/`condition` saf fonksiyonlardır; yalnızca `GameState` okur, RNG/Date kullanmaz.

## 5. Render şeridi

**Sorumluluk:** R3F sahnesi, PLAN §3, §7.1–7.3.

- Giriş: `src/render/GameCanvas.tsx` → `export function GameCanvas(): JSX.Element` (kendi `<Canvas>`'ını, ortografik izometrik kamerasını, ışıkları içerir; tam ekran ebeveyni doldurur).
- Ek export: `src/render/ObjectPreview.tsx` → `export function ObjectPreview(props: { target: Selection }): JSX.Element` (detay panelindeki yakın çekim; kendi küçük `<Canvas>`'ı).
- `palette.ts`: aşama başına zemin/duvar tonları, departman renkleri, pastel palet.
- Grid: `Slot.pos` hücre koordinatı, kurucu masası (0,0). Hücre boyutu render sabitidir. `rotation * 90°`.
- Kilitli halkalar karanlık/tozlu; `ringOpened` event'inde tadilat animasyonu. `stageUp` event'inde taşınma.
- Karakterler: `employees[]` (`status`'a göre animasyon), kurucu (`founder.currentAction`), `visitors[]`. Yürüme/animasyon **yerel görsel durum**dur, engine'e yazılmaz.
- Dünyaya bağlı balonlar (drei `<Html>`): ortam balonları (`state.bubbles`), aktif kavram balonu (`concepts.active`, tıklayınca `openOverlay({kind:'conceptCard'})` + `dispatch({type:'openConcept'})`), küçültülmüş kavram ikonları, aktif kararın kısa sorusu (tıklayınca `openOverlay({kind:'decision'})`), durum ikonları.
- Etkileşim: slota tık → `ui.placing` varsa ilgili aksiyon (`moveItem` / `assignDesk`) dispatch, yoksa `select({kind:'slot'})` (store boş açık slotu hedefli Mağaza'ya çevirir). Seçim vurgusu `panelSelection(ui.panel)`; yeni yerleşen eşyanın slotu `itemPlaced` event'iyle kısa süre parlar. Hover → `setHoverSlot` (+ etki alanı parlaması, §3.4). Dokunmatik: tap = tık, pinch = `setZoom`. Kamera sabit izometrik, zoom yalnızca `ui.zoom` seviyeleri.
- Performans: 60 karakter + Series C ofisi 60 fps (instancing, paylaşılan geometri/materyal).

## 6. UI şeridi

**Sorumluluk:** HTML HUD, PLAN §7.4, mobil düzen (DECISIONS #3).

- Giriş: `src/ui/GameUI.tsx` → `export function GameUI(): JSX.Element` (canvas'ın üstünde tam ekran katman; kök `pointer-events-none`, etkileşimli parçalar `pointer-events-auto`).
- Üst sol: kasa (+ aylık net), kullanıcı, moral; diğerleri `state.unlockedWidgets` içerdikçe belirir. Üst orta: aşama, gün/ay, `derived.stageProgress`, hız (`setSpeed`). Üst sağ: zoom, ses, ayarlar.
- **Tek panel** (`ui.panel`, `RightPanel.tsx`): Mağaza · Ekip · Projeler · Büyüme (tur bölümü dahil) · Defter (kavram kartı dahil) · sahne detayı · karar + yansıma · ayarlar aynı sağ panelde açılır ve birbirinin yerini alır; masaüstünde sağda ~400px sütun, mobilde tek alt sheet. Tek seviye geri (`ui.panelBack`). Alt dock yalnızca sekme çubuğu (`togglePanel`). Boş zemine tık (`select(null)`) detay / hedefli mağazadan geri döner (geçmiş yoksa kapatır). Açık bir slot detayının eşyası satılırsa panel o slota hedefli Mağaza'ya, taşınırsa yeni slotun detayına geçer (store `dispatch`). Panel kapladığı ekran alanını `ui.sceneInset` ({top,right,bottom} px) olarak bildirir; render `CameraRig` ofisi kalan görünür alanda çerçeveler. Telefonda HUD "+N" ve etkinlik geçmişi de tek-açık kuralına uyar (`useExclusiveExpander`).
- Mağaza: "Satın al" = `placeItem` (slotId'siz → engine `findAutoSlot`: merkeze en yakın uygun boş slot). Boş slota tık → Mağaza o slota hedefli (`slotTarget`). Yer yoksa: bu ofisteki kilitli halkalardan birinde yer varsa sıradaki halkayı açma butonu (+ "N. halkada yer var"), yoksa "sonraki ofis" mesajı. Hedef slota sığmayan eşya satın almadan önce "Bu slota sığmaz → N. halkaya konur" der. 2 slotluk eşyalar yetim tek slot bırakmayan çifti seçer (`findPartnerSlot`). UI yer kontrolünü `ui/panels/shopPlacement.ts` (test edilir) üzerinden `engine/office.ts` saf yardımcılarıyla (`canPlaceAt`, `findAutoSlotFor`) yapar (FounderActions → `founderActionError` emsali).
- Overlay'ler (`ui.overlay`, oyunu duraklatır): yalnızca taşınma sahnesi, post-mortem, zafer.
- Alt sol aktivite satırı: `state.activity` + `ACTIVITY_TEXT[kind]` içindeki `{param}` doldurulur.
- Hata geri bildirimi: `ui.lastError` kısa inline mesaj.
- Mobil (< 768px): HUD sıkışır, dock alt çubuk, detay paneli alttan açılan sheet, dokunma hedefleri ≥ 44px, `safe-top/safe-bottom/safe-x` yardımcıları.
- Görsel dil: yuvarlak köşeli krem/pastel kartlar, ikonlar inline SVG, token'lar `src/index.css` `@theme`.

## 7. Store (integrate şeridi) — `src/store/gameStore.ts`

Tip sözleşmesi `src/store/types.ts`:

```ts
export const useGameStore: UseBoundStore<StoreApi<GameStore>>   // zustand v5 `create<GameStore>()`

interface GameStore {
  state: GameState
  ui: UiState                   // selection, hoverSlotId, dockTab, overlay, placing, zoom, lastError, pauseReasons, runStarted, generation
  dispatch(action: Action): ActionResult
  tick(realDtSeconds: number): void
  newGame(opts?: Partial<NewGameOptions>): void
  save(): void
  load(): boolean
  select(sel: Selection | null): void
  setHoverSlot(id: SlotId | null): void
  setDockTab(tab: DockTab | null): void
  openOverlay(o: Overlay): void
  closeOverlay(): void
  setPlacing(m: PlacingMode | null): void
  setZoom(z: ZoomLevel): void
  exportReplay(): ReplayLog     // seed + TimedAction[] (module-level, not reactive)
}
// effectiveSpeed({state, ui}) = 0 if gameOver or ui.pauseReasons non-empty, else state.time.speed.
// ui.pauseReasons ('modal' | 'decision' | 'concept' | 'offer') is derived from overlay/panel (+ state for 'offer':
// Büyüme › Tur open while the size choice or a weekly pitch waits); never dispatched as setSpeed.
// newGame()/load() start paused (time.speed 0, ui.runStarted false) until the player's first setSpeed > 0.
```

- **Şu anki durum:** scaffold store'u çalışır ama engine'e bağlı değil: `state` = `createBootstrapState()` (garaj, 4 masa slotu), `dispatch` yalnızca `setSpeed`'i uygular, gerisi `engineNotConnected` döner; `tick` yalnızca saati ilerletir. Render/ui şeritleri buna karşı geliştirip `npm run dev` ile görebilir.
- **Integrate yapacak:** `dispatch` → `engine.applyAction`; `tick` → gerçek saniyeyi `SECONDS_PER_DAY` ve `time.speed` ile güne çevirip biriktirir, `FIXED_STEP_DAYS` parçalar halinde `engine.step` çağırır (sabit tick, render'dan bağımsız); `loop.ts` (rAF, sekme gizliyken durur); `save.ts` (localStorage, `SAVE_VERSION` + migrasyon, periyodik autosave); replay için `TimedAction[]` kaydı (reaktif olmayan, `exportReplay()` / dev'de `window.__replay()`); `App.tsx` → `<GameCanvas/>` + `<GameUI/>`.
- Selector kullanımı: skalerler için `useGameStore(s => s.state.stats.cash)`, nesne/dizi seçerken `useShallow` (`zustand/react/shallow`). Tüm `state`'e abone olmayın.

## 8. Kritik tip kararları (özet)

- **Serileştirilebilir state:** Set/Map/Infinity yok. Kümeler `string[]` (`learned`, `unlockedWidgets`…), sonsuz runway `null`.
- **Birimler:** para = dolar (`number`), `churn` ve `equity` **kesir** (0.06, 1.0), `morale`/`reputation`/`energy` 0–100, `maturity` 0–1, süre = oyun günü (`time.day` float, toplam geçen gün), `month = floor(day/30)`.
- **Hız:** `GameSpeed = 0|1|2|4` (0 = duraklat). 1 gün = 2 sn @1x.
- **Aşama:** `StageIndex = 0..6`; sayısal tablo `content/stages.ts` (`STAGES`), formül sabitleri `engine/balance.ts`.
- **Ofis:** `office.slots[]` düz liste; `Slot {id, ring, type, pos:{x,z}, rotation, itemId?, spanOf?, occupantId?}`. Kurucu masası `FOUNDER_SLOT_ID = 'founder'`, ring 0. 2 hücrelik eşya iki slotta da `itemId` taşır, ikincisinde `spanOf` = ana slot. `rings[]` açık/kilitli + açma bedeli + kira.
- **Çalışan:** `status: 'working'|'tired'|'burnout'|'break'|'onboarding'|'leaving'`; bireysel `morale`; `leaving` iken `leaveDay` ve UI `respondResignation` aksiyonu ile müdahale eder (rastgele ceza yok).
- **İşe alım:** `candidates[]` havuzu; `hire` aksiyonu `candidateId` alır.
- **Efektler:** tek tip `EffectBundle` (kart, aksiyon, eşya); geçici etkiler `TimedModifier`, gecikmeli etkiler `DelayedEffect`.
- **Metin yok engine'de:** activity/event/post-mortem kod + parametre; Türkçe metni content tabloları verir.
- **Aksiyonlar:** `Action` discriminated union (`src/engine/types.ts`, `actions.ts` re-export): hire, fire, assignDesk, respondResignation, refreshCandidates, placeItem, sellItem, moveItem, upgradeItem, openRing, startProject, assign, founderAction, setSpeed, setAdBudget, setPrice, openConcept, minimizeConcept, answerDecision, startRound (`size?: 'small' | 'target' | 'large'`, varsayılan `target`), roundPitch (`pitch: 'metrics' | 'story' | 'coinvestor'`, yalnızca `round.pitchDue` varken).

## 9. Komutlar

| Komut | İş |
|---|---|
| `npm run dev` | Vite geliştirme sunucusu |
| `npm run build` | `tsc -b && vite build` |
| `npm run typecheck` | `tsc -b` (app + node/sim projeleri) |
| `npm test` | Vitest (`src/**/*.test.ts`, `sim/**/*.test.ts`) |
| `npm run sim` | `tsx sim/run.ts` denge simülatörü |

Her şerit teslimden önce `npm run typecheck && npm test && npm run build` geçmelidir.
