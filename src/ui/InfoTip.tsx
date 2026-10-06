// ⓘ next to a label: the explanation that used to sit under the number. Hover opens it on a mouse (after a beat),
// a tap pins it open on touch; Esc, a tap outside or the ⓘ again closes it. The bubble is portalled to <body> and
// clamped to the viewport so it never clips inside the right panel's scroll box.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'

const WIDTH = 240
const GAP = 6
const MARGIN = 8
const HOVER_OPEN_MS = 120
const HOVER_CLOSE_MS = 140

const cx = (...p: (string | false | undefined)[]) => p.filter(Boolean).join(' ')

export interface InfoAction {
  label: string
  onClick: () => void
}

export function InfoTip({
  children,
  title,
  action,
  label = 'Bilgi',
  size = 14,
  className,
}: {
  /** The explanation: one or two short sentences. */
  children: ReactNode
  /** Optional bold head line inside the bubble. */
  title?: string
  /** Optional link at the bottom (e.g. open the concept card). */
  action?: InfoAction
  /** aria-label of the ⓘ button. */
  label?: string
  size?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const id = useId()

  const clear = () => window.clearTimeout(timer.current)
  const close = useCallback(() => {
    clear()
    setOpen(false)
    setPinned(false)
  }, [])

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const h = bubble.current?.offsetHeight ?? 80
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - WIDTH / 2), vw - WIDTH - MARGIN)
    const below = r.bottom + GAP
    const above = below + h > vh - MARGIN && r.top - GAP - h > MARGIN
    setPos({ left, top: above ? r.top - GAP - h : below, above })
  }, [open, children, title])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (btn.current?.contains(t) || bubble.current?.contains(t)) return
      close()
    }
    // Scrolling the panel would leave a fixed bubble floating over the wrong row.
    const onScroll = (e: Event) => {
      if (bubble.current?.contains(e.target as Node)) return
      close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close])

  useEffect(() => clear, [])

  const hoverIn = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || pinned) return
    clear()
    timer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_MS)
  }
  const hoverOut = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || pinned) return
    clear()
    timer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS)
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          // Rows that open something on click must not react to the ⓘ.
          e.stopPropagation()
          clear()
          if (pinned) close()
          else {
            setPinned(true)
            setOpen(true)
          }
        }}
        onPointerEnter={hoverIn}
        onPointerLeave={hoverOut}
        className={cx(
          'relative inline-grid shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:text-ink focus-visible:text-ink',
          // Bigger hit area than the glyph, without moving the layout.
          'before:absolute before:-inset-2 before:content-[""]',
          open && 'text-ink',
          className,
        )}
      >
        <Icon name="info" size={size} />
      </button>
      {open &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            onPointerEnter={hoverIn}
            onPointerLeave={hoverOut}
            className="animate-fade-in fixed z-[70] rounded-control border border-border bg-surface px-3 py-2.5 text-ink shadow-card"
            style={{ width: WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
          >
            {title && <div className="mb-1 text-[13px] font-semibold leading-tight">{title}</div>}
            <div className="font-text text-[13px] leading-snug text-ink-2">{children}</div>
            {action && (
              <button
                type="button"
                onClick={() => {
                  close()
                  action.onClick()
                }}
                className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-brand-ink hover:underline"
              >
                {action.label}
                <Icon name="chevronRight" size={12} />
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
