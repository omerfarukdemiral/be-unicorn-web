// Maps a furniture id to a render model. Uses the content catalog when the id exists,
// otherwise guesses from keywords so mock states and future items still draw something sensible.
import { FURNITURE } from '../content'
import type { FurnitureItem, PrimitiveHint } from '../content'
import type { StageBand } from '../content/stageBand'
import type { SlotType } from '../engine/types'
import { SLOT_COLORS } from './palette'
import { STARTER_ITEMS, extrasFor } from './stageLook'

export const SHAPES = [
  'desk', 'deskErgo', 'deskDual',
  'coffee', 'kitchen', 'gameCorner', 'plant', 'sofa', 'waterCooler', 'pingPong',
  'meeting', 'serverRack', 'bookshelf', 'phoneBooth', 'whiteboard',
  'demoStage', 'lab', 'podcast', 'helipad',
  'generic',
] as const
export type ShapeKey = (typeof SHAPES)[number]

export interface ResolvedFurniture {
  id: string
  item?: FurnitureItem
  shape: ShapeKey
  size: 1 | 2
  slotType: SlotType
  colors: { primary: string; secondary: string; accent: string }
  /** Finish pieces of a bigger company (G2), drawn on top of the item; empty at band 1 and on lowPower. */
  extras: readonly PrimitiveHint[]
}

// Order matters: first match wins.
const KEYWORDS: [RegExp, ShapeKey][] = [
  [/dual|double|cift|çift|triple/, 'deskDual'],
  [/ergo|standing|stand/, 'deskErgo'],
  [/desk|masa/, 'desk'],
  [/server|sunucu|rack/, 'serverRack'],
  [/book|library|shelf|kitap/, 'bookshelf'],
  [/meet|toplant|conference/, 'meeting'],
  [/phone|booth|kabin/, 'phoneBooth'],
  [/white ?board|tahta/, 'whiteboard'],
  [/coffee|kahve|espresso|barista/, 'coffee'],
  [/kitchen|mutfak|snack|fridge/, 'kitchen'],
  [/ping|table.?tennis|masa.?tenis/, 'pingPong'],
  [/game|oyun|arcade|console/, 'gameCorner'],
  [/plant|bitki|tree|ficus|cactus|monstera/, 'plant'],
  [/sofa|couch|koltuk|lounge|beanbag|puf/, 'sofa'],
  [/water|su.?sebil|cooler/, 'waterCooler'],
  [/stage|sahne|demo/, 'demoStage'],
  [/lab|r&d|arge|ar-ge|research/, 'lab'],
  [/podcast|studio|stüdyo|stud/, 'podcast'],
  [/heli|pist/, 'helipad'],
]

function guessShape(text: string): ShapeKey | undefined {
  const t = text.toLowerCase()
  if ((SHAPES as readonly string[]).includes(text)) return text as ShapeKey
  for (const [re, shape] of KEYWORDS) if (re.test(t)) return shape
  return undefined
}

const DEFAULT_BY_TYPE: Record<SlotType, ShapeKey> = {
  desk: 'desk',
  common: 'coffee',
  room: 'meeting',
  special: 'demoStage',
}

