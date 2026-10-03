// Büyüme: funding round, product health, channels (ad budget steps), price steps, enterprise + renewals, and one-line
// rows to the center screens (Pazar haritası, Kanun Kitabı) with the Kurul row under them. HUD grammar (GAMEPLAY V2 §10.5): no sliders, every step is a
// button with its CostPreview; the big surfaces open in the middle (CenterFrame), not stacked in this drawer.
// Stage goals (☆) live in Kazanımlar (JournalPanel).
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { adBudgetSteps, nearestPriceStep, PRICE_STEPS } from '../../engine'
import type { ToolId } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Bar, Chip, CostPreview, cx, Dot, Empty, LockedHint, SectionTitle, Segmented, Stat } from '../primitives'
import { iconTone, WIDGET_COLOR } from '../theme'
import { Icon, type IconName } from '../icons'
import { useSpendPreview } from '../widgets'
import { centerSummary } from '../center/centerData'
import { RoundSection } from './RoundSection'
import { DecisionOutcomes, ValuationParts } from './GoalsCard'
import { BoardRow } from './BoardRow'
import { RenewalSection } from './RenewalSection'
import { priceGate } from '../loopUi'
import { openConceptCard } from '../uiActions'

function useTool(id: ToolId): boolean {
  return useGameStore((s) => s.state.unlockedTools.includes(id))
}

