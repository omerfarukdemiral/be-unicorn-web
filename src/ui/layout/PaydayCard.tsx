// Payday card (T09, Two Point "Monthly Profit"): on each payday a small tilted card pops out of the money island,
// "Maaş günü · 6 kişi / −$7.3K / Kasa $215.5K → $208.2K", while the hero Kasa counts down (its own tween). It is the
// desktop home of the month receipt (the message pill no longer repeats it, NotificationStrip `island`) and leaves
// on its own after CARD_MS; a click dismisses it early. A month cash cannot cover still opens the payday desk.
import { useEffect, useState } from 'react'
import type { MonthReceipt } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { money } from '../format'
import { Icon } from '../icons'
import { t } from '../i18n'
import { heldText, useMomentSource } from '../Moments'
import { soft, WIDGET_COLOR } from '../theme'
import { ledgerMoney } from '../widgets'

const CARD_MS = 2800

export function PaydayCard() {
  const [receipt, setReceipt] = useState<{ key: number; r: MonthReceipt } | null>(null)
  const people = useGameStore((s) => s.state.employees.length)
  useMomentSource((ms) => {
    const m = [...ms].reverse().find((x) => x.kind === 'receipt')
    if (m?.kind === 'receipt') setReceipt({ key: m.key, r: m.receipt })
  })
  useEffect(() => {
    if (!receipt) return
    const id = window.setTimeout(() => setReceipt(null), CARD_MS)
    return () => window.clearTimeout(id)
  }, [receipt])
  if (!receipt) return null
  const r = receipt.r
  const color = WIDGET_COLOR.burnBreakdown
  const held = heldText(r)
  return (
    <button
      key={receipt.key}
      type="button"
      data-payday-card=""
      onClick={() => setReceipt(null)}
      role="status"
      className="ui-card pointer-events-auto absolute bottom-[calc(100%+10px)] left-3 z-10 w-[250px] origin-bottom-left -rotate-[1.5deg] animate-pop-in overflow-hidden px-3.5 pb-3 pt-3.5 text-left"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <span className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: soft(color, 16) }}>
          <Icon name="cash" tone={color} size={20} />
        </span>
        <span className="min-w-0">
          <span className="ui-label block text-ink-2">{people > 0 ? t('top.paydayCard', { n: people }) : t('top.paydayCardSolo')}</span>
          <span className="ui-num block text-[26px] leading-[30px] text-ink">−{money(r.paid)}</span>
        </span>
      </span>
      <span className="mt-1.5 block text-[12px] text-ink-2">
        {t('top.paydayCardCash', { v: ledgerMoney(r.cashAfter + r.paid) })} → <b className="font-semibold text-ink">{ledgerMoney(r.cashAfter)}</b>
      </span>
      {held && <span className="mt-1 block text-[12px] font-semibold text-negative-ink">{held}</span>}
    </button>
  )
}
