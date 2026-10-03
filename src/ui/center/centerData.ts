// Center screens' data (docs/GAMEPLAY_V2.md §7.2, §8.1–8.4, §10.5): the Kanun Kitabı, the market map, and the Büyüme
// rows that lead to them (Kurul, renewals, the one-line summaries). Pure and tested (centerData.test.ts): nothing here
// is a game formula. The engine prices and gates every verb (derived.policies / market / board / renewals,
// policyError); this file only sorts those numbers into cards, tiles and rows, and counts days left.
import { applyAction } from '../../engine'
import { POLICY_MIN_STAGE, POLICY_SIGN_COOLDOWN_DAYS } from '../../engine/balance'
import { payLaterOpen } from '../../engine/util'
import type {
  ActionErrorCode,
  BoardView,
  GameState,
  MarketView,
  PoliciesView,
  PolicyId,
  RenewalView,
  Rival,
  SegmentView,
  StageIndex,
  ToolId,
} from '../../engine/types'
import type { Policy, PolicyLock, PolicyTree } from '../../content/types'

// ---------------------------------------------------------------------------
// Kanun Kitabı (§7.2)
// ---------------------------------------------------------------------------

/** Column order of the book: the runway's tree first (it is the one that opens under pressure). */
export const LAW_TREES: readonly PolicyTree[] = ['survival', 'growth', 'craft', 'org']

/**
 * 'signed': in force for good; 'open': can be signed (a missing move still shows as open, the button carries the
 * error); 'wait': the signing cooldown runs; 'locked': a lock holds (silhouette + the lock as a number);
 * 'closed': a signed policy excludes it (or it excludes a signed one), or a deferred-pay law past its last round.
 */
export type LawStatus = 'signed' | 'open' | 'wait' | 'locked' | 'closed'

export interface LawCard {
  id: PolicyId
  tree: PolicyTree
  tier: number
  name: string
  text: string
  status: LawStatus
  /** The lock that holds now: the book's own stage gate (POLICY_MIN_STAGE) before the law's lock. */
  lock: PolicyLock
  /** policyError's answer (null = the signature goes through). */
  error: ActionErrorCode | null
  /** A survival signature prices every later round's equity (POLICY_SURVIVAL_EQUITY). */
  survival: boolean
}

export interface LawbookView {
  trees: { tree: PolicyTree; cards: LawCard[] }[]
  signed: number
  total: number
  /** Days until the next signature (0 = now) over the cooldown: the ring. */
  wait: { left: number; total: number }
}

/**
 * policyError's 'notUnlocked' has three causes (actions.ts): the book's stage gate, a deferred-pay law with no round
 * left to pay it back (payLaterOpen), and the law's own lock. The card shows the one that holds.
 */
function lawState(p: Policy, signed: boolean, error: ActionErrorCode | null, s: GameState): { status: LawStatus; lock: PolicyLock } {
  const own = { status: 'locked' as const, lock: p.lock }
  if (signed) return { status: 'signed', lock: p.lock }
  if (error === null || error === 'noMoves') return { status: 'open', lock: p.lock }
  if (error === 'cooldown') return { status: 'wait', lock: p.lock }
  if (error === 'invalid') return { status: 'closed', lock: p.lock }
  if (error !== 'notUnlocked') return own
  if (p.effect.payLater && !payLaterOpen(s)) return { status: 'closed', lock: p.lock }
  if (s.stage < POLICY_MIN_STAGE && !(p.lock.metric === 'stage' && p.lock.value >= POLICY_MIN_STAGE)) return { status: 'locked', lock: { metric: 'stage', value: POLICY_MIN_STAGE } }
  return own
}

/** Days left from `day` until `until` (whole days, never negative). */
export function daysLeft(until: number, day: number): number {
  return Math.max(0, Math.ceil(until - day))
}

export function lawbookView(policies: readonly Policy[], view: PoliciesView | undefined, errorOf: (id: PolicyId) => ActionErrorCode | null, s: GameState): LawbookView {
  const adopted = view?.adopted ?? []
  const cards = policies.map((p): LawCard => {
    const signed = adopted.includes(p.id)
    const error = signed ? null : errorOf(p.id)
    return { id: p.id, tree: p.tree, tier: p.tier, name: p.name, text: p.text, ...lawState(p, signed, error, s), error, survival: p.tree === 'survival' }
  })
  return {
    trees: LAW_TREES.map((tree) => ({ tree, cards: cards.filter((c) => c.tree === tree).sort((a, b) => a.tier - b.tier) })).filter((g) => g.cards.length > 0),
    signed: adopted.length,
    total: policies.length,
    wait: { left: view ? daysLeft(view.nextSignDay, s.time.day) : 0, total: POLICY_SIGN_COOLDOWN_DAYS },
  }
}

/**
 * What a signature does to the monthly burn: the engine signs it on a copy (applyAction clones) and the two burns are
 * compared. 0 when it cannot be signed now. The CostPreview input of "İmzala" (salary, rent, founder pay, a layoff).
 */
export function signBurnDelta(s: GameState, id: PolicyId): number {
  const r = applyAction(s, { type: 'adoptPolicy', policyId: id })
  return r.ok ? r.state.finance.burn - s.finance.burn : 0
}

