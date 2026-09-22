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
- İflas: `finance.negativeCashDays ≥ 60` veya ekip 0 (ilk işe alımdan sonra) ⇒ `gameOver` (tam 3 `PostMortemReason`). Unicorn ⇒ `gameOver.kind = 'unicorn'`.
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
- Etkileşim: slota tık → `ui.placing` varsa ilgili aksiyon (`placeItem` / `moveItem` / `assignDesk`) dispatch, yoksa `select({kind:'slot'})`. Hover → `setHoverSlot` (+ etki alanı parlaması, §3.4). Dokunmatik: tap = tık, pinch = `setZoom`. Kamera sabit izometrik, zoom yalnızca `ui.zoom` seviyeleri.
- Performans: 60 karakter + Series C ofisi 60 fps (instancing, paylaşılan geometri/materyal).

## 6. UI şeridi

**Sorumluluk:** HTML HUD, PLAN §7.4, mobil düzen (DECISIONS #3).

- Giriş: `src/ui/GameUI.tsx` → `export function GameUI(): JSX.Element` (canvas'ın üstünde tam ekran katman; kök `pointer-events-none`, etkileşimli parçalar `pointer-events-auto`).
- Üst sol: kasa (+ aylık net), kullanıcı, moral; diğerleri `state.unlockedWidgets` içerdikçe belirir. Üst orta: aşama, gün/ay, `derived.stageProgress`, hız (`setSpeed`). Üst sağ: zoom, ses, ayarlar.
- Alt dock (`ui.dockTab`): Mağaza · Ekip · Projeler · Büyüme · Defter. Mağaza eşya seçince `setPlacing({kind:'place', itemId})`.
- Sağ detay paneli (`ui.selection`): metrikler + aksiyonlar; yakın çekim için `ObjectPreview` (render henüz yoksa yer tutucu kutu).
- Overlay'ler (`ui.overlay`, aynı anda **en fazla 1 blocking**): kavram kartı (Ne? / Sen nerede gördün? / Kural), karar kartı (seçenek + görünür takas) → yansıma, tur, taşınma, post-mortem, zafer.
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
  ui: UiState                   // selection, hoverSlotId, dockTab, overlay, placing, zoom, lastError, lastSeenEventId
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
  markEventsSeen(eventId: number): void
}
```

- **Şu anki durum:** scaffold store'u çalışır ama engine'e bağlı değil: `state` = `createBootstrapState()` (garaj, 4 masa slotu), `dispatch` yalnızca `setSpeed`'i uygular, gerisi `engineNotConnected` döner; `tick` yalnızca saati ilerletir. Render/ui şeritleri buna karşı geliştirip `npm run dev` ile görebilir.
- **Integrate yapacak:** `dispatch` → `engine.applyAction`; `tick` → gerçek saniyeyi `SECONDS_PER_DAY` ve `time.speed` ile güne çevirip biriktirir, `FIXED_STEP_DAYS` parçalar halinde `engine.step` çağırır (sabit tick, render'dan bağımsız); `loop.ts` (rAF, sekme gizliyken durur); `save.ts` (localStorage, `SAVE_VERSION` + migrasyon, periyodik autosave); replay için `TimedAction[]` kaydı; `App.tsx` → `<GameCanvas/>` + `<GameUI/>`.
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
- **Aksiyonlar:** `Action` discriminated union (`src/engine/types.ts`, `actions.ts` re-export): hire, fire, assignDesk, respondResignation, refreshCandidates, placeItem, sellItem, moveItem, upgradeItem, openRing, startProject, assign, founderAction, setSpeed, setAdBudget, setPrice, openConcept, minimizeConcept, answerDecision, dismissBubble, startRound.

## 9. Komutlar

| Komut | İş |
|---|---|
| `npm run dev` | Vite geliştirme sunucusu |
| `npm run build` | `tsc -b && vite build` |
| `npm run typecheck` | `tsc -b` (app + node/sim projeleri) |
| `npm test` | Vitest (`src/**/*.test.ts`, `sim/**/*.test.ts`) |
| `npm run sim` | `tsx sim/run.ts` denge simülatörü |

Her şerit teslimden önce `npm run typecheck && npm test && npm run build` geçmelidir.
