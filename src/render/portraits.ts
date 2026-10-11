// Character portrait set (T16): the same low-poly people as the scene, shot once as head-and-shoulders PNGs for the
// ui (Ekip cards, event cards, bubbles). Ids are the file names under public/portraits/{id}@1x.png / @2x.png.
// The ui references them by path only (ui never imports render); this list is the single source of what exists.
import type { Dept, NpcRole } from '../engine/types'
import { DEPTS, NPC_ROLES } from '../engine/types'
import { FOUNDER_LOOK, employeeLook } from './Character'
import type { CharacterLook } from './CharacterModel'
import { npcLook } from './Npc'
import { NPC_LEGS } from './palette'

/** The company buyer (sell the company, §8.2) has no scene role: a suit with a gold tie and glasses. */
const BUYER_LOOK: CharacterLook = {
  body: '#3b4a6b',
  skin: '#e0b48f',
  hair: '#b9b4ad',
  hairStyle: 0,
  accessories: ['tie', 'glasses'],
  legs: NPC_LEGS.investor,
}

export type PortraitId = 'founder' | 'buyer' | NpcRole | `team-${Dept}`

export const PORTRAIT_IDS: readonly PortraitId[] = ['founder', ...NPC_ROLES, 'buyer', ...DEPTS.map((d) => `team-${d}` as const)]

/** Square sizes (px): @1x and @2x. */
export const PORTRAIT_SIZES = [96, 192] as const

/** Stable looks: a fixed seed per id, so a re-shoot gives the same face. */
export function portraitLook(id: PortraitId): CharacterLook {
  if (id === 'founder') return FOUNDER_LOOK
  if (id === 'buyer') return BUYER_LOOK
  if (id.startsWith('team-')) {
    const dept = id.slice(5) as Dept
    // Team faces always wear their dept's accessory (the hash picks one that does).
    const seed = TEAM_SEEDS[dept]
    return employeeLook(seed, dept)
  }
  return npcLook(`portrait:${id}`, id as NpcRole)
}

/** Seeds whose employeeLook carries the dept accessory (headphones, glasses, cap, tie) and differ in skin and hair. */
const TEAM_SEEDS: Record<Dept, string> = {
  eng: 'portrait:eng:3',
  product: 'portrait:product:0',
  marketing: 'portrait:marketing:3',
  sales: 'portrait:sales:0',
  ops: 'portrait:ops:0',
}

export function portraitPath(id: PortraitId, scale: 1 | 2 = 1): string {
  return `/portraits/${id}@${scale}x.png`
}
