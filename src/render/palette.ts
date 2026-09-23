// Single colour source for the 3D scene (PLAN §7.1). UI lane may import the pastel tokens too.
// Pure data: no three import, safe for any layer.
import type { Dept, EmployeeStatus, NpcRole, SlotType, StageIndex } from '../engine/types'

/**
 * Lively pastel base palette for the 3D scene (docs/DESIGN.md "Sahne canlı, UI sade"): pastel lightness
 * but enough chroma that props read as colour, not as grey. Used by stage decor, previews and confetti.
 */
export const PASTEL = {
  cream50: '#fdf8ef',
  cream100: '#f7eddc',
  cream200: '#efdcc0',
  ink900: '#2b2a33',
  ink600: '#5b5866',
  lilac: '#b79cff',
  mint: '#7fdcb4',
  peach: '#ffb48a',
  sky: '#86bdf7',
  lemon: '#ffd95c',
  rose: '#ff94ae',
  sage: '#a6d68e',
  sand: '#ecc996',
} as const

/** Brand colour (unicorn violet) = --color-brand in src/index.css: selection ring, founder, aura. */
export const BRAND = '#6b4ef0'

/**
 * UI-facing neutrals mirrored from src/index.css @theme (docs/DESIGN.md). Use these for anything
 * DOM/UI-like drawn from the render layer (world bubbles, canvas backdrop).
 * 3D furniture/character colours stay in PASTEL / STAGE_PALETTES below.
 */
export const UI_TONES = {
  surface: '#fbfaf7',
  surface2: '#f3f1ec',
  canvasBg: '#f3ebdf',
  border: '#e8e4dc',
  ink: '#1f1d24',
  ink2: '#64616b',
  ink3: '#9b978f',
  accent: BRAND,
  positive: '#1f9d63',
  negative: '#e0483e',
} as const

export interface StagePalette {
  /** Canvas clear colour (= --color-canvas-bg: warm light backdrop on every stage). */
  background: string
  floor: string
  /** Checker / plank accent on the floor. */
  floorAlt: string
  wall: string
  wallTrim: string
  /** Accent used for stage-specific decor (garage door, signage, glass door…). */
  accent: string
  /** Colour of the dark overlay on locked rings. */
  locked: string
  /** Colour of the world outside the office (street, lawn…). */
  ground: string
}

/**
 * Index = StageIndex (PLAN §7.1: garage concrete → campus warm wood). The scene carries the colour:
 * a warm sand ground outside, warm floors (concrete → birch → oak → honey → walnut), and every stage
 * gets its own soft wall hue with a saturated trim/accent of the same family, so a stage change is
 * visible at a glance. Floors stay mid-light so pastel furniture and dept shirts read on top of them.
 */
// Lit ground: the warm lights + Neutral tone mapping (GameCanvas) tint and darken it, so the base is a near
// white and the rendered pixel lands at ~#ece0ce, close to --color-canvas-bg (#f3ebdf): UI cards and the
// scene share one warm light ground.
const GROUND = '#fdfcf8'
export const STAGE_PALETTES: readonly StagePalette[] = [
  // 0 Garaj — warm concrete, beige-grey walls, coral garage door
  { background: UI_TONES.canvasBg, floor: '#cec4b4', floorAlt: '#c2b7a6', wall: '#f2e8d7', wallTrim: '#c9aa8a', accent: '#f08a6c', locked: '#3a3530', ground: GROUND },
  // 1 Pre-seed — coworking, light birch, mint walls
  { background: UI_TONES.canvasBg, floor: '#e6c99a', floorAlt: '#dcbb89', wall: '#c4ecd6', wallTrim: '#6fcaa2', accent: '#35b487', locked: '#343a36', ground: GROUND },
  // 2 Seed — small office, pale oak, lilac walls
  { background: UI_TONES.canvasBg, floor: '#e2bf8c', floorAlt: '#d6b07b', wall: '#dccffc', wallTrim: '#a58cf0', accent: '#7c5cf2', locked: '#36324a', ground: GROUND },
  // 3 Series A — open floor, oak, sky walls
  { background: UI_TONES.canvasBg, floor: '#ddb682', floorAlt: '#d0a672', wall: '#cadffb', wallTrim: '#7aaef0', accent: '#3f84e5', locked: '#31384a', ground: GROUND },
  // 4 Series B — two floors, honey wood, peach walls
  { background: UI_TONES.canvasBg, floor: '#d9ab76', floorAlt: '#cc9c67', wall: '#fdd5bf', wallTrim: '#f3c4a8', accent: '#ef7446', locked: '#43342e', ground: GROUND },
  // 5 Series C — building, walnut + glass, seafoam walls
  { background: UI_TONES.canvasBg, floor: '#cc9d6e', floorAlt: '#bf8f60', wall: '#c6eee4', wallTrim: '#5fc3b1', accent: '#1ea893', locked: '#2f3c3a', ground: '#f6efdf' },
  // 6 Unicorn — campus, warm wood on a lawn, rose accents
  { background: UI_TONES.canvasBg, floor: '#d6a26e', floorAlt: '#c9945f', wall: '#fbd3e1', wallTrim: '#f29ab4', accent: '#e8649a', locked: '#40313a', ground: '#b4dc98' },
]

