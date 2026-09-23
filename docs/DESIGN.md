# Be Unicorn — Design System ("calm UI + coloured accents")

Direction: **the scene is lively, the UI is calm with coloured accents.** Warm off-white cards and ink
text stay neutral; hue carries meaning: one brand colour (unicorn violet) for the primary action, active
state and progress, one hue per HUD gauge (icon + thin bar), department hues, and small kind marks on
bubbles. Replaces the all-neutral minimal restyle (98ba48c / 4304584), which read as lifeless. Oxanium +
Inter and the sparse layout stay.

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

### Neutrals (slightly warm)

| Token | Value | Use |
|---|---|---|
| `surface` | `#FBFAF7` | Panels, cards, bubbles, sheets |
| `surface-2` | `#F3F1EC` | Inset fills: hover, pressed, segmented-control track |
| `canvas-bg` | `#F3EBDF` | Page backdrop / 3D clear colour (warm light) |
| `border` | `#E8E4DC` | 1px hairlines, neutral progress track |
| `border-strong` | `#D6D0C5` | Secondary-button frame, dashed hints (locked / unavailable) |
| `ink` | `#1F1D24` | Primary text |
| `ink-2` | `#64616B` | Secondary text, neutral icons (5.8:1 on surface) |
| `ink-3` | `#9B978F` | Tertiary text, disabled, placeholders |
| `on-ink` | `#FBFAF7` | Text/icon on ink or brand fills |

### Brand — unicorn violet

| Token | Value | Use |
|---|---|---|
| `brand` | `#6B4EF0` | Primary button fill, active dock tab, "Tur başlat", stage progress bar, range thumb, active IconButton (white text 5.3:1) |
| `brand-hover` | `#5A3DE0` | Hover of brand fills |
| `brand-ink` | `#4B2FC9` | Brand-coloured text on light surfaces (7.9:1): active chip label, links like "Kazanımlara bak" |
| `brand-soft` | `#EFEBFE` | Active chip / selected row / running-round button fill |
| `accent` | = brand | 3D selection ring. **Not** the focus ring (see Rules) |

### Gauge hues (HUD) — `--color-g-*`

Icon + ~12% icon tile + thin bar / sparkline / stacked ramp. **Never body text**; values stay ink,
warnings still turn the number `negative-ink`. Gauge hues are **identity, not alarm**: none of them is the
warning red (`negative` is reserved for thresholds). An icon drawn on its own tile goes through
`iconTone(color)` (hue 80% + ink 20%), which keeps every gauge icon at >= 3.5:1 on its tile; bars and
sparklines keep the bright hue.

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
| `energy` / `energy-ink` | `#F2A11F` / `#A45F00` | Founder energy bar fill / its number |

Icons through `iconTone()` are >= 3.5:1 on their 12% tile (compact HUD shows the icon without its label,
so this is the identifier there). `energy` is a fill only.

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
| `--radius-control` | 10px | `rounded-control` (buttons, chips, inputs, stat tiles) |
| — | 6px | `rounded-md` (pills / tags) |
| `--shadow-card` | very light 2-layer | `shadow-card` — floating HUD cards, bubbles |
| `--shadow-pop` | light drop | `shadow-pop` — modals, bottom sheet, toasts |

Borders are always **1px**. Brand CTAs may carry a soft brand glow (`shadow-[0_4px_12px_-4px_var(--color-brand)]`).

### Helper classes (index.css)

- `.ui-card` — surface + 1px border + card radius + light shadow (use via `<Card>`).
- `.ui-label` — Oxanium 10.5px, 600, uppercase, `0.08em` tracking, `ink-2`.
- `.font-text` — Inter, resets tabular numerals (reading text). `.font-ui` — Oxanium.
- `.tabular` — tabular numerals.

## 2. Fonts

Loaded in `src/index.css` with `@font-face` from `public/fonts` (woff2 copied from
`@fontsource-variable/{oxanium,inter}`, latin + latin-ext only, which covers Turkish) and preloaded in
`index.html`. Not in `main.tsx`.

| Role | Font | Where |
|---|---|---|
| UI (default on `body`) | **Oxanium Variable** (`font-ui`) | Layout, HUD, headings, tab labels, labels, buttons, numbers (tabular), chips, pills, stats, toasts |
| Reading | **Inter Variable** (`font-text`) | Speech/world bubbles, Notebook (Defter) cards, decision text and option descriptions, long descriptions / help copy, empty & locked hints, tooltips longer than one line |

Rules: numbers are always Oxanium with tabular figures, even inside an Inter paragraph
(wrap in `<span className="font-ui tabular">`). Headings inside a notebook card may stay Oxanium.
Weights: 500 body UI, 600 buttons/labels/values, 700 only for the single most important number on a
card. No 800+.

## 3. Rules

1. **Text stays ink.** Body text, labels and values are `ink` / `ink-2`. Hue on text only for: green/red
   numbers (`*-ink` variants, `<Delta>`), `brand-ink` for active chip labels and links, `energy-ink` for
   the energy number. Everything else coloured is an icon, a bar, a dot or a light tint.
2. **Brand = action + progress.** `<Button tone="primary">` (brand fill), active dock tab, "Tur başlat",
   stage progress bar, `Bar` default fill, active `IconButton`, range thumb. One primary per surface.
3. **Every HUD gauge has its hue** (`WIDGET_COLOR` / `WidgetDef.color`): icon on a ~12% tile of that hue
   and its thin bar / sparkline / stacked ramp (`ramp(color)`: 100/70/45/25%). No solid discs.
