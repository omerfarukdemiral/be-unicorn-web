// Round 6 (strategy freedom): a big or irreversible chip move never acts on its own. The tap opens the place where it
// lives and marks the item there ("Rakip al" → the rival in the market, "Kural imzala" → the law), so the player
// confirms with the place's own button. A tiny external store: the panel row reads whether it is the marked one.
import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'

/** How long the mark stays on the item (ms). */
export const CHIP_MARK_MS = 6000

let target: { key: string; at: number } | null = null
const subs = new Set<() => void>()

export function markChipTarget(key: string | null): void {
  target = key ? { key, at: Date.now() } : null
  for (const f of subs) f()
  if (key && typeof window !== 'undefined') window.setTimeout(() => {
    if (target?.key === key && Date.now() - target.at >= CHIP_MARK_MS - 50) markChipTarget(null)
  }, CHIP_MARK_MS)
}

export const chipTarget = (): string | null => target?.key ?? null

function subscribe(f: () => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}

const SCROLL_TRIES = [30, 250, 600, 1000]

/** Fully inside its scroll box and the window (a phone sheet's box ends above the tab island). */
export function inView(el: Element): boolean {
  const r = el.getBoundingClientRect()
  if (r.height <= 0) return false
  let top = 0
  let bottom = window.innerHeight
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') {
      const b = p.getBoundingClientRect()
      top = Math.max(top, b.top)
      bottom = Math.min(bottom, b.bottom)
      break
    }
  }
  return r.top >= top && r.bottom <= bottom
}

/** The row marked by the chip: a ref that scrolls it into view once, and the ring class while it is marked. */
export function useChipMark<T extends HTMLElement>(key: string): { ref: RefObject<T | null>; marked: boolean; markClass: string } {
  const marked = useSyncExternalStore(subscribe, () => chipTarget() === key, () => chipTarget() === key)
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!marked) return
    // Round 8: the panel is still sliding / fading in when the row mounts, so one early scroll can land short (the new
    // product tile stayed below the fold). Retry for ~1 s until the row sits inside the viewport.
    const ids = SCROLL_TRIES.map((ms) =>
      window.setTimeout(() => {
        const el = ref.current
        if (el && !inView(el)) el.scrollIntoView?.({ block: 'center', behavior: 'auto' })
      }, ms),
    )
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [marked])
  return { ref, marked, markClass: marked ? 'ring-2 ring-brand ring-offset-1 animate-attention' : '' }
}

/** The marked key right now (a place that must also select its marked item, e.g. the law book's open card). */
export function useChipTargetKey(): string | null {
  return useSyncExternalStore(subscribe, chipTarget, chipTarget)
}