export function stagePalette(stage: StageIndex | number): StagePalette {
  return STAGE_PALETTES[Math.max(0, Math.min(STAGE_PALETTES.length - 1, stage))] ?? STAGE_PALETTES[0]!
}

/**
 * Clothing colour per department. Single source of department identity: mirrors --color-dept-* in
 * src/index.css so the UI dot next to "Müh" matches the shirt in the scene. Saturated enough to
 * separate a person from the warm wood floor (none of them is a wood/beige hue).
 */
export const DEPT_COLORS: Record<Dept, string> = {
  eng: '#3f7fe8',
  product: '#9a5cf0',
  marketing: '#f0605a',
  sales: '#f5a81c',
  ops: '#14a98f',
}

/**
 * Visitor clothing per NPC role. Visitors must never read as a department member, so their bodies stay
 * OUTSIDE the dept hues (blue / violet / coral-red / amber / teal): deeper, muted outfits (navy, olive,
 * brown, charcoal, slate) or the free hues (magenta, lime). The role reads from the accessory (Npc.tsx)
 * and `accent`, the bright visitor ring on the floor.
 */
export const NPC_COLORS: Record<NpcRole, { body: string; accent: string }> = {
  mentor: { body: '#8a6f55', accent: '#f4ead2' },
  cofounder: { body: '#d9559a', accent: '#ffe3ec' },
  accountant: { body: '#6f7f45', accent: '#f4f1e8' },
  engineer: { body: '#34405e', accent: '#7fdcb4' },
  investor: { body: '#2f3344', accent: '#f2c14e' },
  customer: { body: '#8fb83a', accent: '#fff1dc' },
  journalist: { body: '#5d6a75', accent: '#ffd24d' },
}

/** The founder wears the brand violet (lighter tint so the shirt still reads shaded) + golden horn. */
export const FOUNDER_COLORS = { body: '#9f82ff', accent: '#fff5fb', horn: '#ffd24d' } as const

export const SKIN_TONES = ['#f6d7bf', '#eec4a1', '#d9a47d', '#b97e56', '#8d5a3b', '#f3cfb3'] as const
export const HAIR_COLORS = ['#2b2a33', '#4a3428', '#7a5230', '#c8924d', '#e8c77e', '#b3542f', '#8c8c96'] as const

/** Floor marker tint per slot type (PLAN §3.3). */
export const SLOT_COLORS: Record<SlotType, string> = {
  desk: '#6fa8f5',
  common: '#4fcf9b',
  room: '#a585ff',
  special: '#ffc63d',
}

/**
 * Interaction colours. Selection = brand violet (--color-accent; the UI focus ring is ink);
 * placement validity reuses the positive / negative tokens.
 */
export const HIGHLIGHT = {
  hover: '#ffffff',
  selected: UI_TONES.accent,
  valid: UI_TONES.positive,
  invalid: UI_TONES.negative,
  aura: '#a996f7',
} as const

/** Status icon colours above heads (PLAN §7.2). */
export const STATUS_COLORS: Record<EmployeeStatus, string> = {
  working: '#4fd08a',
  tired: '#ffc93d',
  burnout: '#8d8a99',
  break: '#d09a62',
  onboarding: '#6fb0f5',
  leaving: '#f26464',
}

export const CONFETTI_COLORS = [PASTEL.lilac, PASTEL.mint, PASTEL.peach, PASTEL.sky, PASTEL.lemon, PASTEL.rose, BRAND] as const

/** Fallback book colours when a concept has no shelfColor. */
export const BOOK_COLORS = ['#ef6f6f', '#5f9ff0', '#f2b63d', '#5fc98a', '#a57ff0', '#f58ab4', '#3fc1bd'] as const
