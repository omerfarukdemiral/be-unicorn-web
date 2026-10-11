// Büyüme, three tabs (one job each, the panel never scrolls through everything):
//   Tur        the funding round + the Kurul row (Series A on)
//   Pazarlama  ad budget steps + CAC / LTV:CAC + channels, price steps, rows to Pazar haritası and Kanun Kitabı
//   Müşteri    renewals due + key accounts
// Not here (each has one home elsewhere): MRR (the panel header), maturity / live projects (Projeler), capacity
// (Kullanıcı's overload mark), the valuation parts and the landed decision effects (Yol haritası).
// HUD grammar (GAMEPLAY V2 §10.5): no sliders, every step is a button with its CostPreview; the big surfaces open in
// the middle (CenterFrame), not stacked in this drawer.
// Stage goals (☆) live in Yol haritası (RoadmapPanel). Explanations sit behind ⓘ, never under a number.
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { adBudgetSteps, nearestPriceStep, PRICE_STEPS } from '../../engine'
import type { ToolId } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Chip, CostPreview, cx, Dot, Empty, LockedHint, SectionTitle, Segmented, Stat } from '../primitives'
import { iconTone, WIDGET_COLOR } from '../theme'
import { Icon, type IconName } from '../icons'
import { useSpendPreview } from '../widgets'
import { centerSummary } from '../center/centerData'
import { RoundSection } from './RoundSection'
import { BoardRow } from './BoardRow'
import { RenewalSection } from './RenewalSection'
import { priceGate } from '../loopUi'
import { openConceptCard } from '../uiActions'
import { InfoTip } from '../InfoTip'

function useTool(id: ToolId): boolean {
  return useGameStore((s) => s.state.unlockedTools.includes(id))
}

type GrowthTab = 'round' | 'market' | 'customers'

/** The tab last shown this session: reopening Büyüme lands where the player left it. */
let lastTab: GrowthTab | null = null

