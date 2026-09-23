// Pure "where does Satın al put this?" rules for the Mağaza (unit-tested in shopPlacement.test.ts).
// Uses the engine's own placement helpers so the preview matches what placeItem does.
import { canPlaceAt, findAutoSlotFor, type PlacementSpec } from '../../engine/office'
import type { OfficeState, RingState, Slot } from '../../engine/types'

export interface ShopPlacement {
  /** Slot the item would land on now (null: no room in the open rings). */
  slot: Slot | null
  /** True when it goes to the tapped slot (slotTarget) rather than the auto slot. */
  targeted: boolean
  /** A slot was tapped but the item cannot go there (other type, or no partner for size 2). */
  targetMisfit: boolean
  /** No room now: next ring to open (rings open strictly in order). */
  nextRing?: RingState
  /** No room now: first locked ring of this office that would hold the item (null: none, next office). */
  roomRing: number | null
}

function lockedRings(office: OfficeState): RingState[] {
  return office.rings.filter((r) => !r.unlocked).sort((a, b) => a.index - b.index)
}

/** First locked ring that could hold `spec` once it (and the rings before it) are open. */
export function ringWithRoom(office: OfficeState, spec: PlacementSpec): number | null {
  for (const r of lockedRings(office)) {
    const opened: OfficeState = { ...office, rings: office.rings.map((x) => (x.index <= r.index ? { ...x, unlocked: true } : x)) }
    const slot = findAutoSlotFor(opened, spec)
    if (slot) return slot.ring
  }
  return null
}

/** Where "Satın al" puts an item: the targeted slot when it fits, else the free slot nearest the center. */
export function shopPlacement(office: OfficeState, spec: PlacementSpec, target: Slot | undefined): ShopPlacement {
  if (target && canPlaceAt(office, target, spec)) return { slot: target, targeted: true, targetMisfit: false, roomRing: null }
  const slot = findAutoSlotFor(office, spec)
  const targetMisfit = target !== undefined
  if (slot) return { slot, targeted: false, targetMisfit, roomRing: null }
  return { slot: null, targeted: false, targetMisfit, nextRing: lockedRings(office)[0], roomRing: ringWithRoom(office, spec) }
}
