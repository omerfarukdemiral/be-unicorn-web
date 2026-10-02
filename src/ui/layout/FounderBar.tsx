// Bottom bar, left part (docs/LAYOUT.md §1.2, docs/GAMEPLAY_V2.md §10.4): founder energy, the week's moves (from
// Pre-seed, "3/4") and the ability slots: 44px squares, icon only, the name in the tooltip; locked actions are grey
// silhouettes with their stage pill. A finished action's return rises above its slot (FloatingNumber, ≤ 3 at once).
// Phone / landscape phone: the same slots in a sideways-scrolling row, energy and moves as numbers.
import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { cx } from '../primitives'
import { EnergyMeter, FounderSlot, MovesMeter, PEEK_MS, useFounderActions, type FounderActionView } from '../FounderActions'
import { FloatingNumbers, useFloatingNumbers } from '../FloatingNumber'

export function FounderBar({ variant, className }: { variant: 'bar' | 'mobile'; className?: string }) {
  const { energy, low, moves, day, actions } = useFounderActions()
  const floats = useFloatingNumbers()
  const mobile = variant === 'mobile'
  const [peek, setPeek] = useState<FounderActionView | null>(null)
  useEffect(() => {
    if (!peek) return
    const id = window.setTimeout(() => setPeek(null), PEEK_MS)
    return () => window.clearTimeout(id)
  }, [peek])
  // Phones keep the row short: open slots + the next silhouette only.
  const firstLocked = actions.findIndex((a) => a.locked)
  const shown = mobile ? actions.filter((a, i) => !a.locked || i === firstLocked) : actions
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
      <EnergyMeter energy={energy} low={low} compact={mobile || !!moves} />
      {moves && <MovesMeter moves={moves} day={day} compact={mobile} />}
      <span aria-hidden="true" className={cx('h-6 w-px shrink-0 bg-border', mobile && 'mx-0.5')} />
      <div className={cx('flex min-w-0 items-center gap-1', mobile && 'ui-scroll overflow-x-auto')}>
        {shown.map((a, i) => (
          <FounderSlot
            key={a.kind}
            a={a}
            tipAlign={i < 2 ? 'left' : 'center'}
            floats={mobile ? undefined : <FloatingNumbers items={floats.filter((x) => x.kind === a.kind)} />}
            onPeek={mobile ? setPeek : undefined}
          />
        ))}
      </div>
    </div>
  )
}
