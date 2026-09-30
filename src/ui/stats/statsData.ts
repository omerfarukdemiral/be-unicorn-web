// Stats screen data (docs/GAMEPLAY_V2.md §14.5): the month receipts (finance.receipts) and the engine's selectors
// (cashProjection / companyProfile / targetProfile) laid out as chart series. Pure and tested (statsData.test.ts):
// nothing here is a game formula, it only sorts engine numbers into points, bars and slices.
//
// Performance: time flows under the screen and step() clones the state, so `receipts` is a new array ~8 times a
// second at 4×. The series are rebuilt only when the key (receipt count, last payday) changes: statsMemo().
import { PROFILE_AXES, type BurnBreakdown, type CashProjection, type CompanyProfile, type Dept, type ReceiptEntry } from '../../engine/types'
import type { BarGroup, LinePoint } from '../charts'

/** Cost parts of a month, bottom of the stack first (same order as the Yakıt card). */
export const COST_KEYS = ['salaries', 'rent', 'founder', 'infra', 'ads'] as const
export type CostKey = (typeof COST_KEYS)[number]

/** Months shown in the bar charts ("son 12 ay"). */
export const BAR_MONTHS = 12

/** One closed month, as the charts read it. `null` = not on record (a month rebuilt from a pre-v4 save). */
export interface MonthRow {
  /** Payday (game day): the x of every chart. */
  x: number
  month: number
  cash: number | null
  /** Months; null = infinite (profitable) or unknown. */
  runway: number | null
  revenue: number | null
  /** COST_KEYS order. */
  costs: number[] | null
  mrr: number
  users: number
  newUsers: number | null
  valuation: number | null
  team: number | null
  morale: number | null
  equity: number | null
  /** Market fill 0–1 (written once the market wave lands). */
  penetration: number | null
}

export interface StatsSeries {
  n: number
  lastDay: number | null
  rows: MonthRow[]
}

let calls = 0
/** How many times statsData() rebuilt the series (the memo test counts it). */
export const statsDataCalls = (): number => calls
export const resetStatsDataCalls = (): void => {
  calls = 0
}

/** Receipts → one row per month. */
export function statsData(receipts: readonly ReceiptEntry[] | undefined): StatsSeries {
  calls++
  const list = receipts ?? []
  const rows = list.map((r): MonthRow => {
    if ('partial' in r) {
      return { x: r.day, month: r.month, cash: null, runway: null, revenue: null, costs: null, mrr: r.mrr, users: r.users, newUsers: r.usersDelta, valuation: null, team: null, morale: null, equity: null, penetration: null }
    }
    return {
      x: r.day,
      month: r.month,
      cash: r.cashAfter,
      runway: r.runwayAfter,
      revenue: r.revenue,
      costs: COST_KEYS.map((k) => r[k] ?? 0),
      mrr: r.mrr,
      users: r.users,
      newUsers: r.usersDelta ?? null,
      valuation: r.valuation ?? null,
      team: r.team ?? null,
      morale: r.morale ?? null,
      equity: r.equity ?? null,
      penetration: r.penetration ?? null,
    }
  })
  return { n: list.length, lastDay: list.at(-1)?.day ?? null, rows }
}

/** Memo key: the list only grows (or shifts at the cap) on payday, so count + last payday identify it. */
export function statsKey(receipts: readonly ReceiptEntry[] | undefined): { n: number; lastDay: number | null } {
  return { n: receipts?.length ?? 0, lastDay: receipts?.at(-1)?.day ?? null }
}

/** statsData() behind the key: the same series object until a payday adds a receipt. One per mounted screen. */
export function statsMemo(): (receipts: readonly ReceiptEntry[] | undefined) => StatsSeries {
  let key: string | null = null
  let cached: StatsSeries | null = null
  return (receipts) => {
    const k = statsKey(receipts)
    const next = `${k.n}:${k.lastDay}`
    if (cached && key === next) return cached
    key = next
    cached = statsData(receipts)
    return cached
  }
}

/** The live end of the lines (today, not yet a receipt): read by a small separate selector. */
export interface LiveTip {
  day: number
  cash: number
  mrr: number
  users: number
  valuation: number
  team: number
  morale: number
  /** Months; null = infinite (profitable). */
  runway: number | null
}

const pts = (rows: readonly MonthRow[], f: (r: MonthRow) => number | null): LinePoint[] => rows.map((r) => ({ x: r.x, y: f(r) }))
/** Append today's value when the day is past the last payday. */
const withTip = (line: LinePoint[], day: number, y: number | null): LinePoint[] => (line.length === 0 || day > line.at(-1)!.x ? [...line, { x: day, y }] : line)
const lastBars = (rows: readonly MonthRow[]): MonthRow[] => rows.slice(-BAR_MONTHS)

export interface MoneyView {
  cash: LinePoint[]
  projection: LinePoint[]
  /** First payday cash runs out ("Kasa biter · Gün 412"); null = profitable. */
  deathDay: number | null
  death: { x: number; y: number } | null
  runway: LinePoint[]
  /** Vertical marks: upcoming paydays under the projection, then crisis / board days when the caller has them. */
  marks: { x: number; kind: MarkKind }[]
  /** Last 12 months: [[revenue], [costs…]]. */
  flow: BarGroup[]
}

export type MarkKind = 'payday' | 'crisis' | 'board'

/** Days of the calendar to mark on the cash line (crisis calendar, board quarter ends); wired by the later waves. */
export interface CalendarMarks {
  crisis?: readonly number[]
  board?: readonly number[]
}

