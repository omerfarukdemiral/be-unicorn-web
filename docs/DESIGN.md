# Be Unicorn — Design System (minimal)

Direction: **neutral + one accent**. Calm, low-density colour. Hue appears only on numbers and tiny
status marks. Replaces the cream + pastel look of PLAN §7.4.

Source of truth: `src/index.css` (`@theme`). Shared components: `src/ui/primitives.tsx`,
UI constants: `src/ui/theme.ts`. Render-side mirror of the neutrals: `UI_TONES` in `src/render/palette.ts`.

## 1. Tokens

### Colour

| Token (Tailwind name) | Value | Use |
|---|---|---|
| `surface` | `#F6F5F2` | Panels, cards, bubbles, sheets |
| `surface-2` | `#EEEDE9` | Inset fills: hover, pressed, segmented-control track |
| `canvas-bg` | `#E9E8E4` | Page background and 3D scene clear colour |
| `border` | `#E4E2DD` | 1px hairlines, progress track |
| `border-strong` | `#D3D1CB` | Secondary-button frame, dashed hints, dividers on `surface-2` |
| `ink` | `#1C1B1F` | Primary text, primary button, active tab/chip, progress fill |
| `ink-2` | `#6B6A70` | Secondary text, icons, labels |
| `ink-3` | `#9C9BA1` | Tertiary text, disabled, placeholder, empty-state icons |
| `on-ink` | `#F6F5F2` | Text/icon on `ink` fills |
| `accent` | `#3E63DD` | **Only** focus ring and selection highlight. Never a fill for buttons/cards |
| `positive` | `#2F9E6B` | **Only** numbers (+cash, growth) and tiny status marks |
| `negative` | `#D2463C` | **Only** numbers (burn, loss), critical status marks, destructive text |
| `dept-eng` | `#4C7BD9` | Department dot |
| `dept-product` | `#8A63D2` | Department dot |
| `dept-marketing` | `#E07A45` | Department dot |
| `dept-sales` | `#C9A227` | Department dot |
| `dept-ops` | `#2F9E8B` | Department dot |

Opacity modifiers work (`bg-ink/85`, `bg-negative/5`). Inline styles / SVG: `var(--color-ink)` etc.
Render layer (no CSS access): `UI_TONES.surface`, `UI_TONES.ink`, ... from `src/render/palette.ts`.

### Shape and elevation

| Token | Value | Tailwind |
|---|---|---|
| `--radius-card` | 14px | `rounded-card` (cards, panels, sheets, overlays) |
| `--radius-control` | 10px | `rounded-control` (buttons, chips, inputs, stat tiles) |
| — | 6px | `rounded-md` (pills / tags) |
| `--shadow-card` | very light 2-layer | `shadow-card` — floating HUD cards, bubbles |
| `--shadow-pop` | light drop | `shadow-pop` — modals, bottom sheet, toasts |

Borders are always **1px** (`border border-border`). Prefer a hairline over a shadow for anything
docked (panel sections, list rows). Avoid `rounded-full` on rectangular controls; keep it for dots,
avatars and round icon-only FABs.

### Helper classes (index.css)

- `.ui-card` — surface + 1px border + card radius + light shadow (use via `<Card>`).
- `.ui-label` — Oxanium 10.5px, 600, uppercase, `0.08em` tracking, `ink-2` (KASA, KULLANICI, section titles).
- `.font-text` — switches to Inter and resets tabular numerals (reading text).
- `.font-ui` — Oxanium (the body default; use to switch back inside a `.font-text` block).
- `.tabular` — tabular numerals (body already sets `tabular-nums`; keep for clarity on counters).

## 2. Fonts

Loaded in `src/index.css` via `@import "@fontsource-variable/oxanium"` and
`@import "@fontsource-variable/inter"` (latin + latin-ext cover Turkish). Not in `main.tsx`.

| Role | Font | Where |
|---|---|---|
| UI (default on `body`) | **Oxanium Variable** (`font-ui`) | Layout, HUD, headings, tab labels, labels, buttons, numbers (tabular), chips, pills, stats, toasts |
| Reading | **Inter Variable** (`font-text`) | Speech/world bubbles, Notebook (Defter) cards, decision text and option descriptions, long descriptions / help copy, empty & locked hints, tooltips longer than one line |

Rules: numbers are always Oxanium with tabular figures, even inside an Inter paragraph
(wrap in `<span className="font-ui tabular">`). Headings inside a notebook card may stay Oxanium.
Weights: 500 body UI, 600 buttons/labels/values, 700 only for the single most important number on a
card. No 800+.

## 3. Rules

1. **Colour only on numbers.** `positive` / `negative` go on figures (`<Delta>`, `deltaTone(n)`) and
   6-8px status marks (`<Dot>`, `STATUS_DOT`). Never on backgrounds, chips, buttons or card borders.
2. **No pastel.** No pastel icon discs, no coloured chip fills, no gradients, no coloured/gradient
   progress bars. Progress = `bg-ink` on `bg-border` track (`<Bar>`); critical morale may use `bg-negative`.
3. **Department = dot.** `DEPT_COLOR[d].dot` rendered as `<Dot color=... size={6|8} />` next to text.
   Never a filled pill, avatar background or card tint.
4. **Primary = ink.** `<Button tone="primary">` (ink fill) for the one main action per surface.
   Everything else `secondary` (1px frame, transparent) or `ghost`. `danger` = frame + red text.
5. **Accent is for focus/selection only** (`:focus-visible` ring, selected list row outline/tick).
6. **Icons are `ink-2`, no disc.** Use `<IconBadge icon=... />` (no background) or `filled` for a very
   faint neutral square when the icon needs a hit target visual.
7. **Active tab / chip** = ink fill + `on-ink` text, or an ink underline for tab bars.
8. Light shadows, hairline borders, generous whitespace; one surface level per stack (don't nest cards).

## 4. Components (`src/ui/primitives.tsx`)

| Component | Notes |
|---|---|
| `Card` | `.ui-card` |
| `Button` | tones `primary` / `secondary` (default) / `ghost` / `danger`; `soft` = alias of secondary, `mint` = deprecated alias of primary |
| `IconButton` | `rounded-control`; `active` = ink fill |
| `Bar` | ink fill, 6px default, hairline marker |
| `Ring` | 2px ink stroke on `border` track |
| `Chip` | active ink fill; idle hairline frame |
| `Pill` | hairline tag, `text-ink-2`; pass a text colour via `className`, optional `dot` |
| `Dot` | **new** — department/status mark |
| `Label` | **new** — `.ui-label` wrapper |
| `Delta` | **new** — signed number with positive/negative colour |
| `IconBadge` | **new** — neutral icon badge (replaces pastel icon discs) |
| `Divider` | **new** — 1px `border` line |
| `SectionTitle`, `LockedHint`, `Empty`, `Stat`, `QualityStars` | restyled neutral |

`src/ui/theme.ts`: `DEPT_COLOR` (`bg`/`fg` now neutral, `dot` = CSS var), `STATUS_TONE` (text colour only),
**new** `STATUS_DOT`, `moraleTone` (ink / ink-3 / negative), **new** `deltaTone(n)`.

## 5. Legacy token migration map

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

3D scene: furniture, characters, walls, floors keep their colours (`PASTEL`, `STAGE_PALETTES` except
`background`, `DEPT_COLORS`, `NPC_COLORS`…). Only the canvas clear colour moved to `UI_TONES.canvasBg`.
