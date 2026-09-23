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

export interface StagePalette {
  /** Canvas clear colour. */
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

/** Index = StageIndex. Garage concrete grey → campus warm wood. */
export const STAGE_PALETTES: readonly StagePalette[] = [
  // 0 Garaj — concrete
  { background: '#efe9df', floor: '#bdbab4', floorAlt: '#b2afa9', wall: '#d6d2cb', wallTrim: '#a9a59e', accent: '#8fa3b8', locked: '#3a3942', ground: '#d9d3c8' },
  // 1 Pre-seed — coworking, light birch
  { background: '#f3ece1', floor: '#e2d2b8', floorAlt: '#d8c6a9', wall: '#f2ebe0', wallTrim: '#c9b79a', accent: '#9fe0c3', locked: '#3b3845', ground: '#dcd5c8' },
  // 2 Seed — small office, pale oak
  { background: '#f4ede2', floor: '#dcc6a2', floorAlt: '#d1b993', wall: '#efe6f5', wallTrim: '#b9a6cf', accent: '#c9a7f5', locked: '#393647', ground: '#d8d2c6' },
  // 3 Series A — open floor, sky tint
  { background: '#eef1f2', floor: '#d6c2a0', floorAlt: '#cbb591', wall: '#e4eef7', wallTrim: '#9cb7d3', accent: '#9cc9f5', locked: '#363849', ground: '#d3d6d4' },
  // 4 Series B — two floors, peach accents
  { background: '#f5ece6', floor: '#d3b58e', floorAlt: '#c7a780', wall: '#f7e7dd', wallTrim: '#d9a98d', accent: '#ffc1a1', locked: '#3a3644', ground: '#d6cfc6' },
  // 5 Series C — building, warm walnut + glass
  { background: '#f2ebe4', floor: '#c9a27a', floorAlt: '#bc956d', wall: '#eef3f1', wallTrim: '#9fc7b6', accent: '#9fe0c3', locked: '#383442', ground: '#cfd4cc' },
  // 6 Unicorn — campus, warm wood + lawn
  { background: '#f7efe2', floor: '#c49366', floorAlt: '#b8875b', wall: '#fbf1e2', wallTrim: '#e0b88a', accent: '#f5a3b5', locked: '#3b3643', ground: '#a9d59a' },
]

export function stagePalette(stage: StageIndex | number): StagePalette {
  return STAGE_PALETTES[Math.max(0, Math.min(STAGE_PALETTES.length - 1, stage))] ?? STAGE_PALETTES[0]!
}

/** Clothing colour per department. */
export const DEPT_COLORS: Record<Dept, string> = {
  eng: '#8fb8f0',
  product: '#c9a7f5',
  marketing: '#ffb58f',
  sales: '#f7d56e',
  ops: '#8fd8b5',
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

/** Interaction colours. */
export const HIGHLIGHT = {
  hover: '#ffffff',
  selected: '#ffd66e',
  valid: '#7fdca6',
  invalid: '#f19a9a',
  aura: '#ffe38a',
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
