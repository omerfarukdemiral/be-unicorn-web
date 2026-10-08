// Payday desk (docs/GAMEPLAY_V2.md §6.1, §10.6, "Papers Please masası"): the month cash cannot cover, line by line.
// Each line has its answer segment (öde / yarı / ertele; ads öde / kes), the picked answer's price as icon + number,
// and the bottom shows cash and debt after, the interest of deferring and the bankruptcy clock when it would start.
// One commit "Onayla" (resolvePayday), one routine "Sonra" (closes; time flows and the horizon counts the days down).
// While open it holds time (the store's `payday` pause) and shows no countdown: a clock that does not move is noise.
// Numbers come from paydayView() (the engine's own answer on a copy); this file only lays them out.
// The desk docks into the right panel's slot (OverlayFrame place="dock"), so "one right panel" still holds: on desktop
// it slides in from the panel edge, on portrait it rises above the bottom tabs. The body is one continuous receipt.
import { useEffect, useMemo, useState } from 'react'
import { autoPaydayChoice, type PaydayChoice } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Button, Chip, cx, IconBadge, Segmented, Stat } from '../primitives'
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

// Receipt row: a dashed tear line between entries, no tinted box (the card is the paper).
const ROW = 'flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b-2 border-dashed border-border py-2.5 last:border-0'
// Dotted leader between the name and the amount, as on a printed receipt.
const LEADER = 'mb-1 min-w-4 flex-1 border-b-2 border-dotted border-border-strong'

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

  // The head owns the dialog's name (h2#payday-title); the frame draws no title of its own when `head` is set.
  const head = (
    <div data-payday-desk="" className="flex flex-col gap-1 px-5 pt-4 sm:px-6">
      <div className="flex items-center gap-2">
        <IconBadge icon="cash" size={28} color="var(--color-g-burn)" />
        <h2 id="payday-title" className="min-w-0 flex-1 text-[17px] font-extrabold text-ink">
          {t('desk.title')}
        </h2>
      </div>
      {/* The one red on the desk: the shortfall is real danger. */}
      <span className="tabular text-[28px] font-extrabold leading-none text-negative-ink">{t('desk.short', { v: `−${money(short)}` })}</span>
      <p className="font-text text-xs text-ink-2">{t('desk.line')}</p>
    </div>
  )

  const actions = (
    <div className="flex flex-col gap-2">
      <div className="ui-inset grid grid-cols-2 gap-2 p-3">
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
        <div data-clock="" className="inline-flex items-center gap-1 text-xs font-semibold text-negative-ink">
          <Icon name="timer" size={14} />
          {t('desk.clock')}
        </div>
      )}
      <div className="flex gap-2">
        <Button tone="routine" size="md" onClick={onClose}>
          {t('desk.later')}
        </Button>
        <Button tone="commit" icon="check" className="flex-1" onClick={confirm} autoFocus>
          {t('desk.confirm')}
        </Button>
      </div>
    </div>
  )

  return (
    // "Sonra" on Escape (OverlayFrame): the desk never traps the player. The veil never closes it.
    <OverlayFrame place="dock" mood="desk" labelledBy="payday-title" onClose={onClose} head={head} actions={actions}>
      <ul className="flex flex-col">
        {v.rows.map((r) => (
          <DeskRow key={r.line} row={r} onPick={(x) => pick(r.line, x)} />
        ))}
        {v.oldDebt > 0.5 && (
          <li className={ROW}>
            <Icon name="hourglass" size={16} className="shrink-0 text-ink-2" />
            <span className="ui-label min-w-0 truncate">{t('desk.old')}</span>
            <span aria-hidden="true" className={LEADER} />
            <span className="tabular text-[15px] font-extrabold text-ink">{money(v.oldDebt)}</span>
            <span className="tabular inline-flex w-full items-center gap-1 text-[12px] font-semibold text-ink-2">
              <Icon name="coin" size={13} />
              {t('desk.cost.interest', { v: pct(v.interest) })}
            </span>
          </li>
        )}
      </ul>
    </OverlayFrame>
  )
}

/** One receipt line: icon, name, dotted leader, the month's amount; below it the answer segment and the picked answer's price. */
function DeskRow({ row, onPick }: { row: PaydayRow; onPick: (value: string) => void }) {
  const cost = row.cost ? costLook(row.cost) : null
  const due = row.amount > 0.5
  return (
    <li data-line={row.line} className={ROW}>
      <Icon name={LINE_ICON[row.line]} size={16} className="shrink-0 text-ink-2" />
      <span className="ui-label min-w-0 truncate">{t(`burn.${row.line}`)}</span>
      <span aria-hidden="true" className={LEADER} />
      <span className={cx('tabular text-[15px] font-extrabold', due ? 'text-ink' : 'text-ink-3')}>{money(row.amount)}</span>
      {/* A $0 line is a receipt line, not a question: no answer segment (its default pick stands). */}
      {due && (
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
      )}
    </li>
  )
}
