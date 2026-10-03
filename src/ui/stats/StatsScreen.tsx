// Statistics screen (docs/GAMEPLAY_V2.md §14.5), inside the CenterFrame: four tabs (Para, Büyüme, Ekip, Profil) of
// hand-drawn charts. Time flows while it is open, so the lines grow under the player's eyes. Numbers over labels:
// every tile's header is its value (22px tabular), the name is one word; the one sentence is "Kasa biter · Gün 412".
// Tap a line to select a month: every tile header then prints that month. Para marks the crisis calendar and the board's
// quarter ends on the cash line; Büyüme draws the lead rival's valuation as a thin grey line.
//
// Performance (§14.5): the month series are rebuilt only when a payday adds a receipt (statsMemo keyed on count +
// last payday); the live end (cash, MRR, users, day) comes from a separate small selector, the projection and the
// radar once per game day.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cashProjection, companyProfile, targetProfile } from '../../engine/loopSelectors'
import { DEPTS, PROFILE_AXES } from '../../engine/types'
import { DEPT_TEXT } from '../../content'
import { useGameStore } from '../../store/gameStore'
import type { StatsTab } from '../../store/types'
import { BarChart, LineChart, LockedTile, PieChart, RadarChart, type LinePoint } from '../charts'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Chip, cx, Segmented } from '../primitives'
import { Legend, ramp, WIDGET_COLOR } from '../theme'
import { calendarMarks, costSplit, COST_KEYS, deptBars, growthView, leadRival, moneyView, profileView, projectionMonths, runwayAt, statsKey, statsLocks, statsMemo, teamView, type CostKey, type LiveTip, type StatsSeries } from './statsData'

export const STATS_TABS: readonly StatsTab[] = ['money', 'growth', 'team', 'profile']

const TAB_ICON: Record<StatsTab, IconName> = { money: 'cash', growth: 'trend', team: 'users', profile: 'compass' }

const COST_TEXT: Record<CostKey, string> = {
  salaries: 'burn.salaries',
  rent: 'burn.rent',
  founder: 'burn.founder',
  infra: 'burn.infra',
  ads: 'burn.ads',
  expansion: 'burn.expansion',
  interest: 'burn.interest',
}

/** Vertical marks on the cash line: paydays plain, the crisis calendar in the energy hue, the board in brand ink. */
const MARK_COLOR = { payday: undefined, crisis: 'var(--color-energy)', board: 'var(--color-brand-ink)' } as const

/** Chart height: every tile ≥ 200px, phones too (§14.5). */
const LINE_H = 200
const BAR_H = 200

const dayText = (x: number): string => t('stats.day', { d: Math.round(x) })
const plain = (n: number): string => fixed(n, 0)

/** `tab` = the overlay's ({kind: 'stats', tab}); a chip switches it through openOverlay. */
export function StatsScreen({ tab }: { tab: StatsTab }) {
  const openOverlay = useGameStore((s) => s.openOverlay)
  // Re-render on a new receipt only; the series object is the memo's until then.
  const key = useGameStore(useShallow((s) => statsKey(s.state.finance.receipts)))
  const memo = useRef(statsMemo()).current
  const series = memo(useGameStore.getState().state.finance.receipts)
  const live = useGameStore(
    useShallow(
      (s): LiveTip => ({
        day: Math.floor(s.state.time.day),
        cash: Math.round(s.state.stats.cash),
        mrr: Math.round(s.state.finance.mrr),
        users: Math.round(s.state.stats.users),
        valuation: Math.round(s.state.finance.valuation),
        team: s.state.employees.length,
        morale: Math.round(s.state.stats.morale),
        runway: s.state.finance.runway === null ? null : Math.round(s.state.finance.runway * 10) / 10,
      }),
    ),
  )
  const [sel, setSel] = useState<number | null>(null)
  // The lines draw themselves in on the screen's first open only (not on every tab switch).
  const firstOpen = useRef(true)
  const animate = firstOpen.current
  // Children's mount effects run first (they saw `animate`); from here on, a tab switch mounts still charts.
  useEffect(() => {
    firstOpen.current = false
  }, [])

  return (
    <>
      <div className="shrink-0 overflow-x-auto px-3 pb-2 pt-1 [scrollbar-width:none]">
        <Segmented label={t('stats.tabs')}>
          {STATS_TABS.map((id) => (
            <Chip key={id} segment active={tab === id} icon={TAB_ICON[id]} onClick={() => openOverlay({ kind: 'stats', tab: id })}>
              {t(`stats.tab.${id}`)}
            </Chip>
          ))}
        </Segmented>
      </div>
      <div className="ui-scroll min-h-0 flex-1 px-3 pb-3 safe-bottom" data-stats-tab={tab} data-stats-n={key.n}>
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
          {tab === 'money' && <MoneyTab series={series} live={live} sel={sel} onSelect={setSel} animate={animate} />}
          {tab === 'growth' && <GrowthTab series={series} live={live} sel={sel} onSelect={setSel} animate={animate} />}
          {tab === 'team' && <TeamTab series={series} live={live} sel={sel} onSelect={setSel} animate={animate} />}
          {tab === 'profile' && <ProfileTab day={live.day} />}
        </div>
      </div>
    </>
  )
}

