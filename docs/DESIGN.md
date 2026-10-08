# Be Unicorn — Design System ("toy UI + coloured accents")

Direction **A — toy / Two Point Hospital**: the UI is made of the same warm material as the scene. Cards are
warm plates with a 2px frame and a solid lip in the garage trim colour; buttons are physical keys that sink
when pressed; icons are duotone stickers; one rounded display face (Nunito) carries numbers, labels and
buttons. Hue carries meaning: one brand colour (unicorn violet) **only** for the commit action, active state
and progress, one hue per HUD gauge (sticker + thin bar), department hues, and small kind marks on bubbles.
Replaces the flat violet SaaS look (Oxanium + Inter, uppercase tracked labels, Lucide-like line icons on pale
12% tiles, 1px hairlines), which read as a dashboard, not a game. The sparse layout stays.

Source of truth: `src/index.css` (`@theme`). Shared components: `src/ui/primitives.tsx`.
UI constants and colour maps: `src/ui/theme.ts` (`WIDGET_COLOR`, `FOUNDER_COLOR`, `DEPT_COLOR`, `soft()`,
`iconTone()`, `readableOn()`). Scene colours: `src/render/palette.ts` (`STAGE_PALETTES`, `DEPT_COLORS`,
`NPC_COLORS`, `UI_TONES`, `BRAND`), see §0.

## 0. Scene (3D) — lively, warm

The scene carries most of the colour. Pastel lightness, but enough chroma that nothing reads as grey.

- **Tone mapping: Neutral** (`GameCanvas.tsx` `onCreated`), not R3F's default ACES, which greys out light
  pastels (the ground rendered khaki, walls grey). Lights: warm hemisphere `#FFF4E4`/`#E6D2B8` 1.35,
  ambient 0.4 (keeps shaded wall faces coloured), warm sun `#FFF0DC` 1.6 (`OfficeScene.tsx`).
- **Backdrop = UI ground**: canvas clear colour = `canvas-bg` `#F3EBDF`; the lit ground plane is a near
  white (`#FDFCF8`) so it renders ~`#ECE0CE`, the same warm light ground the HUD cards sit on. Stage 5
  ground `#F6EFDF`, stage 6 lawn `#B4DC98`.
- **Stage palettes** (`STAGE_PALETTES`): floor warms from stage to stage; each stage has its own soft wall
  hue with a trim + accent from the same family.

  | Stage | Floor | Wall | Trim | Accent |
  |---|---|---|---|---|
  | 0 Garaj | warm concrete `#CEC4B4` | beige-grey `#F2E8D7` | `#C9AA8A` | coral door `#F08A6C` |
  | 1 Pre-seed | birch `#E6C99A` | mint `#C4ECD6` | `#6FCAA2` | `#35B487` |
  | 2 Seed | pale oak `#E2BF8C` | lilac `#DCCFFC` | `#A58CF0` | `#7C5CF2` |
  | 3 Seri A | oak `#DDB682` | sky `#CADFFB` | `#7AAEF0` | `#3F84E5` |
  | 4 Seri B | honey `#D9AB76` | peach `#FDD5BF` | `#F3C4A8` | `#EF7446` |
  | 5 Seri C | walnut `#CC9D6E` | seafoam `#C6EEE4` | `#5FC3B1` | `#1EA893` |
  | 6 Unicorn | warm wood `#D6A26E` | rose `#FBD3E1` | `#F29AB4` | `#E8649A` |

- **People**: shirts = `DEPT_COLORS` (= `--color-dept-*`); founder = light brand violet `#9F82FF` + gold
  horn. **Visitors (`NPC_COLORS`) never use a department hue**: muted outfits (brown, olive, navy,
  charcoal, slate) or the free hues (magenta, lime); the role reads from the accessory and the bright
  visitor ring (`accent`).
- **Furniture** (`src/content/furniture.ts`): tops light (basic desk `#F3EBDD`) so they separate from the
  wood floor; accents (chairs, cushions) are lively pastels, not dusty slate.
- **Locked rings** stay dark and dusty so the open ring pops. At the default zoom a mostly locked office is
  framed on the unlocked area (`frameBox` in `OfficeScene.tsx`); zoom-out shows the whole office.
- Selection ring + aura = brand violet. Confetti includes brand.

## 1. Tokens

### Neutrals (warm, derived from the garage: canvas `#F3EBDF`, walls `#F2E8D7`, trim `#C9AA8A`)

