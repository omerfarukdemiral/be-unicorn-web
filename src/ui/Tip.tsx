// One tooltip for every non-button number of the HUD (P5 "ne neye yol açar"): what it is, what raises it, what lowers
// it, and the live main source when it is cheap. PC: hover opens after a beat, leaving closes. Phone: a tap toggles,
// a tap elsewhere closes. The bubble never takes pointer events, so it never blocks a click under it. One bubble at a
// time; a nested tip (the burn pill inside Kasa) wins over its parent. `hintTip(id)` opens a tip by itself for a few
// seconds (first-run hints, ui/firstHints.ts).
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'
import { cx } from './primitives'

export const TIP_WIDTH = 248
const GAP = 8
const MARGIN = 8
const HOVER_OPEN_MS = 180

/** The words of a tip. Every line optional except the name; one line each, house tone. */
export interface TipContent {
  /** What it is (2–4 words). */
  name: string
  /** The value spelled out, when the HUD shows it short ("Kasada $16K, maaşa ayrılan $2K"). */
  value?: string
  /** What raises it. */
  up?: string
  /** What lowers it. */
  down?: string
  /** The live main source ("En çok: maaşlar −$1.2K/ay"). */
  live?: string
  /** A warning that applies right now (red). */
  alert?: string
}

/** The bubble's inside: name, value, ↑ / ↓ lines, the live source. Also used by InfoTip-like callers. */
export function TipBody({ name, value, up, down, live, alert }: TipContent) {
  return (
    <>
      <div className="text-[13px] font-semibold leading-tight text-ink">{name}</div>
      {value && <div className="tabular mt-0.5 text-[12px] font-medium leading-snug text-ink-2">{value}</div>}
      {(up || down) && (
        <div className="mt-1.5 flex flex-col gap-1">
          {up && (
            <div className="flex items-start gap-1.5 text-[12.5px] leading-snug text-ink-2">
              <Icon name="arrowUp" size={13} className="mt-[2px] shrink-0 text-positive-ink" />
              <span>{up}</span>
            </div>
          )}
          {down && (
            <div className="flex items-start gap-1.5 text-[12.5px] leading-snug text-ink-2">
              <Icon name="arrowUp" size={13} className="mt-[2px] shrink-0 rotate-180 text-negative-ink" />
              <span>{down}</span>
            </div>
          )}
        </div>
      )}
      {live && <div className="tabular mt-1.5 border-t border-border pt-1.5 text-[12px] font-semibold leading-snug text-ink">{live}</div>}
      {alert && <div className="mt-1 text-[12px] font-semibold leading-snug text-negative-ink">{alert}</div>}
    </>
  )
}

// ---------------------------------------------------------------------------
// One open at a time + the hint registry
// ---------------------------------------------------------------------------

let closeCurrent: (() => void) | null = null
const registry = new Map<string, Set<{ el: () => HTMLElement | null; show: (ms: number) => void }>>()

/** Opens the tip `id` on its own for `ms` (first-run hints). False when no such tip is on screen. */
export function hintTip(id: string, ms = 3000): boolean {
  for (const r of registry.get(id) ?? []) {
    const el = r.el()
    // Only a tip that is actually drawn (not display:none, not off a closed panel).
    if (el && el.getClientRects().length > 0) {
      r.show(ms)
      return true
    }
  }
  return false
}

/** Test hook: is any tip open right now? */
export function tipOpen(): boolean {
  return closeCurrent !== null
}

type Mode = 'hover' | 'pinned' | 'hint'

/**
 * Wraps one non-button HUD element. `content` is a component (rendered only while open, so its live numbers cost
 * nothing until asked for) or a fixed TipContent.
 */
export function Tip({
  id,
  content,
  children,
  className,
  block = false,
  ariaLabel,
  hoverOnly = false,
}: {
  /** Hint id (hintTip). */
  id?: string
  content: ComponentType | TipContent
  children: ReactNode
  className?: string
  /** A div (block / flex children) instead of an inline span. */
  block?: boolean
  ariaLabel?: string
  /** Around a button: hover only, a tap is the button's (it opens the full card). */
  hoverOnly?: boolean
}) {
  const [mode, setMode] = useState<Mode | null>(null)
  const ref = useRef<HTMLElement | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const pointer = useRef<string>('mouse')
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const tipId = useId()

  const close = useCallback(() => {
    window.clearTimeout(timer.current)
    setMode(null)
  }, [])

  const show = useCallback(
    (m: Mode) => {
      if (closeCurrent && closeCurrent !== close) closeCurrent()
      closeCurrent = close
      setMode(m)
    },
    [close],
  )

  useEffect(() => {
    if (mode === null && closeCurrent === close) closeCurrent = null
  }, [mode, close])
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (closeCurrent === close) closeCurrent = null
    },
    [close],
  )

  // Hint registry.
  useEffect(() => {
    if (!id) return
    const entry = {
      el: () => ref.current,
      show: (ms: number) => {
        show('hint')
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setMode((m) => (m === 'hint' ? null : m)), ms)
      },
    }
    let set = registry.get(id)
    if (!set) registry.set(id, (set = new Set()))
    set.add(entry)
    return () => {
      set.delete(entry)
    }
  }, [id, show])

  const open = mode !== null

  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const h = bubble.current?.offsetHeight ?? 100
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - TIP_WIDTH / 2), vw - TIP_WIDTH - MARGIN)
    // Lower half of the screen (the money island, the founder bar): above; otherwise below.
    const above = r.top + r.height / 2 > vh / 2 ? r.top - GAP - h > MARGIN : r.bottom + GAP + h > vh - MARGIN
    setPos({ left, top: above ? r.top - GAP - h : r.bottom + GAP })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      close()
    }
    const onScroll = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close])

  /** True when the event's element belongs to this tip, not to a tip nested inside it. */
  const own = (t: EventTarget | null) => t instanceof Element && t.closest('[data-tip]') === ref.current

  const onPointerOver = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    if (!own(e.target)) {
      // Over a nested tip: it speaks, this one waits.
      window.clearTimeout(timer.current)
      if (mode === 'hover') setMode(null)
      return
    }
    if (mode === 'hover' || mode === 'pinned') return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => show('hover'), HOVER_OPEN_MS)
  }
  const onPointerLeave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(timer.current)
    if (mode === 'hover' || mode === 'hint') setMode(null)
  }
  const onClick = (e: ReactMouseEvent) => {
    // A tap (touch / pen) toggles; a mouse already has hover. Clicks still reach whatever is under the finger.
    if (hoverOnly || pointer.current === 'mouse' || !own(e.target)) return
    if (mode === 'pinned' || mode === 'hint') close()
    else show('pinned')
  }

  const Body = typeof content === 'function' ? content : null
  const Tag = block ? 'div' : 'span'
  return (
    <>
      <Tag
        ref={ref as never}
        data-tip={id ?? ''}
        aria-label={ariaLabel}
        aria-describedby={open ? tipId : undefined}
        onPointerDown={(e: ReactPointerEvent) => (pointer.current = e.pointerType)}
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        className={cx(block ? undefined : 'inline-flex', className)}
      >
        {children}
      </Tag>
      {open &&
        createPortal(
          <div
            ref={bubble}
            id={tipId}
            role="tooltip"
            data-tip-bubble={id ?? ''}
            className="ui-card animate-fade-in pointer-events-none fixed z-[70] px-3 py-2.5"
            style={{ width: TIP_WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
          >
            {Body ? <Body /> : <TipBody {...(content as TipContent)} />}
          </div>,
          document.body,
        )}
    </>
  )
}
