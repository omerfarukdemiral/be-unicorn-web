// Single colour source for the 3D scene (PLAN §7.1). UI lane may import the pastel tokens too.
// Pure data: no three import, safe for any layer.
import type { Dept, EmployeeStatus, NpcRole, SlotType, StageIndex } from '../engine/types'

/** Soft pastel base palette (matches the cream/pastel tokens in src/index.css). */
export const PASTEL = {
  cream50: '#fbf8f2',
  cream100: '#f6efe4',
  cream200: '#ece0cc',
  ink900: '#2b2a33',
  ink600: '#5b5866',
  lilac: '#c9a7f5',
  mint: '#9fe0c3',
  peach: '#ffc1a1',
  sky: '#9cc9f5',
  lemon: '#f7e08a',
  rose: '#f5a3b5',
  sage: '#b8d8a8',
  sand: '#e8d3b0',
} as const

/**
 * UI-facing neutrals mirrored from src/index.css @theme (minimal palette, docs/DESIGN.md).
 * Use these for anything DOM/UI-like drawn from the render layer (world bubbles, canvas backdrop).
 * 3D furniture/character colours stay in PASTEL / STAGE_PALETTES below.
 */
export const UI_TONES = {
  surface: '#f6f5f2',
  surface2: '#eeede9',
  canvasBg: '#e9e8e4',
  border: '#e4e2dd',
  ink: '#1c1b1f',
  ink2: '#6b6a70',
  ink3: '#9c9ba1',
  accent: '#3e63dd',
  positive: '#2f9e6b',
  negative: '#d2463c',
} as const

export interface StagePalette {
  /** Canvas clear colour (UI backdrop: neutral canvas-bg on every stage). */
  background: string
  floor: string
  /** Checker / plank accent on the floor. */
  floorAlt: string
  wall: string
  wallTrim: string
  /** Accent used for stage-specific decor (garage door, signage…). */
  accent: string
  /** Colour of the dark overlay on locked rings. */
  locked: string
  /** Colour of the world outside the office (street, lawn…). */
  ground: string
}

/**
 * Index = StageIndex. Minimal look (docs/DESIGN.md): the world outside the office is one neutral a step
 * darker than the UI canvas, so panels (#f6f5f2) sit on a calm grey instead of a warm beige. Floors keep
 * a faint wood/concrete warmth only through value, walls stay near-white neutrals, and every stage accent
 * comes from the same ink ramp (no pastel hues).
 */
const GROUND = '#d6d5d1'
export const STAGE_PALETTES: readonly StagePalette[] = [
  // 0 Garaj — concrete
  { background: UI_TONES.canvasBg, floor: '#c4c3bf', floorAlt: '#bab9b5', wall: '#e1e0dc', wallTrim: '#aeada9', accent: '#8e8d93', locked: '#3a3942', ground: GROUND },
  // 1 Pre-seed — coworking, light birch
  { background: UI_TONES.canvasBg, floor: '#dcd8d0', floorAlt: '#d2cec6', wall: '#efeeea', wallTrim: '#bdbbb5', accent: '#6b6a70', locked: '#3b3845', ground: GROUND },
  // 2 Seed — small office, pale oak
  { background: UI_TONES.canvasBg, floor: '#d8d3c9', floorAlt: '#cdc8be', wall: '#eeede9', wallTrim: '#b4b2ac', accent: '#55545a', locked: '#393647', ground: GROUND },
  // 3 Series A — open floor
  { background: UI_TONES.canvasBg, floor: '#d3cdc2', floorAlt: '#c8c2b7', wall: '#ecebe7', wallTrim: '#aaa8a2', accent: '#45444a', locked: '#363849', ground: GROUND },
  // 4 Series B — two floors
  { background: UI_TONES.canvasBg, floor: '#cec7ba', floorAlt: '#c3bcaf', wall: '#f0efeb', wallTrim: '#a3a19b', accent: '#38373c', locked: '#3a3644', ground: GROUND },
  // 5 Series C — building, walnut + glass
  { background: UI_TONES.canvasBg, floor: '#c8bfb0', floorAlt: '#bdb4a5', wall: '#eeeeeb', wallTrim: '#9c9ba1', accent: '#2c2b30', locked: '#383442', ground: GROUND },
  // 6 Unicorn — campus
  { background: UI_TONES.canvasBg, floor: '#c2b8a8', floorAlt: '#b7ad9d', wall: '#f2f1ed', wallTrim: '#8e8d93', accent: '#1c1b1f', locked: '#3b3643', ground: GROUND },
]

export function stagePalette(stage: StageIndex | number): StagePalette {
  return STAGE_PALETTES[Math.max(0, Math.min(STAGE_PALETTES.length - 1, stage))] ?? STAGE_PALETTES[0]!
}

/**
 * Clothing colour per department. Single source of department identity: mirrors --color-dept-* in
 * src/index.css so the UI dot next to "Müh" matches the shirt in the scene.
 */
export const DEPT_COLORS: Record<Dept, string> = {
  eng: '#4c7bd9',
  product: '#8a63d2',
  marketing: '#e07a45',
  sales: '#c9a227',
  ops: '#2f9e8b',
}

/** Visitor clothing per NPC role. */
export const NPC_COLORS: Record<NpcRole, { body: string; accent: string }> = {
  mentor: { body: '#a58bd1', accent: '#efe6d0' },
  cofounder: { body: '#f08fa8', accent: '#fbe6ec' },
  accountant: { body: '#7f9a8c', accent: '#f4f1e8' },
  engineer: { body: '#6d8fc9', accent: '#2b2a33' },
  investor: { body: '#3f4458', accent: '#e8c46a' },
  customer: { body: '#f4a86a', accent: '#fff4e0' },
  journalist: { body: '#c96d6d', accent: '#2b2a33' },
}

export const FOUNDER_COLORS = { body: '#b48cf0', accent: '#fff5fb', horn: '#f7e08a' } as const

export const SKIN_TONES = ['#f6d7bf', '#eec4a1', '#d9a47d', '#b97e56', '#8d5a3b', '#f3cfb3'] as const
export const HAIR_COLORS = ['#2b2a33', '#4a3428', '#7a5230', '#c8924d', '#e8c77e', '#b3542f', '#8c8c96'] as const

/** Floor marker tint per slot type (PLAN §3.3). */
export const SLOT_COLORS: Record<SlotType, string> = {
  desk: '#9cc9f5',
  common: '#9fe0c3',
  room: '#c9a7f5',
  special: '#f7e08a',
}

/**
 * Interaction colours. One calm accent for selection (same as the UI focus ring, --color-accent);
 * placement validity reuses the positive / negative tokens.
 */
export const HIGHLIGHT = {
  hover: '#ffffff',
  selected: UI_TONES.accent,
  valid: UI_TONES.positive,
  invalid: UI_TONES.negative,
  aura: '#8fa6ee',
} as const

/** Status icon colours above heads (PLAN §7.2). */
export const STATUS_COLORS: Record<EmployeeStatus, string> = {
  working: '#7fdca6',
  tired: '#f7d56e',
  burnout: '#8d8a99',
  break: '#c79a6b',
  onboarding: '#9cc9f5',
  leaving: '#f08080',
}

export const CONFETTI_COLORS = [PASTEL.lilac, PASTEL.mint, PASTEL.peach, PASTEL.sky, PASTEL.lemon, PASTEL.rose] as const

/** Fallback book colours when a concept has no shelfColor. */
export const BOOK_COLORS = ['#e57f7f', '#7fb0e5', '#e5c27f', '#8fd19e', '#b596e0', '#f0a0c0', '#7fd1cf'] as const