// ---------------------------------------------------------------------------
// Pazar haritası (§8.1–8.2)
// ---------------------------------------------------------------------------

/** 'open': in the TAM (ramping in); 'ready': its stage is here, the button decides (cash / moves); 'locked': silhouette. */
export type SegmentStatus = 'open' | 'ready' | 'locked'

export interface SegmentTile extends SegmentView {
  status: SegmentStatus
}

export function segmentTiles(view: MarketView | undefined): SegmentTile[] {
  return (view?.segments ?? []).map((s) => ({
    ...s,
    status: s.open ? 'open' : s.error === null || s.error === 'insufficientCash' || s.error === 'noMoves' ? 'ready' : 'locked',
  }))
}

export interface RivalRow {
  id: string
  name: string
  share: number
  valuation: number
  /** Valuation over the largest on the board (the player's included): the bar's width, 0–1. */
  bar: number
  ahead: boolean
  /** rivals[0]: the lead that paces the player's valuation. */
  lead: boolean
  price: number
  users: number
  error: ActionErrorCode | null
}

/** Rivals still in the market with their M&A price (engine view), and the player's own bar on the same scale. */
export function rivalRows(view: MarketView | undefined, rivals: readonly Rival[] | undefined, playerValuation: number): { rows: RivalRow[]; you: number } {
  const list = rivals ?? []
  const priced = (view?.rivals ?? []).flatMap((a) => {
    const r = list.find((x) => x.id === a.id)
    return r ? [{ a, r }] : []
  })
  const top = Math.max(1, playerValuation, ...priced.map(({ r }) => r.valuation))
  return {
    rows: priced.map(({ a, r }) => ({
      id: r.id,
      name: r.name,
      share: r.share,
      valuation: r.valuation,
      bar: Math.max(0, r.valuation) / top,
      ahead: !!r.ahead,
      lead: r === list[0],
      price: a.price,
      users: a.users,
      error: a.error,
    })),
    you: Math.max(0, playerValuation) / top,
  }
}

// ---------------------------------------------------------------------------
// Büyüme rows (§10.5): one line per center screen, the board, the renewals
// ---------------------------------------------------------------------------

export interface CenterSummary {
  /** Policies signed, days until the next signature (0 = now). */
  policies: number
  waitDays: number
  /** Market fill 0–1 and the segments open. */
  pen: number
  segments: number
}

export function centerSummary(policies: PoliciesView | undefined, market: MarketView | undefined, penetration: number | undefined, day: number): CenterSummary {
  return {
    policies: policies?.adopted.length ?? 0,
    waitDays: policies ? daysLeft(policies.nextSignDay, day) : 0,
    pen: penetration ?? 0,
    segments: (market?.segments ?? []).filter((s) => s.open).length,
  }
}

export interface BoardRowView {
  target: number
  mrr: number
  /** Days to the quarter's end. */
  days: number
  /** MRR over the target, 0–1 (the bar). */
  progress: number
  missed: number
  streak: number
  penalty: boolean
}

export function boardRow(b: BoardView | undefined, day: number): BoardRowView | null {
  if (!b) return null
  const progress = b.targetMrr > 0 ? Math.min(1, Math.max(0, b.mrr / b.targetMrr)) : 1
  return { target: b.targetMrr, mrr: b.mrr, days: daysLeft(b.endDay, day), progress, missed: b.missed, streak: b.streak, penalty: b.penalty }
}

export interface RenewalRow extends RenewalView {
  days: number
  /** What each offer does to the monthly burn if it lands (revenue up = burn down): the CostPreview input. */
  holdBurn: number
  discountBurn: number
  /** A failed hold: the contract leaves now and its whole MRR with it (renewContract). */
  failBurn: number
}

export function renewalRows(list: readonly RenewalView[] | undefined, day: number): RenewalRow[] {
  return (list ?? []).map((r) => ({ ...r, days: daysLeft(r.untilDay, day), holdBurn: r.mrr - r.holdMrr, discountBurn: r.mrr - r.discountMrr, failBurn: r.mrr }))
}

// ---------------------------------------------------------------------------
// Dock: locked tool silhouettes (§8.5, §9.4)
// ---------------------------------------------------------------------------

/** The late tools the Dock teases as grey silhouettes until their stage opens them. */
export const TEASED_TOOLS: readonly ToolId[] = ['segments', 'refactor', 'renewal', 'mna']

/**
 * Locked late tools whose stage is the next one (a teaser of what the next round brings), with that stage.
 * `stages` = content STAGES (unlockTools per stage).
 */
export function lockedTools(stages: readonly { unlockTools?: readonly ToolId[] }[], unlocked: readonly ToolId[], stage: number): { id: ToolId; stage: StageIndex }[] {
  const out: { id: ToolId; stage: StageIndex }[] = []
  for (const id of TEASED_TOOLS) {
    if (unlocked.includes(id)) continue
    const at = stages.findIndex((s) => s.unlockTools?.includes(id))
    if (at > stage && at <= stage + 1) out.push({ id, stage: at as StageIndex })
  }
  return out
}