/** Paydays the cash projection must span to reach its death day (the engine's default 12 can stop short of it). */
export const PROJECTION_CAP = 36

export function projectionMonths(proj: CashProjection, cap = PROJECTION_CAP): number {
  const n = proj.points.length
  const last = proj.points.at(-1)
  if (proj.deathDay === null || n < 2 || !last || proj.deathDay <= last.day) return n
  const step = proj.points[1]!.day - proj.points[0]!.day
  return step > 0 ? Math.min(cap, n + Math.ceil((proj.deathDay - last.day) / step)) : n
}

export function moneyView(s: StatsSeries, live: LiveTip, proj: CashProjection, calendar: CalendarMarks = {}): MoneyView {
  const deathPoint = proj.deathDay === null ? null : proj.points.find((p) => p.day === proj.deathDay)
  return {
    cash: withTip(pts(s.rows, (r) => r.cash), live.day, live.cash),
    projection: proj.points.map((p) => ({ x: p.day, y: p.cash })),
    deathDay: proj.deathDay,
    death: proj.deathDay === null ? null : { x: proj.deathDay, y: deathPoint?.cash ?? 0 },
    // ∞ (profitable) is not drawn: the line breaks there.
    runway: withTip(pts(s.rows, (r) => r.runway), live.day, live.runway),
    marks: [
      ...proj.points.slice(0, BAR_MONTHS).map((p) => ({ x: p.day, kind: 'payday' as const })),
      ...(calendar.crisis ?? []).map((x) => ({ x, kind: 'crisis' as const })),
      ...(calendar.board ?? []).map((x) => ({ x, kind: 'board' as const })),
    ],
    flow: lastBars(s.rows)
      .filter((r) => r.revenue !== null && r.costs !== null)
      .map((r) => ({ x: r.x, values: [[r.revenue!], r.costs!] })),
  }
}

/**
 * Runway for the tile header: the selected month, else today's. `null` = ∞ (profitable, a real value);
 * `undefined` = not on record (a month rebuilt from a pre-v4 save).
 */
export function runwayAt(s: StatsSeries, live: LiveTip, sel: number | null): { y: number | null | undefined; x: number | null } {
  if (sel !== null) {
    if (sel === live.day) return { y: live.runway, x: sel }
    const r = s.rows.find((q) => q.x === sel)
    if (r) return { y: r.cash === null ? undefined : r.runway, x: sel }
  }
  return { y: live.runway, x: null }
}

/** This month's cost split for the pie (the live burn breakdown, COST_KEYS order). */
export function costSplit(b: BurnBreakdown): number[] {
  return COST_KEYS.map((k) => b[k] ?? 0)
}

export interface GrowthView {
  /** Lead rival's valuation (thin grey line); empty until the rivals wave writes it. */
  rival: LinePoint[]
  mrr: LinePoint[]
  users: LinePoint[]
  valuation: LinePoint[]
  /** Next round's target valuation and where its early window opens (derived.round); null past the last round. */
  target: { value: number; window: number } | null
  /** Monthly new users, last 12 months. */
  newUsers: BarGroup[]
  /** Latest market fill (0–1); null until the engine writes it. */
  penetration: number | null
}

export function growthView(s: StatsSeries, live: LiveTip, round: { target: number; windowAt: number } | null | undefined, rival: readonly LinePoint[] = []): GrowthView {
  const lastPen = [...s.rows].reverse().find((r) => r.penetration !== null)?.penetration ?? null
  return {
    rival: [...rival],
    mrr: withTip(pts(s.rows, (r) => r.mrr), live.day, live.mrr),
    users: withTip(pts(s.rows, (r) => r.users), live.day, live.users),
    valuation: withTip(pts(s.rows, (r) => r.valuation), live.day, live.valuation),
    target: round ? { value: round.target, window: round.windowAt } : null,
    newUsers: lastBars(s.rows)
      .filter((r) => r.newUsers !== null)
      .map((r) => ({ x: r.x, values: [[r.newUsers!]] })),
    penetration: lastPen,
  }
}

export interface TeamView {
  team: LinePoint[]
  morale: LinePoint[]
}

export function teamView(s: StatsSeries, live: LiveTip): TeamView {
  return {
    team: withTip(pts(s.rows, (r) => r.team), live.day, live.team),
    morale: withTip(pts(s.rows, (r) => r.morale), live.day, live.morale),
  }
}

/** People and output per department, one bar group each (x = department index in `depts`). */
export function deptBars(depts: readonly Dept[], counts: Record<Dept, number>, output: Record<Dept, number>): BarGroup[] {
  return depts.map((d, i) => ({ x: i, values: [[counts[d] ?? 0], [output[d] ?? 0]] }))
}

/** Radar polygons in PROFILE_AXES order (company, due-diligence expectation). */
export function profileView(company: CompanyProfile, target: CompanyProfile): { values: (number | null)[]; target: (number | null)[] } {
  return { values: PROFILE_AXES.map((a) => company[a]), target: PROFILE_AXES.map((a) => target[a]) }
}

/** Which charts are still locked tiles: the gauge / tool that names them is not learned yet. */
export function statsLocks(unlockedWidgets: readonly string[], unlockedTools: readonly string[], penetration: number | null) {
  return {
    burn: !unlockedWidgets.includes('burnBreakdown'),
    channels: !unlockedWidgets.includes('channelBreakdown'),
    capTable: !unlockedTools.includes('capTableView'),
    market: penetration === null,
  }
}
