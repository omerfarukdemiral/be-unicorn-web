// Büyüme: funding round, product health, channels (ad budget), price, enterprise. Locked tools show a hint.
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ToolId } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Bar, Dot, Empty, LockedHint, SectionTitle, Stat } from '../primitives'
import { RoundSection } from './RoundSection'

const AD_STEPS = [0, 250, 500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]

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
      {(showRound || section === 'round') && <RoundSection />}
      <ProductSection />
      <ChannelSection />
      <PriceSection />
      <EnterpriseSection />
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
    })),
  )
  return (
    <section>
      <SectionTitle>{t('growth.product')}</SectionTitle>
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
        <Stat label={t('growth.avgMaturity')} value={pct(d.avg)} sub={<Bar value={d.avg} height={4} className="mt-1" />} />
        <Stat label={t('growth.liveProjects')} value={`${d.live}/${d.total}`} />
        <Stat
          label={t('growth.capacity')}
          value={`${num(d.users)} / ${num(d.capacity)}`}
          sub={d.overload > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-ink"><Dot color="var(--color-negative)" size={6} />{t('hud.overload')}</span> : undefined}
        />
        <Stat label={t('growth.mrr')} value={money(d.mrr)} sub={t('growth.mom', { v: pct(d.growth, 1) })} />
      </div>
    </section>
  )
}

function ChannelSection() {
  const unlocked = useTool('adBudget')
  const showLtv = useGameStore((s) => s.state.unlockedWidgets.includes('ltvCac'))
  const showChannels = useGameStore((s) => s.state.unlockedWidgets.includes('channelBreakdown'))
  const d = useGameStore(useShallow((s) => ({ budget: s.state.finance.adBudget, cac: s.state.derived.cac, ltvCac: s.state.derived.ltvCac, ch: s.state.derived.channels })))
  const dispatch = useGameStore((s) => s.dispatch)
  const current = nearestStep(d.budget)
  const [idx, setIdx] = useState(current)
  useEffect(() => setIdx(current), [current])
  const commit = () => {
    const amount = AD_STEPS[idx] ?? 0
    if (amount !== d.budget) dispatch({ type: 'setAdBudget', amount })
  }

  return (
    <section>
      <SectionTitle>{t('growth.channels')}</SectionTitle>
      {!unlocked ? (
        <LockedHint text={t('growth.adLocked')} />
      ) : (
        <div className="rounded-control border border-border px-3 pb-3 pt-2.5">
          <div className="flex items-baseline justify-between">
            <span className="ui-label">{t('growth.adBudget')}</span>
            <span className="tabular text-sm font-semibold">{t('hud.perMonthPlain', { v: money(AD_STEPS[idx] ?? 0) })}</span>
          </div>
          <input
            className="ui-range"
            type="range"
            min={0}
            max={AD_STEPS.length - 1}
            step={1}
            value={idx}
            aria-label={t('growth.adBudget')}
            onChange={(e) => setIdx(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            onBlur={commit}
          />
          <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
            <Stat label={t('growth.cac')} value={money(d.cac)} />
            <Stat label={t('growth.paidUsers')} value={`+${num(d.ch.paid)}`} sub={t('hud.monthly')} />
            {showLtv && <Stat label={t('hud.ltvCac')} value={d.ltvCac === null ? '—' : `${fixed(d.ltvCac, 1)}×`} sub={d.ltvCac !== null && d.ltvCac < 3 ? t('hud.ltvLow') : undefined} />}
          </div>
        </div>
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

function nearestStep(v: number): number {
  let best = 0
  for (let i = 0; i < AD_STEPS.length; i++) {
    if (Math.abs((AD_STEPS[i] ?? 0) - v) < Math.abs((AD_STEPS[best] ?? 0) - v)) best = i
  }
  return best
}

function PriceSection() {
  const unlocked = useTool('priceControl')
  const d = useGameStore(useShallow((s) => ({ mult: s.state.finance.priceMultiplier, arpu: s.state.stats.arpu })))
  const dispatch = useGameStore((s) => s.dispatch)
  const [v, setV] = useState(d.mult)
  useEffect(() => setV(d.mult), [d.mult])
  const commit = () => {
    if (Math.abs(v - d.mult) > 1e-6) dispatch({ type: 'setPrice', multiplier: Math.round(v * 100) / 100 })
  }
  return (
    <section>
      <SectionTitle>{t('growth.price')}</SectionTitle>
      {!unlocked ? (
        <LockedHint text={t('growth.priceLocked')} />
      ) : (
        <div className="rounded-control border border-border px-3 pb-3 pt-2.5">
          <div className="flex items-baseline justify-between">
            <span className="ui-label">{t('growth.priceMultiplier')}</span>
            <span className="tabular text-sm font-semibold">{fixed(v, 2)}×</span>
          </div>
          <input
            className="ui-range"
            type="range"
            min={0.7}
            max={1.6}
            step={0.05}
            value={v}
            aria-label={t('growth.priceMultiplier')}
            onChange={(e) => setV(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            onBlur={commit}
          />
          <div className="flex items-center justify-between gap-2 text-[11px] text-ink-2">
            <span>{t('growth.arpuNow', { v: `$${fixed(d.arpu, 2)}` })}</span>
            {v > d.mult + 1e-6 && (
              <span className="inline-flex items-center gap-1 text-right font-semibold text-ink">
                <Dot color="var(--color-negative)" size={6} />
                {t('growth.priceWarning')}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
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
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {customers.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-1 py-2.5">
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
