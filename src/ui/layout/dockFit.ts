// Founder dock sizing on phones (M3, fix round F6): the slot is 44px while the row has room, else 40px (the 44px hit area
// stays: a pseudo-element, the ::before in FounderSlot). The row's room is measured (FounderBar), so at 390 wide all
// seven slots fit from Pre-seed on; whatever still does not fit (375px and narrower, from Pre-seed) scrolls sideways behind a fade.
import { SLOT } from '../FounderActions'

export const SLOT_NARROW = 40
const GAP = 4

/** Slot side for `count` slots in `room` px (the measured row): 44 when it fits, else the 40px key. */
export function slotSizeForRoom(count: number, room: number): number {
  return dockFits(count, SLOT, room) ? SLOT : SLOT_NARROW
}

/**
 * Whether `count` slots fit `room` px: false means the row scrolls and shows the fade cue.
 * `room` = the width of the scroll row (pill width minus energy, moves and divider).
 */
export function dockFits(count: number, slot: number, room: number): boolean {
  return count * slot + Math.max(0, count - 1) * GAP <= room
}

/** More menu: a click on a zoom stepper keeps the menu open (several steps in a row); any other pick closes it. */
export function keepsMenuOpen(target: EventTarget | null, labels: string[]): boolean {
  const el = (target as Element | null)?.closest?.('button')
  return !!el && labels.includes(el.getAttribute('aria-label') ?? '')
}