export function GrowthPanel({ section }: { section?: 'round' }) {
  const showRound = useGameStore((s) => s.state.derived.canStartRound || !!s.state.round?.active || s.state.stage > 0)
  // Opened from the HUD round button: bring the round block into view.
  useEffect(() => {
    if (section === 'round') document.getElementById('round-section')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [section])
  return (
    <div className="flex flex-col gap-5">
      {(showRound || section === 'round') && <RoundSection setup={section === 'round'} />}
      <ProductSection />
      <CenterRows />
      <DecisionOutcomes />
      <ChannelSection />
      <PriceSection />
      <EnterpriseSection />
      <RenewalSection />
    </div>
  )
}

function ProductSection() {
  const d = useGameStore(
    useShallow((s) => ({
      avg: s.state.derived.avgMaturity,
      capacity: s.state.derived.capacity,
      overload: s.state.derived.overload,
      users: s.state.stats.users,
      live: s.state.projects.filter((p) => p.launched).length,
      total: s.state.projects.length,
      growth: s.state.derived.momGrowth,
      mrr: s.state.finance.mrr,
      parts: s.state.derived.valuationParts,
    })),
  )
  return (
    <section>
      <SectionTitle>{t('growth.product')}</SectionTitle>
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
        <Stat label={t('growth.avgMaturity')} icon="rocket" color="var(--color-brand)" value={pct(d.avg)} sub={<Bar value={d.avg} height={4} className="mt-1" />} />
        <Stat label={t('growth.liveProjects')} icon="flag" color="var(--color-positive)" value={`${d.live}/${d.total}`} />
        <Stat
          label={t('growth.capacity')}
          icon="users"
          color={WIDGET_COLOR.users}
          value={`${num(d.users)} / ${num(d.capacity)}`}
          sub={d.overload > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-ink"><Dot color="var(--color-negative)" size={6} />{t('hud.overload')}</span> : undefined}
        />
        <Stat label={t('growth.mrr')} icon="cash" color={WIDGET_COLOR.cash} value={money(d.mrr)} sub={t('growth.mom', { v: pct(d.growth, 1) })} />
      </div>
      {/* What builds the valuation (playtest LD2): the same stacked bar as the goals card, count × rate in the legend. */}
      {d.parts && <ValuationParts parts={d.parts} />}
    </section>
  )
}

/**
 * One line per center screen: icon, name, its numbers ("68% · 2 segment", "3 politika · 12g"), "›" (opens the
 * CenterFrame; time keeps flowing there). The Kurul row follows from Series A.
 */
function CenterRows() {
  const d = useGameStore(useShallow((s) => centerSummary(s.state.derived.policies, s.state.derived.market, s.state.derived.penetration, s.state.time.day)))
  const toggleCenter = useGameStore((s) => s.toggleCenter)
  return (
    <ul className="flex flex-col gap-1">
      <CenterRow icon="pie" label={t('growth.row.market')} value={t('growth.row.marketValue', { p: pct(d.pen), n: d.segments })} onOpen={() => toggleCenter('market')} />
      <CenterRow
        icon="book"
        label={t('growth.row.policies')}
        value={d.waitDays > 0 ? t('growth.row.policiesWait', { n: d.policies, d: d.waitDays }) : t('growth.row.policiesValue', { n: d.policies })}
        onOpen={() => toggleCenter('lawbook')}
      />
      <BoardRow />
    </ul>
  )
}

function CenterRow({ icon, label, value, onOpen }: { icon: IconName; label: string; value: string; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex min-h-9 w-full items-center gap-2 rounded-control bg-surface-2/60 px-2 py-1 text-left transition-colors hover:bg-surface-2">
        <Icon name={icon} size={16} className="shrink-0 text-ink-2" />
        <span className="ui-label min-w-0 flex-1 truncate">{label}</span>
        <span className="tabular shrink-0 text-[15px] font-semibold text-ink">{value}</span>
        <Icon name="chevronRight" size={16} className="shrink-0 text-ink-3" />
      </button>
    </li>
  )
}

function ChannelSection() {
  const unlocked = useTool('adBudget')
  const showLtv = useGameStore((s) => s.state.unlockedWidgets.includes('ltvCac'))
  const showChannels = useGameStore((s) => s.state.unlockedWidgets.includes('channelBreakdown'))
  const d = useGameStore(
    useShallow((s) => ({ budget: s.state.finance.adBudget, stage: s.state.stage, cac: s.state.derived.cac, ltvCac: s.state.derived.ltvCac, ch: s.state.derived.channels })),
  )

  return (
    <section>
      <SectionTitle right={<span className="tabular text-[15px] font-semibold text-ink">{t('hud.perMonthPlain', { v: money(d.budget) })}</span>}>
        {t('growth.adBudget')}
      </SectionTitle>
      {!unlocked ? (
        <LockedHint text={t('growth.adLocked')} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 @lg:grid-cols-4" role="group" aria-label={t('growth.adBudget')}>
            {adBudgetSteps(d.budget, d.stage).map((st) => (
              <AdStep key={st.key} label={t(`growth.adStep.${st.key}`)} amount={st.amount} budget={d.budget} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 @lg:grid-cols-3">
            <Stat label={t('growth.cac')} icon="coin" color={WIDGET_COLOR.burnBreakdown} value={money(d.cac)} />
            <Stat label={t('growth.paidUsers')} icon="magnet" color={WIDGET_COLOR.channelBreakdown} value={`+${num(d.ch.paid)}`} sub={t('hud.monthly')} />
            {showLtv && (
              <Stat
                label={t('hud.ltvCac')}
                icon="scale"
                color={WIDGET_COLOR.ltvCac}
                // Same warning rule as the HUD chip: under 3x is red, otherwise green.
                value={d.ltvCac === null ? '—' : <span className={d.ltvCac < 3 ? 'text-negative-ink' : 'text-positive-ink'}>{`${fixed(d.ltvCac, 1)}×`}</span>}
                sub={d.ltvCac !== null && d.ltvCac < 3 ? t('hud.ltvLow') : undefined}
              />
            )}
          </div>
        </>
      )}
      {showChannels && (
        <div className="mt-2 grid grid-cols-2 gap-2 @lg:grid-cols-4">
          <Stat label={t('channel.organic')} value={`+${num(d.ch.organic)}`} />
          <Stat label={t('channel.paid')} value={`+${num(d.ch.paid)}`} />
          <Stat label={t('channel.manual')} value={`+${num(d.ch.manual)}`} />
          <Stat label={t('channel.enterprise')} value={`+${num(d.ch.enterprise)}`} />
        </div>
      )}
    </section>
  )
}

/** One ad step: a commit button (the step, the monthly amount) with what it does to the runway under it. */
function AdStep({ label, amount, budget }: { label: string; amount: number; budget: number }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const preview = useSpendPreview(0, amount - budget)
  const on = amount === budget
  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1">
      <button
        type="button"
        aria-pressed={on}
        data-cue={on ? undefined : 'confirm'}
        onClick={() => !on && dispatch({ type: 'setAdBudget', amount })}
        className={cx(
          'flex min-h-11 flex-col items-center justify-center rounded-control border px-1 py-1 transition-[background-color,border-color,transform] duration-[120ms] active:scale-[0.96]',
          on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-border-strong text-ink hover:bg-surface-2',
        )}
      >
        <span className="tabular text-[17px] font-semibold leading-none">{label}</span>
        <span className="tabular mt-0.5 text-[11px] font-medium text-ink-2">{money(amount)}</span>
      </button>
      <CostPreview preview={preview} className="justify-center" />
    </div>
  )
}

function PriceSection() {
  const unlocked = useTool('priceControl')
  const d = useGameStore(useShallow((s) => ({ mult: s.state.finance.priceMultiplier, arpu: s.state.stats.arpu })))
  const dispatch = useGameStore((s) => s.dispatch)
  const on = nearestPriceStep(d.mult)
  return (
    <section>
      <SectionTitle right={<span className="tabular text-[15px] font-semibold text-ink">{`${fixed(d.mult, 2)}×`}</span>}>{t('growth.price')}</SectionTitle>
      {!unlocked ? (
        <PriceLock />
      ) : (
        <>
          <Segmented label={t('growth.priceMultiplier')} className="w-full justify-between">
            {PRICE_STEPS.map((v) => (
              <Chip key={v} segment active={v === on} onClick={() => v !== on && dispatch({ type: 'setPrice', multiplier: v })}>
                <span className="tabular">{fixed(v, 2)}</span>
              </Chip>
            ))}
          </Segmented>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-2">
            <span className="inline-flex items-center gap-1">
              <Icon name="coin" size={12} style={{ color: iconTone(WIDGET_COLOR.arpu) }} />
              {t('growth.arpuNow', { v: `$${fixed(d.arpu, 2)}` })}
            </span>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Price lock as the trigger's own checks (playtest LD5): stage + users / maturity / churn with live numbers, each
 * green once met. Once the `pricing` customer has come and gone unopened (bubble shelved), the lock becomes a
 * brand button (breathing coin) to that card: opening it is what unlocks the tool (learnConcept).
 */
function PriceLock() {
  const g = useGameStore(useShallow((s) => priceGate(s.state)))
  if (g.waiting) {
    return (
      <button
        type="button"
        onClick={() => openConceptCard('pricing')}
        className="flex min-h-9 w-full items-center gap-2 rounded-control border border-brand bg-brand-soft px-3 py-2 text-left text-brand-ink"
      >
        <Icon name="coin" size={16} className="shrink-0 animate-breathe" />
        <span className="min-w-0 flex-1 text-xs font-semibold">{t('growth.priceWaiting')}</span>
        <Icon name="chevronRight" size={16} className="shrink-0" />
      </button>
    )
  }
  return (
    <>
      <LockedHint text={t('growth.priceLocked')} />
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        <GateItem ok={g.stage} text={t('growth.gate.stage')} />
        <GateItem ok={g.users.ok} text={t('growth.gate.users', { v: num(g.users.value), t: num(g.users.bar) })} />
        <GateItem ok={g.maturity.ok} text={t('growth.gate.maturity', { v: pct(g.maturity.value), t: pct(g.maturity.bar) })} />
        <GateItem ok={g.churn.ok} text={t('growth.gate.churn', { v: pct(g.churn.value, 1), t: pct(g.churn.bar) })} />
      </ul>
    </>
  )
}

function GateItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="tabular inline-flex items-center gap-1 rounded-control bg-surface-2/60 px-2 py-1 text-[11px] text-ink-2">
      <Dot color={ok ? 'var(--color-positive)' : 'var(--color-border-strong)'} size={6} />
      {text}
    </li>
  )
}

function EnterpriseSection() {
  const unlocked = useTool('enterpriseSales')
  const customers = useGameStore(useShallow((s) => s.state.finance.enterpriseCustomers))
  const mrr = useGameStore((s) => s.state.finance.mrr)
  return (
    <section>
      <SectionTitle>{t('growth.enterprise')}</SectionTitle>
      {!unlocked ? (
        <LockedHint text={t('growth.enterpriseLocked')} />
      ) : customers.length === 0 ? (
        <Empty text={t('growth.enterpriseEmpty')} icon="handshake" />
      ) : (
        <ul className="flex flex-col gap-1">
          {customers.map((c) => (
            <li key={c.id} className="flex min-h-9 items-center justify-between gap-2 rounded-control bg-surface-2/60 px-2 py-1">
              <span className="truncate text-sm font-semibold">{c.name}</span>
              <span className="tabular text-xs font-semibold">
                {t('hud.perMonthPlain', { v: money(c.mrr) })}
                {mrr > 0 && <span className="ml-1 text-ink-2">({pct(c.mrr / mrr)})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