| Token | Value | Use |
|---|---|---|
| `surface` | `#FFFAF2` | Cards, panels, bubbles, sheets, keycaps |
| `surface-2` | `#F6EEE1` | Inset wells (speed tray, `Segmented` track), hover |
| `surface-3` | `#EFE4D3` | Pressed / hover on `surface-2` |
| `canvas-bg` | `#F3EBDF` | Page backdrop / 3D clear colour (`theme-color` too) |
| `border` | `#E4D5BF` | 2px card + chip frame, progress track, rules |
| `border-strong` | `#CDB696` | Key edges, dividers on `surface-2`, dashed locked hints |
| `lip` | `#C9AA8A` | The solid lip under cards and keys (= the scene trim colour) |
| `ink` | `#2B2420` | Primary text (14.7:1 on surface) |
| `ink-2` | `#6B5F55` | Secondary text, labels, neutral icons (5.96:1 on surface, 5.37:1 on `surface-2`) |
| `ink-3` | `#857767` | Disabled / placeholder / ≥14px bold only (4.18:1, below AA for small text) |
| `ink-4` | `#C9B9A5` | Decorative track step only |
| `on-ink` | `#FFFAF2` | Text/icon on ink or brand fills |

Surface vs canvas is only 1.14:1: cards separate from the scene through the 2px frame and the lip, so never
thin the frame to 1px. If the garage trim changes, re-derive `lip`, `border` and `border-strong` from it.

### Brand — unicorn violet

| Token | Value | Use |
|---|---|---|
| `brand` | `#6B4EF0` | Commit key fill, active dock tab, "Tur başlat", stage progress bar, range thumb, active raised IconButton (on-ink text 5.09:1) |
| `brand-hover` | `#5A3DE0` | Hover of brand fills |
| `brand-deep` | `#4733BF` | Commit key edge + lip, brand badge / dot lip |
| `brand-ink` | `#4B2FC9` | Brand-coloured text on light surfaces (7.93:1): active chip label, links like "Kazanımlara bak" |
| `brand-soft` | `#EEE9FC` | Active chip / selected row / running-round key fill |
| `accent` | = brand | 3D selection ring. **Not** the focus ring (see Rules) |

### Gauge hues (HUD) — `--color-g-*`

Duotone sticker (no tile) + thin bar / sparkline / stacked ramp. **Never body text**; values stay ink,
warnings still turn the number `negative-ink`. Gauge hues are **identity, not alarm**: none of them is the
warning red (`negative` is reserved for thresholds). A toned icon draws its outline in
`iconTone(color)` (hue 62% + ink 38%) over a 30% body of the hue itself; bars and sparklines keep the bright
hue.

| Token | Value | Widgets (`WIDGET_COLOR`) |
|---|---|---|
| `g-cash` | `#1F9D63` | Kasa, Kâr tahmini |
| `g-users` | `#3A7BEA` | Kullanıcı, Kanallar |
| `g-morale` | `#EC6FA8` | Moral, Ekip morali, Kültür (and employee morale bars). Clear pink, not red |
| `g-runway` | `#D9730D` | Runway |
| `g-burn` | `#C65A34` | Yakıt / burn, CAC (brick; never equal to `negative`) |
| `g-churn` | `#B8487F` | Churn (plum) |
| `g-retention` | `#139C8C` | Tutunma, LTV:CAC |
| `g-reputation` | `#8B5CF6` | İtibar |
| `g-equity` | `#B8860B` | Cap table, Kurucu payı, quality stars, XP star |
| `g-sky` | `#0E8FC9` | ARPU, Koordinasyon |
| `g-indigo` | `#5B6CE0` | Gelir dağılımı |
| `g-debt` | `#7D6B5D` | Teknik borç (taupe) |
| `brand` | — | Tur (round timer), Arketip |
| `energy` / `energy-ink` | `#F2A11F` / `#985800` | Founder energy bar fill / its number (5.42:1 on surface) |

Every toned outline is >= 4.21:1 on surface and >= 3.39:1 on its own body (minimum: `energy`; compact HUD
shows the icon without its label, so this is the identifier there). `energy` is a fill only.

### Time state — `--color-speed-*`

Frames and fills only (text on them stays ink, AA). The speed colour lives in **two places only**
(docs/LAYOUT.md §4.2): the speed control's active segment (a sunk key with a tinted fill + solid 2px edge, top bar section C) and
the viewport frame (`ScreenFrame`, always solid: paused 3px desktop / 2px phone, running a 1px hairline). The stage section, the month ring next to the
date and the date itself stay **neutral** (`ink-2`); there is no running dot and no "DURAKLATILDI" pill.
Colour follows the speed time *actually* runs at.

