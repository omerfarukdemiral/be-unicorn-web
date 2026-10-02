// Payday desk (docs/GAMEPLAY_V2.md §6.1, §10.6, "Papers Please masası"): the month cash cannot cover, line by line.
// Each line has its answer segment (öde / yarı / ertele; ads öde / kes), the picked answer's price as icon + number,
// and the bottom shows cash and debt after, the interest of deferring and the bankruptcy clock when it would start.
// One commit "Onayla" (resolvePayday), one routine "Sonra" (closes; time flows and the horizon counts the days down).
// While open it holds time (the store's `payday` pause) and shows no countdown: a clock that does not move is noise.
// Numbers come from paydayView() (the engine's own answer on a copy); this file only lays them out.
// Desktop: centered card; phones: a full-screen sheet.
import { useEffect, useMemo, useState } from 'react'
import { autoPaydayChoice, type PaydayChoice } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Button, Chip, cx, Pill, Segmented, Stat } from '../primitives'
import { OverlayFrame } from './OverlayFrame'
import { paydayView, type PaydayCost, type PaydayLine, type PaydayRow } from './paydayView'

const LINE_ICON: Record<PaydayLine, IconName> = { salaries: 'users', infra: 'cloud', rent: 'building', founder: 'coffee', ads: 'megaphone' }

function costLook(c: PaydayCost): { icon: IconName; text: string } {
  switch (c.kind) {
    case 'morale':
      return { icon: 'heart', text: t('desk.cost.morale', { v: `−${-c.value}` }) }
    case 'capacity':
      return { icon: 'cloud', text: t('desk.cost.capacity', { v: fixed(c.value, 1) }) }
    case 'rent':
      return { icon: 'building', text: t('desk.cost.rent', { n: c.n, max: c.max }) }
    case 'energy':
      return { icon: 'bolt', text: t('desk.cost.energy', { v: `−${-c.value}` }) }
    case 'ads':
      return { icon: 'megaphone', text: t('desk.cost.ads') }
  }
}

export function PaydayOverlay({ onClose }: { onClose: () => void }) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const pending = state.finance.pendingPayday
  // The default order (what an unanswered desk would do) is the starting answer; it resets for a new month.
  const [choice, setChoice] = useState<PaydayChoice>(() => autoPaydayChoice(state))
  const pendingDay = pending?.day
  useEffect(() => {
    if (pendingDay !== undefined) setChoice(autoPaydayChoice(useGameStore.getState().state))
  }, [pendingDay])
  const v = useMemo(() => paydayView(state, choice), [state, choice])
  const short = state.derived.horizon?.find((h) => h.kind === 'payday' && h.due)?.amount ?? 0

  if (!v) return null
  const pick = (line: PaydayLine, value: string) => setChoice((c) => ({ ...c, [line]: value }) as PaydayChoice)
  const confirm = () => {
    if (dispatch({ type: 'resolvePayday', choice }).ok) onClose()
  }

  return (
    // "Sonra" on Escape (OverlayFrame): the desk never traps the player.
    <OverlayFrame sheet labelledBy="payday-title" onClose={onClose}>
      <div data-payday-desk="" className="flex min-h-0 flex-1 flex-col">
        <div aria-hidden="true" className="h-[3px] w-full shrink-0 bg-negative" />
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3">
          <Icon name="cash" size={20} className="shrink-0 text-ink-2" />
          <h2 id="payday-title" className="min-w-0 flex-1 truncate text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
            {t('desk.title')}
          </h2>
          <span className="tabular text-[22px] font-semibold leading-none text-negative-ink">{t('desk.short', { v: `−${money(short)}` })}</span>
        </header>
        <p className="font-text shrink-0 px-4 pt-1 text-xs text-ink-2">{t('desk.line')}</p>

        <div className="ui-scroll min-h-0 flex-1 px-4 py-3">
          <ul className="flex flex-col gap-1">
            {v.rows.map((r) => (
              <DeskRow key={r.line} row={r} onPick={(x) => pick(r.line, x)} />
            ))}
            {v.oldDebt > 0.5 && (
              <li className="flex min-h-9 items-center gap-2 rounded-control bg-surface-2/60 px-2 py-1">
                <Icon name="hourglass" size={16} className="shrink-0 text-ink-2" />
                <span className="ui-label min-w-0 flex-1 truncate">{t('desk.old')}</span>
                <span className="tabular text-[15px] font-semibold text-ink">{money(v.oldDebt)}</span>
                <Pill className="tabular shrink-0">{t('desk.cost.interest', { v: pct(v.interest) })}</Pill>
              </li>
            )}
          </ul>
        </div>

        <footer className="shrink-0 border-t border-border px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('desk.cashAfter')} icon="cash" color="var(--color-g-cash)" value={<span className={v.cashAfter < 0 ? 'text-negative-ink' : undefined}>{money(v.cashAfter)}</span>} />
            <Stat
              label={t('desk.owedAfter')}
              icon="hourglass"
              color="var(--color-g-burn)"
              value={money(v.owedAfter)}
              sub={v.owedAfter > 0.5 ? <span className="inline-flex items-center gap-1"><Icon name="coin" size={11} />{t('desk.cost.interest', { v: pct(v.interest) })}</span> : undefined}
            />
          </div>
          {v.clock && (
            <div data-clock="" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-negative-ink">
              <Icon name="timer" size={14} />
              {t('desk.clock')}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <Button tone="routine" size="md" onClick={onClose}>
              {t('desk.later')}
            </Button>
            <Button tone="commit" icon="check" className="flex-1" onClick={confirm} autoFocus>
              {t('desk.confirm')}
            </Button>
          </div>
        </footer>
      </div>
    </OverlayFrame>
  )
}

/** One receipt line: icon, name, the month's amount, the answer segment, the picked answer's price. */
function DeskRow({ row, onPick }: { row: PaydayRow; onPick: (value: string) => void }) {
  const cost = row.cost ? costLook(row.cost) : null
  return (
    <li data-line={row.line} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-surface-2/60 px-2 py-1">
      <Icon name={LINE_ICON[row.line]} size={16} className="shrink-0 text-ink-2" />
      <span className="ui-label min-w-0 flex-1 truncate">{t(`burn.${row.line}`)}</span>
      <span className={cx('tabular text-[15px] font-semibold', row.amount > 0.5 ? 'text-ink' : 'text-ink-3')}>{money(row.amount)}</span>
      <div className="flex w-full items-center justify-between gap-2">
        <Segmented label={t(`burn.${row.line}`)}>
          {row.options.map((o) => (
            <Chip key={o} segment active={row.pick === o} onClick={() => onPick(o)}>
              {t(`desk.opt.${o}`)}
            </Chip>
          ))}
        </Segmented>
        {cost && (
          <span className="tabular inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-energy-ink">
            <Icon name={cost.icon} size={13} />
            {cost.text}
          </span>
        )}
      </div>
    </li>
  )
}