const DEFAULT_COLORS: Record<ShapeKey, { primary: string; secondary: string; accent: string }> = {
  desk: { primary: '#e9d6b8', secondary: '#5b5866', accent: '#9cc9f5' },
  deskErgo: { primary: '#f0e2c8', secondary: '#4d4b58', accent: '#9fe0c3' },
  deskDual: { primary: '#f4ead8', secondary: '#3e3c48', accent: '#c9a7f5' },
  coffee: { primary: '#c79a6b', secondary: '#f6efe4', accent: '#e57f7f' },
  kitchen: { primary: '#f4f1ea', secondary: '#9fe0c3', accent: '#ffc1a1' },
  gameCorner: { primary: '#c9a7f5', secondary: '#3e3c48', accent: '#f7e08a' },
  plant: { primary: '#8fcf8a', secondary: '#e7b48a', accent: '#6db36a' },
  sofa: { primary: '#f5a3b5', secondary: '#e9d6b8', accent: '#fbf8f2' },
  waterCooler: { primary: '#f4f1ea', secondary: '#9cc9f5', accent: '#5b5866' },
  pingPong: { primary: '#6fbf8e', secondary: '#f4f1ea', accent: '#e57f7f' },
  meeting: { primary: '#e9d6b8', secondary: '#cfe8f5', accent: '#c9a7f5' },
  serverRack: { primary: '#4d4b58', secondary: '#2b2a33', accent: '#7fdca6' },
  bookshelf: { primary: '#c79a6b', secondary: '#a87c52', accent: '#fbf8f2' },
  phoneBooth: { primary: '#9fe0c3', secondary: '#cfe8f5', accent: '#fbf8f2' },
  whiteboard: { primary: '#fbf8f2', secondary: '#8c8c96', accent: '#e57f7f' },
  demoStage: { primary: '#3e3c48', secondary: '#f5a3b5', accent: '#f7e08a' },
  lab: { primary: '#f4f1ea', secondary: '#9cc9f5', accent: '#9fe0c3' },
  podcast: { primary: '#3e3c48', secondary: '#f5a3b5', accent: '#f7e08a' },
  helipad: { primary: '#5b5866', secondary: '#f7e08a', accent: '#fbf8f2' },
  generic: { primary: '#e9d6b8', secondary: '#c9a7f5', accent: '#9fe0c3' },
}

const byId = new Map<string, FurnitureItem>()
function catalogItem(id: string): FurnitureItem | undefined {
  if (byId.size !== FURNITURE.length) {
    byId.clear()
    for (const f of FURNITURE) byId.set(f.id, f)
  }
  return byId.get(id)
}

const cache = new Map<string, ResolvedFurniture>()

/** A starter item's colours as the company grows: the next catalog tiers' paint (band 2: one step up, band 3: two). */
function starterColors(item: FurnitureItem, band: StageBand): FurnitureItem['visual']['colors'] {
  let cur: FurnitureItem = item
  for (let step = band - 1; step > 0 && cur.upgradesTo; step--) cur = catalogItem(cur.upgradesTo) ?? cur
  return cur.visual.colors
}

/**
 * `band` is the company's look band (content/stageBand): purchased and shop items gain `extras` from band 2 and keep
 * their colours at every band; only STARTER_ITEMS are repainted. `withExtras` false is the same item without the
 * finish (the scene's mesh budget). The result is cached and shared: never mutate it or the catalog hints.
 */
export function resolveFurniture(id: string, slotType: SlotType = 'desk', band: StageBand = 1, withExtras = true): ResolvedFurniture {
  const key = `${id}|${slotType}|${band}|${withExtras ? 1 : 0}|${FURNITURE.length}`
  const hit = cache.get(key)
  if (hit) return hit
  const item = catalogItem(id)
  const type = item?.slotType ?? slotType
  const shape = (item && guessShape(item.visual.shape)) ?? guessShape(id) ?? DEFAULT_BY_TYPE[type]
  const base = DEFAULT_COLORS[shape]
  const own = item && STARTER_ITEMS.has(item.id) && band >= 2 ? starterColors(item, band) : item?.visual.colors
  const colors = {
    primary: own?.primary ?? base.primary,
    secondary: own?.secondary ?? base.secondary,
    accent: own?.accent ?? base.accent,
  }
  const size: 1 | 2 = item?.size ?? (type === 'room' || shape === 'meeting' || shape === 'serverRack' ? 2 : 1)
  // Finish is drawn over the catalog's hand-placed primitives; a mock id with no hints has none to line up with.
  const extras = withExtras && item?.visual.primitives?.length ? extrasFor(shape, band) : []
  const out: ResolvedFurniture = { id, item, shape, size, slotType: type, colors, extras }
  cache.set(key, out)
  return out
}

export function slotTint(type: SlotType): string {
  return SLOT_COLORS[type]
}
