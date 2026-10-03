// Renewals in Büyüme (docs/GAMEPLAY_V2.md §8.4, §10.5): each key account up for renewal is one row: name, MRR, days
// left, and two commits: "Zam iste" (the engine's success chance as a number, MRR × 1.1 if it holds, gone if not) and
// "İndirim ver" (MRR × 0.85 for sure). Each carries its CostPreview (the MRR change as burn); the hold also shows its
// downside (the contract gone) under its own. One move each (§7.1).
// Hidden while nothing is due (derived.renewals).
import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { money, pct } from '../format'
import { Button, CostPreview, Pill, SectionTitle } from '../primitives'
import { useSpendPreview } from '../widgets'
import { renewalRows, type RenewalRow } from '../center/centerData'

export function RenewalSection() {
  // The view is rebuilt every step: the rows only re-render when one of their numbers moves.
  const key = useGameStore((s) => JSON.stringify(renewalRows(s.state.derived.renewals, s.state.time.day)))
  const rows = useMemo(() => JSON.parse(key) as RenewalRow[], [key])
  if (rows.length === 0) return null
  return (
    <section data-renewals={rows.length}>
      <SectionTitle right={<span className="tabular text-[15px] font-semibold text-ink">{rows.length}</span>}>{t('renew.title')}</SectionTitle>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <Renewal key={r.id} r={r} />
        ))}
      </ul>
    </section>
  )
}

function Renewal({ r }: { r: RenewalRow }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const hold = useSpendPreview(0, r.holdBurn)
  const fail = useSpendPreview(0, r.failBurn)
  const discount = useSpendPreview(0, r.discountBurn)
  const err = r.error ? t(`error.${r.error}`) : undefined
  return (
    <li data-renewal={r.id} className="flex flex-col gap-1.5 rounded-control bg-surface-2/60 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.name}</span>
        <span className="tabular text-xs font-semibold text-ink">{t('hud.perMonthPlain', { v: money(r.mrr) })}</span>
        <Pill className="tabular text-ink">{t('renew.days', { d: r.days })}</Pill>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex min-w-0 flex-col items-stretch gap-1">
          <Button tone="commit" size="sm" disabled={!!r.error} onClick={() => dispatch({ type: 'renewContract', id: r.id, offer: 'hold' })} cost={err ?? t('renew.chance', { p: pct(r.holdChance) })}>
            {t('renew.hold')}
          </Button>
          <CostPreview preview={hold} cost={money(r.holdMrr)} className="justify-center" />
          <CostPreview preview={fail} cost={t('renew.fail', { p: pct(1 - r.holdChance) })} className="justify-center" />
        </div>
        <div className="flex min-w-0 flex-col items-stretch gap-1">
          <Button tone="commit" size="sm" disabled={!!r.error} onClick={() => dispatch({ type: 'renewContract', id: r.id, offer: 'discount' })} cost={err}>
            {t('renew.discount')}
          </Button>
          <CostPreview preview={discount} cost={money(r.discountMrr)} className="justify-center" />
        </div>
      </div>
    </li>
  )
}