export function GrowthPanel({ section }: { section?: 'round' }) {
  const showRound = useGameStore((s) => s.state.derived.canStartRound || !!s.state.round?.active || s.state.stage > 0)
  const roundCall = useGameStore((s) => !!s.state.round?.active || s.state.derived.canStartRound)
  const renewals = useGameStore((s) => s.state.derived.renewals?.length ?? 0)
  const adOpen = useTool('adBudget')
  // Müşteri only once there is someone to sell to or renew (before Series B it was one lock line).
  const customersOpen = useTool('enterpriseSales') || renewals > 0
  const tabs = (['round', 'market', 'customers'] as const).filter((k) => (k === 'round' ? showRound || section === 'round' : k === 'customers' ? customersOpen : true))
  const [tab, setTab] = useState<GrowthTab>(() => {
    if (section === 'round') return 'round'
    const has = (k: GrowthTab) => (tabs as readonly GrowthTab[]).includes(k)
    if (lastTab && has(lastTab)) return lastTab
    if (roundCall && has('round')) return 'round'
    if (renewals > 0) return 'customers'
    return adOpen || !has('round') ? 'market' : 'round'
  })
  // Opened from the HUD round button: the Tur tab, its block in view.
  useEffect(() => {
    if (section !== 'round') return
    setTab('round')
    document.getElementById('round-section')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [section])
  const shown: GrowthTab = (tabs as readonly GrowthTab[]).includes(tab) ? tab : tabs[0]!
  const pick = (k: GrowthTab) => {
    lastTab = k
    setTab(k)
  }
  const dot: Partial<Record<GrowthTab, boolean>> = { round: roundCall, customers: renewals > 0 }
  return (
    <div className="flex flex-col gap-4">
      <Segmented label={t('growth.tabs')} className="w-full [&>button]:flex-1 [&>button]:justify-center">
        {tabs.map((k) => (
          <Chip key={k} segment active={k === shown} onClick={() => pick(k)}>
            {t(`growth.tab.${k}`)}
            {dot[k] && k !== shown && <Dot color="var(--color-brand)" size={6} />}
          </Chip>
        ))}
      </Segmented>
      {shown === 'round' && (
        <>
          <RoundSection setup={section === 'round'} />
          <BoardRowList />
        </>
      )}
      {shown === 'market' && (
        <>
          <ChannelSection />
          <PriceSection />
          <CenterRows />
        </>
      )}
      {shown === 'customers' && (
        <>
          <RenewalSection />
          <EnterpriseSection />
        </>
      )}
    </div>
  )
}

/** Kurul (from Series A) under the round: the quarter's MRR exam belongs with the investors. */
function BoardRowList() {
  return (
    <ul className="flex flex-col gap-1 empty:hidden">
      <BoardRow />
    </ul>
  )
}

/**
 * One line per center screen: icon, name, its numbers ("68% · 2 segment", "3 politika · 12g"), "›" (opens the
 * CenterFrame; time keeps flowing there). The Kurul row lives in the Tur tab.
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label={t('growth.cac')} icon="coin" color={WIDGET_COLOR.burnBreakdown} value={money(d.cac)} info={t('growth.cacInfo')} />
            {showLtv && (
              <Stat
                label={t('hud.ltvCac')}
                icon="scale"
                color={WIDGET_COLOR.ltvCac}
                // Same warning rule as the HUD chip: under 3x is red, otherwise green.
                value={d.ltvCac === null ? '—' : <span className={d.ltvCac < 3 ? 'text-negative-ink' : 'text-positive-ink'}>{`${fixed(d.ltvCac, 1)}×`}</span>}
                info={t('growth.ltvInfo')}
              />
            )}
          </div>
        </>
      )}
      {showChannels && (
        // New users a month by channel: one row of small figures (the four big Stats read as a wall of numbers).
        <dl className="mt-2 grid grid-cols-4 gap-1 border-t border-border pt-2">
          {(['organic', 'paid', 'manual', 'enterprise'] as const).map((k) => (
            <div key={k} className="min-w-0">
              <dd className="tabular text-[15px] font-semibold leading-tight text-ink">{`+${num(d.ch[k])}`}</dd>
              <dt className="truncate text-[10.5px] font-medium text-ink-2">{t(`channel.${k}`)}</dt>
            </div>
          ))}
        </dl>
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
          // Soft option keys, no frames: the chosen step is the brand-soft key, the others plain surface keys.
          'ui-key ui-key-sm flex min-h-11 flex-col items-center justify-center rounded-control px-1 py-1',
          on ? 'ui-key-soft' : 'ui-key-routine',
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
      <SectionTitle
        right={
          unlocked ? (
            <span className="tabular inline-flex items-center gap-1 text-[15px] font-semibold text-ink">
              <Icon name="coin" size={13} style={{ color: iconTone(WIDGET_COLOR.arpu) }} />
              {`$${fixed(d.arpu, 2)}`}
              <InfoTip title={t('hud.arpu')} size={12}>
                {t('growth.arpuInfo')}
              </InfoTip>
            </span>
          ) : undefined
        }
      >
        {t('growth.price')}
      </SectionTitle>
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
  // Flat primitives only: priceGate builds fresh nested checks, and useShallow compares one level deep (a nested
  // object would read as a new snapshot every render and loop forever).
  const g = useGameStore(
    useShallow((s) => {
      const p = priceGate(s.state)
      return {
        stage: p.stage,
        waiting: p.waiting,
        users: p.users.value,
        usersBar: p.users.bar,
        usersOk: p.users.ok,
        maturity: p.maturity.value,
        maturityBar: p.maturity.bar,
        maturityOk: p.maturity.ok,
        churn: p.churn.value,
        churnBar: p.churn.bar,
        churnOk: p.churn.ok,
      }
    }),
  )
  if (g.waiting) {
    return (
      <button
        type="button"
        onClick={() => openConceptCard('pricing')}
        className="ui-key ui-key-sm ui-key-soft flex min-h-9 w-full items-center gap-2 rounded-control px-3 py-2 text-left"
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
        <GateItem ok={g.usersOk} text={t('growth.gate.users', { v: num(g.users), t: num(g.usersBar) })} />
        <GateItem ok={g.maturityOk} text={t('growth.gate.maturity', { v: pct(g.maturity), t: pct(g.maturityBar) })} />
        <GateItem ok={g.churnOk} text={t('growth.gate.churn', { v: pct(g.churn, 1), t: pct(g.churnBar) })} />
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
