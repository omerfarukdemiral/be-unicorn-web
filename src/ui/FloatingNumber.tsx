// Floating number (docs/GAMEPLAY_V2.md §10.4): a finished founder action rises 700 ms above its slot ("+3 kullanıcı",
// "+$1.2K") instead of a strip line. At 4× actions finish back to back: the queue keeps the newest three.
// The number is the engine's (founderActionDone event value); the queue rules are pure (FloatingNumber.test.tsx).
import { useEffect, useState } from 'react'
import type { FounderActionKind, GameEvent } from '../engine/types'
import { t } from './i18n'
import { money, num } from './format'
import { cx } from './primitives'
import { useFreshEvents } from './loopUi'

/** Life of one floating number (ms). */
export const FLOAT_MS = 700
/** Numbers in the air at once (4× bursts drop the oldest). */
export const FLOAT_MAX = 3

export interface FloatItem {
  id: number
  kind: FounderActionKind
  text: string
  /** performance.now() when it took off. */
  at: number
}

/** "+3 kullanıcı", "+$1.2K", "−9 borç": the visible return of a finished action (null = nothing to count). */
export function floatText(kind: FounderActionKind, value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value) || value === 0) return null
  switch (kind) {
    case 'findUsers':
      return t('float.users', { v: num(value) })
    case 'salesCall':
      return t('float.mrr', { v: money(value) })
    case 'refactorSprint':
      return t('float.debt', { v: num(value) })
    default:
      return null
  }
}

/** Queue after `now`: drops what has landed (≥ FLOAT_MS old), then keeps the newest FLOAT_MAX. */
export function liveFloats(items: readonly FloatItem[], now: number): FloatItem[] {
  return items.filter((x) => now - x.at < FLOAT_MS).slice(-FLOAT_MAX)
}

/** Adds one number to the queue (expired ones go first, then the oldest over FLOAT_MAX). */
export function pushFloat(items: readonly FloatItem[], item: FloatItem, now: number): FloatItem[] {
  return liveFloats([...items, item], now)
}

let nextId = 1

/** Floating numbers of finished founder actions, fed from the engine events (a reload never replays them). */
export function useFloatingNumbers(): FloatItem[] {
  const [items, setItems] = useState<FloatItem[]>([])
  useFreshEvents((events: GameEvent[]) => {
    const now = performance.now()
    const fresh: FloatItem[] = []
    for (const e of events) {
      if (e.kind !== 'founderActionDone' || !e.refId) continue
      const kind = e.refId as FounderActionKind
      const text = floatText(kind, e.value)
      if (text) fresh.push({ id: nextId++, kind, text, at: now })
    }
    if (fresh.length) setItems((cur) => fresh.reduce((q, x) => pushFloat(q, x, now), cur))
  })
  // Clear the queue once the newest number has landed.
  const last = items[items.length - 1]
  useEffect(() => {
    if (!last) return
    const id = window.setTimeout(() => setItems((cur) => liveFloats(cur, performance.now())), Math.max(0, last.at + FLOAT_MS - performance.now()) + 16)
    return () => window.clearTimeout(id)
  }, [last])
  return items
}

/**
 * The numbers above one slot: absolutely placed over the slot's top edge, Oxanium, positive ink. Each rises and fades
 * in FLOAT_MS (the `rise-float` keyframe; reduced motion lands it at rest). Never takes pointer events.
 */
export function FloatingNumbers({ items, className }: { items: readonly FloatItem[]; className?: string }) {
  const shown = items.slice(-FLOAT_MAX)
  if (shown.length === 0) return null
  return (
    <span aria-hidden="true" className={cx('pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-10 flex -translate-x-1/2 flex-col-reverse items-center gap-0.5', className)}>
      {shown.map((x) => (
        <span
          key={x.id}
          data-float=""
          className="tabular animate-rise-float whitespace-nowrap rounded-full bg-surface px-1.5 text-[12px] font-bold leading-5 text-positive-ink shadow-card"
          style={{ animationDuration: `${FLOAT_MS}ms` }}
        >
          {x.text}
        </span>
      ))}
    </span>
  )
}