**Paused = red, running = green** (docs/GAMEPLAY_V2.md §13; replaces DECISIONS #13/#14's grey/yellow/orange/green).
Any pause (the player's own or a focus pause for a decision / Kazanımlar card / round offer / modal) is the calm
pause red. 1×, 2× and 4× share one green: the speed segments tell them apart by icon (▶ / ▶▶ / ▶▶▶ over
`1×/2×/4×`) and fill density. The active segment is a **sunk** key (`data-down`) with a tinted fill and a solid
2px edge in its colour, ink text; idle segments are raised keys. A focus pause adds a faint inner band in the
chosen speed's colour (where time returns to) and the chosen segment stays raised with a solid green edge.
**No dashes on the speed control.** The phone key cycles, so it is never sunk; its lip is the colour mixed 70%
with ink. The time status label ("Duraklatıldı",
"Karar · 2×", "Zaman akıyor", "Önemli an · 1×") sits next to the segments (≥1440; in the segment tooltips below
that). Colour is never the only signal: sunk vs raised, ⏸ vs ▶ and the label carry the same state.

| Token | Value | State |
|---|---|---|
| `speed-pause` | `#C94A3F` | Duraklatıldı / odak duraklaması (⏸ segment, label `ink-2`; `ScreenFrame` a solid 3px / 2px phone frame at 55%) |
| `speed-run` | `#1F9D63` (= `positive`) | 1× / 2× / 4× (frame a 1px solid hairline at 25%; segment ▶ / ▶▶ / ▶▶▶) |

Motion: `animate-day-tick` (date pops
each day), `animate-frame-beat` (frame glow once per game day while flowing), `animate-cash-rise` (daily Kasa
delta, `ink-2` / `positive-ink`), `animate-payday-drop` (payday lump, bold ink: rhythm, not danger),
`animate-danger-pulse` (runway < 3 ay only), `animate-attention` (new decision bubble), `animate-cta-glow`
(Başlat). A still world fades the scene slightly (desaturate + vignette, `PauseVeil`).

### One red rule

`negative` / `negative-ink` mean **"this can end the run"** and nothing else (docs/LAYOUT.md §4.1): Runway < 3 ay
(value + dot + pulse), usable Kasa < 0 / bankruptcy countdown / missed payroll (Kasa value + strip P0), Moral < 28
(value + dot; the burnout band in Ekip morali). Everything that used to be red and is not danger is now
**warning** (`energy` mark + `energy-ink` number: low energy, LTV:CAC < 3, churn > %8, tech debt, coordination,
revenue concentration, founder stake < %50, error icon, leaving-employee badge) or neutral (pause, daily burn,
payday lump, receipt net, the stage section). Counter badges on the tabs are `brand`.

**Exception: the speed frame red is not danger.** `speed-pause` is its own, less saturated token (`#C94A3F`, never
`negative`) and only ever appears as the viewport frame + the ⏸ segment: the frame and the ⏸ icon
tell "waiting" apart from "this can end the run". It never colours a number.

### Data viz (`src/ui/charts/`, GAMEPLAY V2 §14.4)

Hand-drawn SVG, no chart dependency; data and colours come in as props. A series takes its **gauge hue**
(`WIDGET_COLOR`), at most 4 hues per chart; stacked parts are `ramp()` strengths of one hue. The lead rival is a
thin grey reference line with no value. Red only where the run can end (`negative`: the death point, the runway < 3
band) — the one red rule holds inside charts too. Numbers Nunito tabular, ≤ 4 ticks (`niceTicks`); no hover
tooltip (touch): tap selects a month and the tile header prints it. A series not learned yet is a `LockedTile`
(icon + name, dashed, no sentence). Charts live in the center `StatsScreen`, which never pauses time.

### Status, kinds, departments

| Token | Value | Use |
|---|---|---|
| `positive` / `positive-ink` | `#1F9D63` / `#1B7248` | Marks and fills / green number text (AA) |
| `negative` / `negative-ink` | `#E0483E` / `#B3372E` | Marks and fills / red number text (AA) |
| `kind-decision` | `#E8790F` | Karar mark (orange tile next to the speaker) |
| `kind-concept` | `#8B5CF6` | Kavram mark (violet book tile), minimized concept icon |
| `shelf` | `#D8C3A5` | Defter bookshelf plank |
| `dept-eng` / `-product` / `-marketing` / `-sales` / `-ops` | `#3F7FE8` / `#9A5CF0` / `#F0605A` / `#F5A81C` / `#14A98F` | Dept dots, pill + avatar tints. **Must equal `DEPT_COLORS` in `src/render/palette.ts`** (shirts) |

Opacity modifiers work (`bg-brand/15`, `bg-g-morale/45`). Inline / dynamic hue: `soft(color, pct=12)` from
`theme.ts` returns `color-mix(in oklab, color pct%, transparent)`.

### Shape and elevation

| Token | Value | Tailwind |
|---|---|---|
| `--radius-card` | 14px | `rounded-card` (cards, panels, sheets, overlays) |
| `--radius-control` | 12px | `rounded-control` (keys, chips, inputs) |
| — | 8px | `rounded-lg` (pills / tags, cost chip) |
| `--shadow-card` | 3px `lip` + soft warm drop | `shadow-card` — floating HUD cards, bubbles |
| `--shadow-pop` | 3px `lip` + larger drop | `shadow-pop` — modals, toasts |
| `--shadow-panel` | 3px `lip` + soft lift | `shadow-[var(--shadow-panel)]` — the right panel / bottom sheet |
| `--shadow-inset` | inset 2px top shade | wells (`.ui-inset`) |

The lip lives **inside** the shadow tokens, so every `shadow-card` / `shadow-pop` user, `animate-attention`
and `animate-cta-glow` (brand-deep lip) keep it. It is a box-shadow and takes no layout space, but it needs
vertical room: an `overflow-hidden` ancestor with a tight height clips it (use `overflow-x-clip`).

Surfaces are **opaque** (no backdrop blur): HUD plates over a lively scene, not frosted glass. The right panel
carries a 3px kind stripe on top (`theme.ts PANEL_COLOR`), a 20px icon, a 13px title and its primary
number on the right (`panelHeadline.ts`). Motion keyframes (all off under `prefers-reduced-motion`):
`animate-rise` (panel opens, 180 ms, scale 0.96 → 1), `animate-pop-once` (a gauge whose number moved),
`animate-breathe` (the one object to look at next, 1.6 s), `animate-count` (a number ticks).

Frames are **2px** (cards, chips, keys; pills 1.5px); no 1px hairlines. `Divider` and rules are 2px rounded
bars in `border`. Brand CTAs may carry a soft brand glow (`animate-cta-glow`, lip kept).

### Helper classes (index.css)

- `.ui-card` — warm plate: `surface` + 2px `border` frame + card radius + `shadow-card` (lip). Use via `<Card>`.
  A card inside a card uses `.ui-inset` or a `border-t-2` row, never `.ui-card`.
- `.ui-inset` — recessed well: `surface-2`, control radius, `shadow-inset`, no frame (speed tray, `Segmented`).
- `.ui-key` — physical key: `--key-fill` + 2px `--key-edge` + solid `--key-lip` of `--key-depth` (3px). Pressing
  (`:enabled:active`, `<button>` only) or `[data-down]` sinks it by the lip depth (90 ms, translateY, no scale);
  `:disabled` is flat (no lip = not pressable). Tones only set the variables: `.ui-key-routine` (surface),
  `.ui-key-commit` (brand fill, brand-deep edge + lip, on-ink text), `.ui-key-soft` (brand-soft, brand-ink),
  `.ui-key-danger` (surface, negative-tinted edge + lip, negative-ink text); `.ui-key-sm` = 2px lip. Retint one
  inline with `style={{ '--key-fill': …, '--key-edge': … } as CSSProperties}`. An animation with fill `both`
  (`animate-pop-in`) pins `transform` and blocks the sink: put it on a wrapping span.
- `.ui-label` — Nunito 12/14px, 700, **sentence case, no tracking**, `ink-2` (a game caption, not a dashboard
  column). Components layer, so any utility overrides it.
- `ui-num` — Nunito 800, tabular, `-0.01em`: HUD values, buttons' figures, badges. Never combine it with a
  `font-*` weight utility (layer order is not guaranteed); use `tabular font-bold` for 700.
- `.font-text` — Figtree, resets tabular numerals (reading text). `.font-ui` — Nunito.
- `.tabular` — tabular numerals (a no-op on Nunito, protects the fallback stack).

## 2. Fonts

Loaded in `src/index.css` with `@font-face` from `public/fonts` (woff2 copied from
`@fontsource-variable/{nunito,figtree}`, latin + latin-ext only; `ğĞşŞİ` live in latin-ext) and preloaded in
`index.html` (4 links). Not in `main.tsx`. About 105 KB in total.

| Role | Font | Where |
|---|---|---|
| UI (default on `body`) | **Nunito Variable** (`font-ui` = `font-sans`) | HUD, headings, tab labels, labels, buttons, numbers, chips, pills, stats, toasts |
| Reading | **Figtree Variable** (`font-text`) | Speech/world bubbles, Notebook (Defter) cards, decision text and option descriptions, long hints, the company name, tooltips longer than one line |

Rules:
- Numbers are always Nunito, even inside a Figtree paragraph (wrap in `<span className="font-ui tabular">`).
  Nunito has **no `tnum` lookup**: its 10 digits are all 600/1000 em at every weight, so figures are tabular by
  construction in every browser. Never hand-write `font-feature-settings: "tnum"`, and do not move HUD numbers
  to a proportional face without re-checking.
- Turkish shaping relies on `<html lang="tr">`: Nunito's `fi` ligature is suppressed only through its TRK
  `locl`. Never bring back Baloo 2 (it ligates `fi` → "fıyat" even under `tr`) or Fredoka (no `ğĞşŞİ`).
- `→` and `∞` are missing from both faces and fall back to the system font: use `<Icon name="arrowRight">`.
- `--font-ui` keeps its name: `src/render/WorldBubbles.tsx` and `Juice.tsx` read `var(--font-ui)`.

Weights (UI never below 600): 600 secondary UI text · 700 (`font-bold`) labels, chips, sub figures ·
800 (`font-extrabold` / `ui-num`) values, buttons, stage name · 900 unused. Figtree body copy 500 at 12–13px,
emphasis 600, never 300.

## 3. Rules

1. **Text stays ink.** Body text, labels and values are `ink` / `ink-2`. Hue on text only for: green/red
   numbers (`*-ink` variants, `<Delta>`), `brand-ink` for active chip labels and links, `energy-ink` for
   the energy number. Everything else coloured is an icon, a bar, a dot or a light tint.
2. **Brand = action + progress, nothing else.** Commit key (`<Button tone="commit">`), active dock tab,
   "Tur başlat", stage progress bar, `Bar` default fill, active raised `IconButton`, range thumb. One commit
   key per surface. Never brand as decoration or as a neutral surface tint.
3. **Every HUD gauge has its hue** (`WIDGET_COLOR` / `WidgetDef.color`): a duotone sticker of that hue
   (`<Icon tone>`, no tile) and its thin bar / sparkline / stacked ramp (`ramp(color)`: 100/70/45/25%). No solid
   discs.
4. **Departments are vivid**: dot + a light tint on pills (`<Pill tint>`) and avatars (18% fill, 45% ring).
   Filter chips carry the department as a `<Dot>` child; the **selected** state is always the brand chip
   (a sales/ops-tinted frame is under 3:1, so a dept-tinted "selected" was not visible). Text on tints stays ink.
5. **Bubbles**: neutral body; kind = small tinted tile next to the speaker (`<SpeakerLine color>`):
   karar = `kind-decision` orange (crisis = `negative`), kavram = `kind-concept` violet.
6. **Founder actions**: available/running buttons use their own hue (`FOUNDER_COLOR`: icon, 12% fill,
   45% frame, cooldown/run ring). Locked or unavailable = dashed neutral frame, faded icon.
7. **Defter shelf**: learned books are solid spines in their `shelfColor` (label colour from
   `readableOn()`); unlearned slots stay dashed neutral. Notebook card rows use tinted `IconBadge`s.
   `shelfColor` values are one pastel-saturated family: no greys, no near-black, no neon, and every one
   takes ink text at >= 4.5:1 (guarded by `src/content/__tests__/concepts.test.ts`).
8. **Locked / disabled stays neutral** (dashed `border-strong`, `ink-3`), so colour always means "live".
9. **HUD grammar, not calm web UI** (docs/GAMEPLAY_V2.md §10.1 D1–D9, DECISIONS #30; replaces "generous whitespace,
   hairline, light shadows"). The number is the biggest thing on every surface (Nunito `ui-num`, primary
   22–28px); one readable sentence at a time (≤ 12 words, Figtree only there, no paragraphs); labels are small
   sentence case, never uppercase + tracking; buttons are keys in tiers — *commit* (spends cash/equity: brand key +
   cost chip `−$4.2K/ay` / `runway 9→7`, sinks onto its lip + `confirm` cue), *routine* (surface key), *danger*
   (negative-edged key); the panel frame has a 3px state stripe, radius 14,
   fully opaque; rows 36px, 4px gaps instead of `divide-y`; numbers tween 300–600 ms (`useTween`), ≤ 3 flashes a
   second, `prefers-reduced-motion` stops the keyframes; guidance is object emphasis (a breathing Dock icon, ghost
   slot, target notch; ≤ 2 at once), never "click here" text; the strip shows 1 item, ≤ 2 P2 a game day.
   **Still banned:** a card inside a card, solid gauge discs, `<input type="range">`.
10. **A metric keeps its hue everywhere.** Panels showing a HUD metric use the same `WIDGET_COLOR` tile
    (`<Stat icon color>`) and the same warning rule (e.g. LTV:CAC < 3 amber in Metrikler and Büyüme). Project
    maturity bars use the category hue (`CATEGORY_COLOR`).
11. **One brand CTA per list.** A blocked state is never a primary button: e.g. Mağaza with no room shows
    one "Boş yer yok — N. halkayı aç" banner with a single primary button above the list; items show a
    neutral "Boş yer yok" note.
12. **Focus ≠ selected.** `:focus-visible` = 2px **ink** outline, 2px offset, and **no box-shadow** (an
    unlayered box-shadow would erase every key's lip on focus), so keyboard focus never reads as the brand
    selected state (active tab / chip / row) and still shows on brand fills.
13. **Icons are duotone stickers** (`src/ui/icons.tsx`). `PATHS` is the outline layer (2px round stroke, 2.2 at
    ≤14px); `BODY` is the fill layer: `true` = reuse the outline paths, a node = a dedicated closed silhouette
    (hourglass sand, lock body, bag…), absent = line-only (chevrons, arrows, close, check…). The body sits in one
    `<g opacity>` group so overlapping sub-paths never double-tint. `<Icon tone={hue}>`: outline `iconTone(hue)`,
    body = hue at 30%; no tone: `currentColor` outline over a 20% `currentColor` body (works on any fill, e.g. a
    brand key). `body={false}` = outline only, `body="<css colour>"` overrides the fill; a caller `fill` keeps its
    old meaning (`currentColor` = solid glyph, `none` = hollow). A metric is the same sticker everywhere because
    tone → `iconTone` / hue is one formula. A new glyph whose chord-closed outline misreads gets a dedicated body.

## 4. Components (`src/ui/primitives.tsx`)

| Component | Notes |
|---|---|
| `Card` | `.ui-card` |
| `Button` | keys (`.ui-key`), Nunito 800, no tracking: `commit` (brand key; spends money / equity / a move; `cost` chip, sinks onto its lip, `data-cue="confirm"`) / `routine` (surface key) / `danger` (negative-edged key, red text) / `ghost` and `onInk` (not keys, 1px press); `md` 44px / 15px, `sm` 36px / 13px with a 2px lip; `primary`/`mint` = deprecated commit, `secondary`/`soft` = deprecated routine |
| `IconButton` | quiet by default (panel close / back / collapse); `raised` = routine keycap, `raised active` = commit key; icon `size*0.5` |
| `Bar` | brand fill by default; `tone` = Tailwind class, or `color` = CSS hue (track becomes a 16% tint of it) |
| `Ring` | brand stroke by default; pass `tone` |
| `Chip` | 2px frame, 12px bold; active = brand-soft + brand frame + brand-ink text (always; identity hues go in as a `<Dot>` child); `count` = extrabold tabular number after the label; `segment` inside `Segmented` (`.ui-inset` track, active = surface with a 2px lip) |
| `Pill` | 1.5px framed tag, 11px bold; `dot` mark; `tint` = light fill of a hue (dept, live) |
| `Dot` | department / status / kind mark |
| `IconBadge` | `color` = a bare duotone sticker in that hue (icon 75% of `size`, no tile); otherwise a neutral icon, `filled` = round `surface-2` disc |
| `Stat` | 24px `ui-num` value first, `.ui-label` under it, `border-t-2` top rule; `icon` + `color` add the metric's 14px sticker (same as its HUD chip); `delta`, `tween` + `format` |
| `CostPreview` | `⌛ 9 → 7 ay` chip (+ `cost`) drawn from the engine's `previewSpend()` result; red only when runway < 3 or the next payday is short |
| `SectionTitle` | 4px rounded colour stripe (`color`, neutral by default) + 13px sentence-case label in ink |
| `Label`, `Delta`, `Divider`, `LockedHint`, `Empty`, `QualityStars` (amber) | — |

HUD (top bar, `src/ui/layout/`): the desktop bar is one `.ui-card` (h-14, 2px frame, 3px lip) split by 2px rules.
A gauge (`BarChip`, `WidgetChip variant="bar"`) is number **over** label: sticker (22px at full density) +
`ui-num` value (17px, 18px ≥1440; 16px tight; 15px phone) with its sub delta, then a 12px `.ui-label` row that
also holds the Moral bar / goal notch inline. View controls are raised keycaps (36/34px, 44 on mobile); the speed
control is a `.ui-inset` tray of keys (see Time state); "Tur başlat" is a commit key, the running round a
`.ui-key-soft` key. `WidgetChip` takes `color`; `WIDGETS[id].color` is the registry field. Panel header: kind stripe + 20px icon in the kind hue (`PANEL_COLOR`) + primary number.
Project categories: `CATEGORY_COLOR` in `panels/ProjectsPanel.tsx`.

## 5. Legacy token migration map (historical)

The map below dates from the minimal restyle; where it says "ink" for fills/bars, read **brand** (actions,
progress) or the gauge hue (HUD) under the current rules. Legacy alias values now point at the warm neutrals.


The old pastel token names still exist in `@theme` but are **aliased to neutrals** so nothing breaks
(e.g. `bg-mint-100` now renders `surface-2`). They are deprecated: replace them while restyling, and
delete the alias block once `rg -e '(cream|lilac|mint|peach|sky|lemon|rose)-[0-9]' -e 'ink-(900|700|600|400)' src` is empty.

| Old class / value | Now renders as | Replace with |
|---|---|---|
| `bg-cream-50`, `bg-cream-50/95` | surface | `bg-surface` (or `<Card>`) |
| `bg-cream-100`, `bg-cream-100/xx` | surface-2 | `bg-surface-2` (inset) or `bg-canvas-bg` (page) |
| `bg-cream-200`, `bg-cream-200/xx` | ~surface-2 | `bg-surface-2`; tracks → `bg-border` |
| `bg-cream-300`, `border-cream-300`, `border-cream-200` | border | `bg-border-strong` / `border-border` |
| `text-cream-50` (on ink) | surface | `text-on-ink` |
| `text-cream-200/300` | border | `text-ink-3` |
| `text-ink-900`, `bg-ink-900` | ink | `text-ink`, `bg-ink` |
| `text-ink-700`, `bg-ink-700` | #3A393E | `text-ink` (or `text-ink-2`); hover → `bg-ink/85` |
| `text-ink-600` | ink-2 | `text-ink-2` |
| `text-ink-400`, `bg-ink-400` | ink-3 | `text-ink-3` |
| `bg-ink-900/35`, `/40` (scrims) | ink alpha | `bg-ink/35` |
| `bg-{lilac,mint,peach,sky,lemon,rose}-100` (+ `/xx`) | surface-2 | **remove fill**; `border-2 border-border` if a frame is needed |
| `bg-{…}-300` (bars, chips, dots) | border-strong | bars → `bg-ink`; chips → `<Chip>`; status → `<Dot>` |
| `border-{lilac,lemon,sky,rose}-300` | border-strong | `border-border` |
| `text-lilac-500`, `bg-lilac-500`, `var(--color-lilac-500)` | ink | `text-ink` / `text-ink-2` for icons; `bg-ink`; focus → `accent` |
| `text-mint-600`, `bg-mint-600` | positive | `text-positive` only on numbers / marks; otherwise `text-ink` |
| `text-rose-600`, `bg-rose-600` | negative | `text-negative` only on numbers / marks / destructive text |
| `text-sky-600`, `text-peach-600`, `text-lemon-600` | ink-2 | `text-ink-2` |
| `text-rose-300`, `text-peach-300` | border-strong | `text-ink-3` or `text-negative` if it is a warning number |
| `from-* / via-* / to-*` gradients | neutral | **remove gradient**, flat `bg-surface` |
| `var(--color-cream-200)` in SVG | ~surface-2 | `var(--color-border)` |
| `var(--color-mint-600)` sparkline | positive | `var(--color-ink)` line; colour only the end value |
| `var(--color-rose-300)` dashed line | border-strong | `var(--color-ink-3)` |
| `tone="mint"` on Button | primary | `tone="primary"` |
| `tone="soft"` on Button | secondary | `tone="secondary"` |
| `DEPT_COLOR[d].bg/.fg` pill | neutral | `<Dot color={DEPT_COLOR[d].dot} />` + text |
| Hard-coded pastel hex (`#9cc9f5`, `#c9a7f5`, `#9fe0c3`, `#ffc1a1`, `#f4a3a8`, `#f7dc8b`, `#7fb6ee`, `#ece0cc`, `#dccbb0`, `#caa983`…) | unchanged | stacked bars / legends: ink ramp `var(--color-ink)`, `var(--color-ink-2)`, `var(--color-ink-3)`, `var(--color-border-strong)`; burnout band may be `var(--color-negative)` |
| `PASTEL.*` in `WorldBubbles.tsx` (UI parts) | unchanged | `UI_TONES.*` |
| `rounded-3xl`, `rounded-2xl` on cards/bubbles | — | `rounded-card` |
| `rounded-full` on text buttons/chips | — | `rounded-control` |
| `font-bold`/`font-extrabold` everywhere | — | the §2 weight ladder (superseded the old "semibold only" rule) |

Remaining legacy references per file (at time of writing): widgets.tsx 58, overlays/Overlays.tsx 30,
DetailPanel.tsx 22, panels/ShopPanel.tsx 21, panels/ProjectsPanel.tsx 14, panels/TeamPanel.tsx 12,
panels/SettingsPanel.tsx 12, Hud.tsx 12, bubbles/DecisionBubble.tsx 12, NotebookCard.tsx 10,
FounderActions.tsx 10, panels/RoundSection.tsx 9, panels/GrowthPanel.tsx 9, render/WorldBubbles.tsx 9,
panels/JournalPanel.tsx 8, App.tsx 8, Dock.tsx 6, bubbles/ConceptBubble.tsx 6, ActivityLine.tsx 6,
RightPanel.tsx 3, Feedback.tsx 3, bubbles/worldBubble.tsx 3, panels/DecisionPanel.tsx 2,
overlays/OverlayFrame.tsx 2, bubbles/AmbientBubble.tsx 2, GameUI.tsx 1, dev/playground.tsx 1.

## 6. Ownership (restyle lanes)

Shared files — **foundation lane only**: `src/index.css`, `src/ui/theme.ts`, `src/ui/primitives.tsx`,
`src/render/palette.ts` (`UI_TONES`). Need a new token or primitive? Ask; don't fork one locally.

| Lane | Files |
|---|---|
| **A — Bars & strip** (docs/LAYOUT.md) | `src/ui/layout/*` (TopBar, StageSection, TopMetrics, SpeedControl, ViewControls, BottomBar, FounderBar, NotificationStrip, stripRules, tokens, useSceneInset), `src/ui/widgets.tsx`, `src/ui/FounderActions.tsx`, `src/ui/ActivityLine.tsx`, `src/ui/Feedback.tsx`, `src/ui/Horizon.tsx`, `src/ui/Moments.tsx`, `src/ui/NextStepChip.tsx`, `src/ui/icons.tsx` |
| **B — Panel** | `src/ui/RightPanel.tsx`, `src/ui/Dock.tsx` (tab defs + tab buttons of the bottom bar), `src/ui/DetailPanel.tsx`, `src/ui/panels/*` (Metrikler included) **except** `SettingsPanel.tsx` |
| **C — Bubbles & overlays** | `src/ui/bubbles/*`, `src/ui/NotebookCard.tsx`, `src/ui/ModalHost.tsx`, `src/ui/overlays/*`, `src/App.tsx` (start screen), `src/render/WorldBubbles.tsx` (`DefaultBubble`) |

Unassigned for now (other session has pending changes, or out of scope): `src/ui/panels/SettingsPanel.tsx`
(legacy `bg-cream-*`, `bg-mint-600` toggle, `rounded-full` segmented controls), `src/main.tsx`,
`src/ui/hooks.ts`, `src/audio/**`, `src/render/{layout,walker,constants,Office,Npc,Character,nav}`,
`src/ui/GameUI.tsx` (mounts TopBar + RightPanel + BottomStack), `src/ui/dev/playground.tsx` (dev only).

3D scene: see §0. Still hardcoded in files owned by another session (move to `palette.ts` when free):
locked-ring overlay `#2D2B36` @ 0.55 in `Office.tsx` (should use `StagePalette.locked` at ~0.3), office
props (garage door, shelves, glass, plants, statue) in `Office.tsx`, leg colours in `Character.tsx` /
`Npc.tsx`.