4. **Departments are vivid**: dot + a light tint on pills (`<Pill tint>`) and avatars (18% fill, 45% ring).
   Filter chips carry the department as a `<Dot>` child; the **selected** state is always the brand chip
   (a 1px sales/ops frame is under 3:1, so a dept-tinted "selected" was not visible). Text on tints stays ink.
5. **Bubbles**: neutral body; kind = small tinted tile next to the speaker (`<SpeakerLine color>`):
   karar = `kind-decision` orange (crisis = `negative`), kavram = `kind-concept` violet.
6. **Founder actions**: available/running buttons use their own hue (`FOUNDER_COLOR`: icon, 12% fill,
   45% frame, cooldown/run ring). Locked or unavailable = dashed neutral frame, faded icon.
7. **Defter shelf**: learned books are solid spines in their `shelfColor` (label colour from
   `readableOn()`); unlearned slots stay dashed neutral. Notebook card rows use tinted `IconBadge`s.
   `shelfColor` values are one pastel-saturated family: no greys, no near-black, no neon, and every one
   takes ink text at >= 4.5:1 (guarded by `src/content/__tests__/concepts.test.ts`).
8. **Locked / disabled stays neutral** (dashed `border-strong`, `ink-3`), so colour always means "live".
9. Light shadows, hairline borders, generous whitespace; one surface level per stack (don't nest cards).
10. **A metric keeps its hue everywhere.** Panels showing a HUD metric use the same `WIDGET_COLOR` tile
    (`<Stat icon color>`) and the same warning rule (e.g. LTV:CAC < 3 red in HUD and Büyüme). Project
    maturity bars use the category hue (`CATEGORY_COLOR`).
11. **One brand CTA per list.** A blocked state is never a primary button: e.g. Mağaza with no room shows
    one "Boş yer yok — N. halkayı aç" banner with a single primary button above the list; items show a
    neutral "Boş yer yok" note.
12. **Focus ≠ selected.** `:focus-visible` = 2px **ink** outline + 2px surface gap, so keyboard focus never
    reads as the brand selected state (active tab / chip / row) and still shows on brand fills.

## 4. Components (`src/ui/primitives.tsx`)

| Component | Notes |
|---|---|
| `Card` | `.ui-card` |
| `Button` | tones `primary` (brand) / `secondary` (default) / `ghost` / `danger` / `onInk`; `soft` = secondary, `mint` = deprecated primary |
| `IconButton` | `rounded-control`; `active` = brand fill |
| `Bar` | brand fill by default; `tone` = Tailwind class, or `color` = CSS hue (track becomes a 16% tint of it) |
| `Ring` | brand stroke by default; pass `tone` |
| `Chip` | active = brand-soft + brand frame + brand-ink text (always; identity hues go in as a `<Dot>` child) |
| `Pill` | hairline tag; `dot` mark; `tint` = light fill of a hue (dept, live) |
| `Dot` | department / status / kind mark |
| `IconBadge` | neutral, `filled` faint square, or `color` = `iconTone(color)` icon on ~12% tile |
| `Stat` | metric row; `icon` + `color` add the metric's gauge tile (same as its HUD chip) |
| `Label`, `Delta`, `Divider`, `SectionTitle`, `LockedHint`, `Empty`, `QualityStars` (amber) | — |

HUD: `WidgetChip` takes `color`; `WIDGETS[id].color` is the registry field. Panel header icon = brand tile.
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
| `bg-{lilac,mint,peach,sky,lemon,rose}-100` (+ `/xx`) | surface-2 | **remove fill**; hairline `border border-border` if a frame is needed |
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
| `font-bold`/`font-extrabold` everywhere | — | `font-semibold`; bold only for the key figure |

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
| **A — HUD** | `src/ui/Hud.tsx`, `src/ui/widgets.tsx`, `src/ui/FounderActions.tsx`, `src/ui/ActivityLine.tsx`, `src/ui/Feedback.tsx`, `src/ui/icons.tsx` |
| **B — Panel** | `src/ui/RightPanel.tsx`, `src/ui/Dock.tsx`, `src/ui/DetailPanel.tsx`, `src/ui/panels/*` **except** `SettingsPanel.tsx` |
| **C — Bubbles & overlays** | `src/ui/bubbles/*`, `src/ui/NotebookCard.tsx`, `src/ui/ModalHost.tsx`, `src/ui/overlays/*`, `src/App.tsx` (start screen), `src/render/WorldBubbles.tsx` (`DefaultBubble`) |

Unassigned for now (other session has pending changes, or out of scope): `src/ui/panels/SettingsPanel.tsx`
(legacy `bg-cream-*`, `bg-mint-600` toggle, `rounded-full` segmented controls), `src/main.tsx`,
`src/ui/hooks.ts`, `src/audio/**`, `src/render/{layout,walker,constants,Office,Npc,Character,nav}`,
`src/ui/GameUI.tsx` (1 ref), `src/ui/dev/playground.tsx` (dev only).

3D scene: see §0. Still hardcoded in files owned by another session (move to `palette.ts` when free):
locked-ring overlay `#2D2B36` @ 0.55 in `Office.tsx` (should use `StagePalette.locked` at ~0.3), office
props (garage door, shelves, glass, plants, statue) in `Office.tsx`, leg colours in `Character.tsx` /
`Npc.tsx`.
