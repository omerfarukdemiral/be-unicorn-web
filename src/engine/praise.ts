// Praise milestones (2026-10-21, content/praise.ts): a run's milestone set against a famous company's number. A row
// is reached (month passed, users / MRR first reached, stage reached), waits behind PRAISE_GAP_DAYS if a praise was
// shown lately (dropped after PRAISE_STALE_DAYS), and shows as a 'praise' notice only when the player is ahead or
// close; else its neutral line, or nothing. Several waiting: the best grade first, the rest wait their turn.
import type { PraiseMeasure, PraiseOn, PraiseRow } from '../content/index'
import { fillTemplate, formatMoney, formatNumber, formatPercent } from '../content/format'
import * as B from './balance'
import { pushNotice } from './notices'
import { DAYS_PER_MONTH, type GameState, type PraiseState } from './types'
import type { EngineContent } from './util'

type Grade = 'ahead' | 'close' | 'neutral'
const RANK: Record<Grade, number> = { ahead: 0, close: 1, neutral: 2 }

function reached(s: GameState, on: PraiseOn): boolean {
  switch (on.kind) {
    case 'month':
      return s.time.day >= on.n * DAYS_PER_MONTH
    case 'users':
      return s.stats.users >= on.n
    case 'mrr':
      return s.finance.mrr >= on.n
    case 'stage':
      return s.stage >= on.n
  }
}

/** The praise state; an older save (or a run without it) counts every row already reached as done (no flood at load). */
export function praiseOf(s: GameState, content: EngineContent): PraiseState {
  if (s.praise) return s.praise
  const done = s.time.day > 0 ? (content.praise ?? []).filter((r) => reached(s, r.on)).map((r) => r.id) : []
  return (s.praise = { done })
}

function lastGrowth(hist: readonly number[]): number {
  const a = hist[hist.length - 2]
  const b = hist[hist.length - 1]
  return a !== undefined && b !== undefined && a > 0 ? b / a - 1 : 0
}

/** The player's value and theirs, formatted, and the grade (null: no line fits). */
function grade(s: GameState, m: PraiseMeasure, reachedDay: number): { grade: Grade | null; you: string; them: string } {
  if (m.kind === 'months') {
    const months = Math.max(1, Math.round(reachedDay / DAYS_PER_MONTH))
    const g: Grade | null = months <= m.months ? 'ahead' : months <= m.months * B.PRAISE_CLOSE_TIME ? 'close' : null
    return { grade: g, you: String(months), them: String(m.months) }
  }
  const v =
    m.metric === 'users' ? s.stats.users : m.metric === 'mrr' ? s.finance.mrr : m.metric === 'usersMoM' ? lastGrowth(s.finance.usersHistory) : lastGrowth(s.finance.mrrHistory)
  const fmt = (x: number) => (m.metric === 'users' ? formatNumber(Math.round(x)) : m.metric === 'mrr' ? formatMoney(Math.round(x)) : formatPercent(x))
  const g: Grade | null = v >= m.value ? 'ahead' : v >= m.value * B.PRAISE_CLOSE_VALUE ? 'close' : null
  return { grade: g, you: fmt(v), them: fmt(m.value) }
}

/** The line a row shows at a grade: close falls back to nothing, null to the neutral line. */
function lineOf(row: PraiseRow, g: Grade | null): { grade: Grade; text: string } | null {
  if (g === 'ahead') return { grade: 'ahead', text: row.ahead }
  if (g === 'close' && row.close) return { grade: 'close', text: row.close }
  return row.neutral ? { grade: 'neutral', text: row.neutral } : null
}

/** Daily (and once more on the Unicorn win, `force`: the last one is not held by the gap). */
export function dailyPraise(s: GameState, content: EngineContent, force = false): void {
  const rows = content.praise ?? []
  if (!rows.length) return
  const st = praiseOf(s, content)
  const day = s.time.day
  const pending = (st.pending ??= {})
  for (const r of rows) if (!st.done.includes(r.id) && pending[r.id] === undefined && reached(s, r.on)) pending[r.id] = day
  for (const [id, at] of Object.entries(pending)) {
    if (day - at <= B.PRAISE_STALE_DAYS) continue
    delete pending[id]
    st.done.push(id)
  }
  const ids = Object.keys(pending)
  if (!ids.length) return void delete st.pending
  if (!force && st.lastDay !== undefined && day - st.lastDay < B.PRAISE_GAP_DAYS) return
  let best: { row: PraiseRow; grade: Grade; text: string } | null = null
  for (const id of ids) {
    const row = rows.find((r) => r.id === id)
    const g = row ? grade(s, row.measure, pending[id]!) : null
    const line = row && g ? lineOf(row, g.grade) : null
    if (!row || !g || !line) {
      // Nothing to say about this one: it passes quietly.
      delete pending[id]
      st.done.push(id)
      continue
    }
    if (!best || RANK[line.grade] < RANK[best.grade]) best = { row, grade: line.grade, text: fillTemplate(line.text, { you: g.you, them: g.them }) }
  }
  if (!best) return
  delete pending[best.row.id]
  st.done.push(best.row.id)
  st.lastDay = day
  pushNotice(s, { kind: 'praise', tone: best.grade === 'neutral' ? 'neutral' : 'good', text: best.text, praiseId: best.row.id, grade: best.grade })
}