interface TabProps {
  series: StatsSeries
  live: LiveTip
  sel: number | null
  onSelect: (x: number | null) => void
  animate: boolean
}

/** Value at the selected day, else the newest one. */
function valueAt(points: readonly LinePoint[], sel: number | null): { y: number | null; x: number | null } {
  if (sel !== null) {
    const p = points.find((q) => q.x === sel)
    if (p) return { y: p.y, x: sel }
  }
  for (let i = points.length - 1; i >= 0; i--) if (points[i]!.y !== null) return { y: points[i]!.y, x: null }
  return { y: null, x: null }
}

/** One chart tile: value first (D1), one-word name with the gauge tile under it, then the chart. No card-in-card. */
function Tile({ label, icon, color, value, sub, wide, children }: { label: string; icon: IconName; color: string; value?: ReactNode; sub?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cx('min-w-0 border-t border-border pt-2', wide && 'min-[640px]:col-span-2')}>
      <div className="mb-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {value !== undefined && <span className="tabular text-[22px] font-semibold leading-none text-ink">{value}</span>}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center rounded-[5px]" style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)` }}>
            <Icon name={icon} size={10} />
          </span>
          <span className="ui-label">{label}</span>
        </span>
        {sub}
      </div>
      {children}
    </div>
  )
}

/** A bar chart before its first month is on record: the icon only, no sentence (the death day keeps that slot). */
function EmptyChart({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div role="img" aria-label={label} className="grid w-full place-items-center text-ink-4" style={{ minHeight: BAR_H }}>
      <Icon name={icon} size={22} />
    </div>
  )
}

function SelDay({ x }: { x: number | null }) {
  return x === null ? null : <span className="tabular text-[11px] font-medium text-ink-2">{dayText(x)}</span>
}

function MoneyTab({ series, live, sel, onSelect, animate }: TabProps) {
  const proj = useMemo(() => {
    // Far death day (right after a round): stretch the projection so the red point sits on the line.
    const st = useGameStore.getState().state
    const p = cashProjection(st)
    const months = projectionMonths(p)
    return months > p.points.length ? cashProjection(st, months) : p
  }, [live.day, series])
  // Calendar marks: a string key (the views are new every step), the dates only move when a crisis or a quarter does.
  const marksKey = useGameStore((s) => JSON.stringify(calendarMarks(s.state.calendar, s.state.derived.board, (s.state.board?.hits ?? 0) + (s.state.board?.misses ?? 0), s.state.time.day)))
  const v = useMemo(() => moneyView(series, live, proj, JSON.parse(marksKey)), [series, live, proj, marksKey])
  const burn = useGameStore(useShallow((s) => ({ ...s.state.finance.burnBreakdown })))
  const locked = useGameStore(useShallow((s) => statsLocks(s.state.unlockedWidgets, s.state.unlockedTools, null)))
  const cash = valueAt(v.cash, sel)
  const runway = runwayAt(series, live, sel)
  const BURN = ramp(WIDGET_COLOR.burnBreakdown)
  const costParts = COST_KEYS.map((k, i) => ({ label: t(COST_TEXT[k]), color: BURN[i]! }))
  const split = costSplit(burn)
  return (
    <>
      <Tile
        wide
        label={t('stats.cash')}
        icon="cash"
        color={WIDGET_COLOR.cash}
        value={cash.y === null ? '—' : money(cash.y)}
        sub={
          <>
            <SelDay x={cash.x} />
            {v.deathDay !== null && <p className="tabular font-text text-[12px] font-semibold text-negative-ink">{t('stats.deathDay', { d: v.deathDay })}</p>}
          </>
        }
      >
        <LineChart
          label={t('stats.cash')}
          series={[{ id: 'cash', color: WIDGET_COLOR.cash, points: v.cash }]}
          projection={v.projection}
          danger={v.death}
          marks={v.marks.map((m) => ({ x: m.x, color: MARK_COLOR[m.kind] }))}
          height={LINE_H}
          formatY={money}
          formatX={dayText}
          selectedX={sel}
          onSelect={onSelect}
          animate={animate}
        />
      </Tile>
      <Tile label={t('stats.runway')} icon="hourglass" color={WIDGET_COLOR.runway} value={runway.y === undefined ? '—' : runway.y === null ? t('top.runwayInfinite') : fixed(runway.y, 1)} sub={<SelDay x={runway.x} />}>
        <LineChart
          label={t('stats.runway')}
          series={[{ id: 'runway', color: WIDGET_COLOR.runway, points: v.runway }]}
          height={LINE_H}
          formatY={(n) => fixed(n, 0)}
          formatX={dayText}
          selectedX={sel}
          onSelect={onSelect}
          animate={animate}
        />
      </Tile>
      <Tile label={t('stats.flow')} icon="bars" color={WIDGET_COLOR.cash}>
        {v.flow.length === 0 ? (
          <EmptyChart icon="bars" label={t('stats.flow')} />
        ) : (
          <BarChart
            label={t('stats.flow')}
            bars={[
              { label: t('stats.revenue'), parts: [{ label: t('stats.revenue'), color: WIDGET_COLOR.cash }] },
              { label: t('stats.cost'), parts: costParts },
            ]}
            groups={v.flow}
            height={BAR_H}
            formatY={money}
            formatX={dayText}
            legendFormat={money}
            selectedX={sel}
          />
        )}
      </Tile>
      <Tile label={t('stats.split')} icon="flame" color={WIDGET_COLOR.burnBreakdown}>
        {locked.burn ? (
          <LockedTile label={t('hud.burn')} icon="flame" height={BAR_H} />
        ) : (
          <PieChart label={t('stats.split')} slices={costParts.map((p, i) => ({ ...p, value: split[i] ?? 0 }))} format={money} otherLabel={t('stats.other')} />
        )}
      </Tile>
    </>
  )
}

function GrowthTab({ series, live, sel, onSelect, animate }: TabProps) {
  const round = useGameStore(useShallow((s) => (s.state.derived.round ? { target: s.state.derived.round.target, windowAt: s.state.derived.round.windowAt } : null)))
  const rival = useGameStore(useShallow((s) => leadRival(s.state.rivals)))
  const v = useMemo(() => growthView(series, live, round, rival), [series, live, round, rival])
  const ch = useGameStore(useShallow((s) => ({ ...s.state.derived.channels })))
  const locked = useGameStore(useShallow((s) => statsLocks(s.state.unlockedWidgets, s.state.unlockedTools, v.penetration)))
  const mrr = valueAt(v.mrr, sel)
  const users = valueAt(v.users, sel)
  const val = valueAt(v.valuation, sel)
  const CH = ramp(WIDGET_COLOR.channelBreakdown)
  return (
    <>
      <Tile label={t('stats.mrr')} icon="coin" color={WIDGET_COLOR.cash} value={mrr.y === null ? '—' : money(mrr.y)} sub={<SelDay x={mrr.x} />}>
        <LineChart label={t('stats.mrr')} series={[{ id: 'mrr', color: WIDGET_COLOR.cash, points: v.mrr }]} height={LINE_H} formatY={money} formatX={dayText} selectedX={sel} onSelect={onSelect} animate={animate} />
      </Tile>
      <Tile label={t('stats.users')} icon="users" color={WIDGET_COLOR.users} value={users.y === null ? '—' : num(users.y)} sub={<SelDay x={users.x} />}>
        <LineChart label={t('stats.users')} series={[{ id: 'users', color: WIDGET_COLOR.users, points: v.users }]} height={LINE_H} formatY={num} formatX={dayText} selectedX={sel} onSelect={onSelect} animate={animate} />
      </Tile>
      <Tile
        wide
        label={t('stats.valuation')}
        icon="rocket"
        color="var(--color-brand)"
        value={val.y === null ? '—' : money(val.y)}
        sub={
          <>
            <SelDay x={val.x} />
            {v.rival && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-2" data-rival-line>
                <span aria-hidden="true" className="h-px w-3 bg-ink-4" />
                {t('stats.rivalToday', { name: v.rival.name })}
              </span>
            )}
          </>
        }
      >
        <LineChart
          label={t('stats.valuation')}
          series={[{ id: 'valuation', color: 'var(--color-brand)', points: v.valuation }]}
          targets={[
            ...(v.target ? [{ y: v.target.value, label: t('stats.target') }, { y: v.target.window, label: t('stats.window'), color: 'var(--color-border-strong)' }] : []),
            ...(v.rival ? [{ y: v.rival.valuation, label: t('stats.rival'), color: 'var(--color-ink-4)' }] : []),
          ]}
          height={LINE_H}
          formatY={money}
          formatX={dayText}
          selectedX={sel}
          onSelect={onSelect}
          animate={animate}
        />
      </Tile>
      <Tile label={t('stats.newUsers')} icon="users" color={WIDGET_COLOR.users}>
        {v.newUsers.length === 0 ? (
          <EmptyChart icon="users" label={t('stats.newUsers')} />
        ) : (
          <BarChart
            label={t('stats.newUsers')}
            bars={[{ label: t('stats.newUsers'), parts: [{ label: t('stats.newUsers'), color: WIDGET_COLOR.users }] }]}
            groups={v.newUsers}
            height={BAR_H}
            formatY={num}
            formatX={dayText}
            legendFormat={num}
            selectedX={sel}
          />
        )}
      </Tile>
      <Tile label={t('stats.channels')} icon="branch" color={WIDGET_COLOR.channelBreakdown}>
        {locked.channels ? (
          <LockedTile label={t('hud.channels')} icon="branch" height={BAR_H} />
        ) : (
          <PieChart
            label={t('stats.channels')}
            slices={[
              { label: t('channel.organic'), color: CH[0], value: ch.organic },
              { label: t('channel.paid'), color: CH[1], value: ch.paid },
              { label: t('channel.manual'), color: CH[2], value: ch.manual },
              { label: t('channel.enterprise'), color: CH[3], value: ch.enterprise },
            ]}
            format={(n) => `+${num(n)}`}
            otherLabel={t('stats.other')}
          />
        )}
      </Tile>
      <Tile label={t('stats.market')} icon="pie" color={WIDGET_COLOR.users}>
        {locked.market || v.penetration === null ? (
          <LockedTile label={t('stats.market')} icon="pie" height={BAR_H} />
        ) : (
          <PieChart
            track
            label={t('stats.market')}
            // Percent points, so the legend's crumb filter (≤ 0.5) never hides a real share.
            slices={[
              { label: t('stats.market'), color: WIDGET_COLOR.users, value: v.penetration * 100 },
              { label: t('stats.other'), color: 'var(--color-border)', value: (1 - v.penetration) * 100 },
            ]}
            center={pct(v.penetration)}
            format={(n) => pct(n / 100)}
            otherLabel={t('stats.other')}
          />
        )}
      </Tile>
    </>
  )
}

function TeamTab({ series, live, sel, onSelect, animate }: TabProps) {
  const v = useMemo(() => teamView(series, live), [series, live])
  // A string key (the derived objects are new every step): the bars move when a head count or an output does.
  const deptKey = useGameStore((s) => DEPTS.map((d) => `${s.state.derived.deptCounts[d]}:${s.state.derived.deptOutput[d].toFixed(1)}`).join('|'))
  const bars = useMemo(() => {
    const d = useGameStore.getState().state.derived
    return deptBars(DEPTS, d.deptCounts, d.deptOutput)
  }, [deptKey])
  const equity = useGameStore((s) => s.state.stats.equity)
  const locked = useGameStore(useShallow((s) => statsLocks(s.state.unlockedWidgets, s.state.unlockedTools, null)))
  const team = valueAt(v.team, sel)
  const morale = valueAt(v.morale, sel)
  const TEAM = ramp(WIDGET_COLOR.cultureBadge)
  const EQ = ramp(WIDGET_COLOR.capTable)
  return (
    <>
      <Tile label={t('stats.team')} icon="users" color={WIDGET_COLOR.cultureBadge} value={team.y === null ? '—' : plain(team.y)} sub={<SelDay x={team.x} />}>
        <LineChart label={t('stats.team')} series={[{ id: 'team', color: WIDGET_COLOR.cultureBadge, points: v.team }]} height={LINE_H} formatY={plain} formatX={dayText} selectedX={sel} onSelect={onSelect} animate={animate} />
      </Tile>
      <Tile label={t('stats.morale')} icon="heart" color={WIDGET_COLOR.morale} value={morale.y === null ? '—' : plain(morale.y)} sub={<SelDay x={morale.x} />}>
        <LineChart label={t('stats.morale')} series={[{ id: 'morale', color: WIDGET_COLOR.morale, points: v.morale }]} height={LINE_H} formatY={plain} formatX={dayText} selectedX={sel} onSelect={onSelect} animate={animate} />
      </Tile>
      <Tile label={t('stats.depts')} icon="grid" color={WIDGET_COLOR.cultureBadge}>
        <BarChart
          label={t('stats.depts')}
          bars={[
            { label: t('stats.people'), parts: [{ label: t('stats.people'), color: TEAM[0] }] },
            { label: t('stats.output'), parts: [{ label: t('stats.output'), color: TEAM[2] }] },
          ]}
          groups={bars}
          height={BAR_H}
          formatY={plain}
          formatX={(i) => DEPT_TEXT[DEPTS[i] ?? 'eng'].short}
          labelEach
        />
      </Tile>
      <Tile label={t('stats.equity')} icon="pie" color={WIDGET_COLOR.capTable}>
        {locked.capTable ? (
          <LockedTile label={t('hud.capTable')} icon="pie" height={BAR_H} />
        ) : (
          <PieChart
            label={t('stats.equity')}
            slices={[
              { label: t('stats.founder'), color: EQ[0], value: equity * 100 },
              { label: t('stats.investors'), color: EQ[3], value: (1 - equity) * 100 },
            ]}
            center={pct(equity)}
            format={(n) => pct(n / 100)}
            otherLabel={t('stats.other')}
          />
        )}
      </Tile>
    </>
  )
}

function ProfileTab({ day }: { day: number }) {
  const stage = useGameStore((s) => s.state.stage)
  const p = useMemo(() => profileView(companyProfile(useGameStore.getState().state), targetProfile(stage)), [day, stage])
  return (
    <Tile wide label={t('stats.profile')} icon="compass" color="var(--color-brand)">
      <RadarChart label={t('stats.profile')} axes={PROFILE_AXES.map((a) => t(`stats.axis.${a}`))} values={p.values} target={p.target} />
      <Legend
        className="mt-2 justify-center"
        parts={[
          { label: t('stats.company'), color: 'var(--color-brand)', value: 1 },
          { label: t('stats.expected'), color: 'var(--color-ink-2)', value: 1 },
        ]}
        format={() => ''}
      />
    </Tile>
  )
}
