// Founder dock sizing on narrow phones (M3): at <= 375px wide the 44px slots no longer fit the pill from stage 2 on.
// The slot shrinks to 40px with 4px gaps; the 44px hit area stays (a pseudo-element, the ::before in FounderSlot). Whatever
// still does not fit scrolls sideways (the row shows a fade, FounderBar).
import { SLOT } from '../FounderActions'

export const NARROW_PHONE_W = 375
export const SLOT_NARROW = 40
const GAP = 4

/** Slot side in px for a viewport width. */
export function slotSizeFor(vw: number): number {
  return vw <= NARROW_PHONE_W ? SLOT_NARROW : SLOT
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
