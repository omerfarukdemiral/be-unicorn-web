// Bottom bar, left part (docs/LAYOUT.md §1.2, docs/GAMEPLAY_V2.md §10.4): founder energy, the week's moves (from
// Pre-seed, "3/4") and the ability slots: 44px squares, icon only, the name in the tooltip; locked actions are grey
// silhouettes with their stage pill. A finished action's return rises above its slot (FloatingNumber, ≤ 3 at once).
// Phone / landscape phone: the same slots, energy and moves as numbers stacked in one narrow column (portrait), the slot
// size picked from the row's measured room so the whole row fits at 390 (fix round F6); narrower phones scroll sideways.
import { useEffect, useRef, useState, type RefObject } from 'react'
import { t } from '../i18n'
import { cx } from '../primitives'
import { EnergyMeter, FounderSlot, MovesMeter, PEEK_MS, SLOT, useFounderActions, type FounderActionView } from '../FounderActions'
import { FloatingNumbers, useFloatingNumbers } from '../FloatingNumber'
import { dockFits, slotSizeForRoom } from './dockFit'

/** The phone row scrolls sideways: a soft right-edge fade while more slots sit past the edge (QA 390px: the bed slot was cut with no hint). */
function useMoreRight(count: number): [RefObject<HTMLDivElement | null>, boolean, () => void, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  // The row's own width (it is flex-1, so this is the room it has, whatever the slots ask for).
  const [room, setRoom] = useState(0)
  const check = () => {
    const el = ref.current
    if (!el) return
    setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 2)
    setRoom(el.clientWidth)
  }
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    for (const c of el.children) ro.observe(c)
    check()
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-observe when the slot count changes
  }, [count])
  return [ref, more, check, room]
}

/** One slot wide (44px): a 28px fade on cream keys read as clipping, not as "the row scrolls" (QA). */
const FADE_RIGHT = 'linear-gradient(to right, black calc(100% - 44px), transparent)'

export function FounderBar({ variant, trim = false, className }: { variant: 'bar' | 'mobile'; trim?: boolean; className?: string }) {
  const { energy, low, moves, day, actions } = useFounderActions()
  const floats = useFloatingNumbers()
  const mobile = variant === 'mobile'
  const [peek, setPeek] = useState<FounderActionView | null>(null)
  useEffect(() => {
    if (!peek) return
    const id = window.setTimeout(() => setPeek(null), PEEK_MS)
    return () => window.clearTimeout(id)
  }, [peek])
  // Phones keep the row short: open slots + the next silhouette only; a narrow desktop (`trim`) the open slots only.
  const firstLocked = actions.findIndex((a) => a.locked)
  const shown = trim ? actions.filter((a) => !a.locked) : mobile ? actions.filter((a, i) => !a.locked || i === firstLocked) : actions
  const [row, moreRight, onScroll, room] = useMoreRight(shown.length)
  const size = mobile ? (room > 0 ? slotSizeForRoom(shown.length, room) : undefined) : undefined
  // Fits = no scroll: the row drops its clip (and the 4px inset that kept the first slot's badge inside it).
  const fits = mobile && room > 0 && dockFits(shown.length, size ?? SLOT, room)
  // Phone with the week's moves: energy over moves in one column, no divider (side by side they took a slot's width).
  const stack = mobile && !!moves
  return (
    <div role="group" aria-label={t('bottom.actions')} className={cx('relative flex min-w-0 items-center', mobile ? 'gap-1' : 'gap-2', className)}>
      {/* The phone row scrolls sideways (it would clip a number above a slot): there they rise over the row. */}
      {mobile && <FloatingNumbers items={floats} />}
      {mobile && peek && (
        <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] right-0 z-20 flex animate-pop-in flex-col gap-0.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-on-ink shadow-pop">
          <span>{peek.name} · {peek.stageName}</span>
          {peek.tip && <span className="font-medium opacity-80">{peek.tip}</span>}
        </span>
      )}
      {stack && moves ? (
        <div className="flex shrink-0 flex-col items-start gap-0.5 leading-none">
          <EnergyMeter energy={energy} low={low} compact />
          <MovesMeter moves={moves} day={day} compact />
        </div>
      ) : (
        <>
          <EnergyMeter energy={energy} low={low} compact={mobile || !!moves} />
          {moves && <MovesMeter moves={moves} day={day} compact={mobile} />}
        </>
      )}
      {!stack && <span aria-hidden="true" className={cx('h-6 w-px shrink-0 bg-border', mobile && 'mx-0.5')} />}
      <div
        ref={mobile ? row : undefined}
        onScroll={mobile ? onScroll : undefined}
        // Phones: the scroll row clips both axes, so it keeps 4px inside for the saturation badge that sits on the first
        // slot's corner ("¼" was cut to a half-moon); -my-1 gives the height back.
        className={cx('flex min-w-0 items-center gap-1', mobile && 'flex-1', mobile && (fits ? 'justify-center' : 'ui-scroll -my-1 snap-x overflow-x-auto py-1 pl-1'))}
        // .ui-scroll says pan-y (vertical lists): this row must take sideways touch drags too.
        style={mobile ? { touchAction: 'pan-x pan-y', ...(moreRight && !fits ? { maskImage: FADE_RIGHT, WebkitMaskImage: FADE_RIGHT } : null) } : undefined}
      >
        {shown.map((a, i) => (
          <FounderSlot
            key={a.kind}
            a={a}
            tipAlign={i < 2 ? 'left' : 'center'}
            floats={mobile ? undefined : <FloatingNumbers items={floats.filter((x) => x.kind === a.kind)} />}
            onPeek={mobile ? setPeek : undefined}
            size={size}
          />
        ))}
      </div>
    </div>
  )
}
