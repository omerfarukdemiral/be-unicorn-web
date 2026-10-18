// Core loop UI helpers (docs/CORE_LOOP.md): fresh engine events, effect summaries, next-step navigation.
// Presentation only: every number comes from the engine (state.derived / finance / releases / outcomes).
import { useEffect, useRef } from 'react'
import type { EffectBundle, GameEvent, GameState, NextMove, NextStep, ValuationBreakdown } from '../engine/types'
import { moveAction } from '../engine/loopSelectors'
import { moduleOffers } from '../engine/modules'
import { growthAsk, investorGrowth } from '../engine/round'
import * as B from '../engine/balance'
import { valuation } from '../engine/economy'
import { cacFactors, type CacFactor } from '../engine/ads'
import { CRISES, DECISIONS, moduleName, POLICIES, PRICING_GATE, STAGES, UI_TEXT } from '../content'
import { withCase } from '../content/format'
import { useGameStore } from '../store/gameStore'
import { t } from './i18n'
import { fixed, money, num, pct, signedMoney } from './format'

/**
 * Calls `onEvents` with engine events newer than the last call. The first sight of a run (mount, new game,
 * loaded save) skips the history, so a reload never replays old moments.
 */
export function useFreshEvents(onEvents: (events: GameEvent[], state: GameState) => void): void {
  const events = useGameStore((s) => s.state.events)
  const generation = useGameStore((s) => s.ui.generation)
  const cursor = useRef<{ generation: number; id: number } | null>(null)
  const cb = useRef(onEvents)
  cb.current = onEvents
  useEffect(() => {
    const maxId = events[events.length - 1]?.id ?? 0
    const c = cursor.current
    if (!c || c.generation !== generation || maxId < c.id) {
      cursor.current = { generation, id: maxId }
      return
    }
    const fresh = events.filter((e) => e.id > c.id)
    c.id = maxId
    if (fresh.length) cb.current(fresh, useGameStore.getState().state)
  }, [events, generation])
}

const signed = (v: number, f: (x: number) => string = num): string => (v > 0 ? `+${f(v)}` : v < 0 ? `−${f(-v)}` : f(0))

/** "+$1.5K, +50 kullanıcı, moral +5": the visible parts of an effect bundle. */
export function effectSummary(fx: EffectBundle): string {
  const parts: string[] = []
  if (fx.cash) parts.push(signedMoney(fx.cash).replace('-', '−'))
  if (fx.cashPercent) parts.push(t('fx.cashPercent', { v: signed(fx.cashPercent, (x) => pct(x)) }))
  if (fx.users) parts.push(t('fx.users', { v: signed(fx.users) }))
  if (fx.usersPercent) parts.push(t('fx.users', { v: signed(fx.usersPercent, (x) => pct(x)) }))
  if (fx.morale) parts.push(t('fx.morale', { v: signed(fx.morale, (x) => fixed(x, 0)) }))
  if (fx.reputation) parts.push(t('fx.reputation', { v: signed(fx.reputation, (x) => fixed(x, 0)) }))
  if (fx.maturity) parts.push(t('fx.maturity', { v: signed(fx.maturity, (x) => pct(x)) }))
  if (fx.techDebt) parts.push(t('fx.techDebt', { v: signed(fx.techDebt, (x) => fixed(x, 0)) }))
  if (fx.energy) parts.push(t('fx.energy', { v: signed(fx.energy, (x) => fixed(x, 0)) }))
  if (fx.equity) parts.push(t('fx.equity', { v: signed(fx.equity, (x) => pct(x, 1)) }))
  if (fx.roundWeeks) parts.push(t('fx.roundWeeks', { v: signed(fx.roundWeeks) }))
  if (fx.modifiers?.length) parts.push(t('fx.modifier'))
  return parts.length ? parts.join(', ') : t('fx.other')
}

/** Short label of a card option ("Yan iş al"), for "Kararın → sonucu" lines. */
export function optionLabel(cardId: string | undefined, optionIndex: number | undefined): string | null {
  if (cardId === undefined) return null
  const card = DECISIONS.find((c) => c.id === cardId)
  const opt = card?.options[optionIndex ?? 0]
  return opt?.label ?? null
}

export function releaseLevelName(level: number): string {
  return t(`release.level.${Math.max(1, Math.min(5, Math.round(level)))}`)
}

/**
 * How valuation is built right now (engine derived.valuationParts), one line:
 * pre-revenue "1 yayında × $150K + 300 kullanıcı × $400 + 5 sürüm × $15K", else "MRR $22K × 12 × 18× (büyüme %13)".
 */
export function valuationLine(v: ValuationBreakdown | undefined): string {
  if (!v) return ''
  if (v.mode === 'pre') {
    return t('val.pre', { l: num(v.launched), lv: money(v.launchedValue), u: num(v.users), uv: money(v.usersValue), r: num(v.releases), rv: money(v.releasesValue) })
  }
  const key = v.blend >= 1 ? 'val.post' : v.preFade > 0 ? 'val.postFade' : 'val.postBlend'
  return t(key, { m: money(v.mrr), x: fixed(v.multiple, 1), g: pct(v.momAvg, 1), n: fixed(v.min, 1), c: fixed(v.cap, 0), b: pct(v.blend, 0), p: money(v.preFade) })
}

/**
 * What `extra` pre-revenue value (a launch, a release) adds to the valuation today, through the engine's own formula:
 * the full amount before revenue, × (1 − blend) once the floor fades from Seed, ~0 when revenue already outweighs it.
 */
function preGain(v: ValuationBreakdown | undefined, stage: number, extra: number): number {
  if (!v) return 0
  const pre = v.usersValue + v.launchedValue + v.releasesValue
  return Math.max(0, valuation(v.mrr, v.multiple, pre + extra, stage) - valuation(v.mrr, v.multiple, pre, stage))
}

/** Valuation one more launched product adds now (playtest LD2: the tag on a new project). */
export function launchGain(v: ValuationBreakdown | undefined, stage: number): number {
  return preGain(v, stage, B.VAL_PER_LAUNCHED)
}

/** Valuation one more release adds now; 0 once VAL_RELEASE_MAX releases count. */
export function releaseGain(v: ValuationBreakdown | undefined, stage: number): number {
  return v && v.releases < B.VAL_RELEASE_MAX ? preGain(v, stage, B.VAL_PER_RELEASE) : 0
}

/**
 * Version name ("MVP", "v0.4"… "v1"), "v2" for a version release, "v2.1" for an update inside a line (MV2c; saves from
 * before it: "güncelleme N"), or "{module} yayında" for a module delivery (name already resolved).
 */
export function releaseName(level: number, update?: number, module?: string, version?: number, minor?: number): string {
  if (module) return t('release.module', { module })
  if (version !== undefined && (level >= 5 || minor !== undefined)) return minor !== undefined ? t('release.minor', { v: version, m: minor }) : t('module.version', { v: version })
  return update !== undefined && update > 0 ? t('release.update', { n: update }) : releaseLevelName(level)
}

/** Chip text for a step (money / % filled from the engine's progress + target); a concrete move speaks instead. */
export function stepText(step: NextStep, s: GameState): string {
  if (step.move) return moveText(step.move, s)
  switch (step.id) {
    case 'launch':
      return t('step.launch', { v: pct(step.progress ?? 0) })
    case 'users':
      return t('step.users', { v: num(s.stats.users), t: num(step.target ?? 0) })
    case 'revenue':
      return t('step.revenue', { v: money(s.finance.mrr), t: money(step.target ?? 0) })
    case 'grow':
      return t('step.grow', { v: money(s.finance.valuation), t: money(step.target ?? 0) })
    case 'traction':
      // Pre-revenue valuation is users + launches + releases: the chip shows the way to the round window.
      return t('step.traction', { v: money(s.finance.valuation), t: money(step.target ?? 0) })
    default:
      return t(`step.${step.id}`)
  }
}

/**
 * Phone strip (N9): a short label and the number apart, so the number never truncates. A step without a short text
 * (a newer step) falls back to its full sentence as the label.
 */
export function stepShort(step: NextStep, s: GameState): { label: string; value?: string } {
  if (step.move) return moveShort(step.move, s)
  const key = `step.short.${step.id}`
  const label = UI_TEXT[key] !== undefined ? t(key) : stepText(step, s)
  const of = (v: string, tg: string) => t('step.short.of', { v, t: tg })
  switch (step.id) {
    case 'launch':
      return { label, value: pct(step.progress ?? 0) }
    case 'users':
      return { label, value: of(num(s.stats.users), num(step.target ?? 0)) }
    case 'revenue':
      return { label, value: of(money(s.finance.mrr), money(step.target ?? 0)) }
    case 'grow':
    case 'traction':
      return { label, value: of(money(s.finance.valuation), money(step.target ?? 0)) }
    default:
      return { label }
  }
}

/** The move's sentence, with the number the tap spends (engine moveAction picks it). */
export function moveText(move: NextMove, s: GameState): string {
  const a = moveAction(s, move)
  switch (move) {
    case 'ads':
      return t('move.ads', { v: money(a?.type === 'setAdBudget' ? a.amount : 0) })
    case 'module': {
      if (a?.type !== 'buildModule') return t('move.module', { m: '', v: '' })
      const p = s.projects.find((x) => x.id === a.projectId)
      const offer = p ? moduleOffers(s, p).find((o) => o.id === a.moduleId) : undefined
      return t('move.module', { m: moduleName(a.moduleId, p?.category), v: money(offer?.cost ?? 0) })
    }
    default:
      return t(`move.${move}`)
  }
}

/** Phone strip: the move's short word, and the money the tap spends on line 2 (N9 + fix round 3 moves). */
export function moveShort(move: NextMove, s: GameState): { label: string; value?: string } {
  const label = t(`move.short.${move}`)
  const a = moveAction(s, move)
  switch (move) {
    case 'ads':
      return { label, value: t('move.short.perMonth', { v: money(a?.type === 'setAdBudget' ? a.amount : 0) }) }
    case 'growthAsk':
      // The round's ask on line 2: the investor's growth now over what they want ("%4/%8").
      return { label, value: t('step.short.of', { v: pct(investorGrowth(s)), t: pct(growthAsk(s)) }) }
    case 'module': {
      if (a?.type !== 'buildModule') return { label }
      const p = s.projects.find((x) => x.id === a.projectId)
      const offer = p ? moduleOffers(s, p).find((o) => o.id === a.moduleId) : undefined
      return { label, value: money(offer?.cost ?? 0) }
    }
    default:
      return { label }
  }
}

/** One condition of the price lock: the live figure, the bar, met or not. */
export interface GateCheck {
  value: number
  bar: number
  ok: boolean
}

/**
 * Büyüme price lock (DECISIONS #9): price control opens only when the player opens the `pricing` card. The trigger
 * needs Seed + the three checks on the same day (priceMultiplier ≤ 1 holds while the tool is locked); `waiting` =
 * the card already came (bubble on screen or shelved) but was never opened, so the lock points at it.
 */
export function priceGate(s: Pick<GameState, 'stage' | 'stats' | 'derived' | 'concepts'>): {
  stage: boolean
  users: GateCheck
  maturity: GateCheck
  churn: GateCheck
  waiting: boolean
} {
  return {
    stage: s.stage >= 2,
    users: { value: s.stats.users, bar: PRICING_GATE.users, ok: s.stats.users > PRICING_GATE.users },
    maturity: { value: s.derived.avgMaturity, bar: PRICING_GATE.maturity, ok: s.derived.avgMaturity >= PRICING_GATE.maturity },
    churn: { value: s.stats.churn, bar: PRICING_GATE.churn, ok: s.stats.churn < PRICING_GATE.churn },
    waiting: s.concepts.triggered.includes('pricing') && !s.concepts.learned.includes('pricing'),
  }
}

export type StepGo = 'projects' | 'shop' | 'team' | 'growth' | 'act'

export function stepGo(step: NextStep): StepGo {
  switch (step.id) {
    case 'idea':
    case 'launch':
      return 'projects'
    case 'desk':
      return 'shop'
    case 'hire':
      return 'team'
    case 'findUsers':
    case 'users':
    case 'traction':
      return 'act'
    default:
      return 'growth'
  }
}

/** Chip click: opens the panel of the step (the targeted shop highlights the empty desk slot in the scene). */
/**
 * The bubble that holds the round meeting now: the investor's visitor bubble when they came in, else the desk's pitch
 * bubble (same keys as render/WorldBubbles). null when no pitch is due.
 */
export function meetingBubbleKey(s: Pick<GameState, 'round' | 'visitors'>): string | null {
  if (!s.round?.active || s.round.pitchDue == null) return null
  const v = s.visitors.find((x) => x.purpose === 'round')
  return v ? `visitor:pitch:${v.id}` : 'desk:pitch'
}

export function followStep(step: NextStep): void {
  const { openPanel, dispatch, state } = useGameStore.getState()
  if (step.move) {
    // The chip names one move: the tap does it; if the engine refuses, the place where it lives opens.
    // The round meeting is a choice to read: the tap opens the meeting itself (its bubble), not a panel.
    if (step.move === 'pitch') {
      const key = meetingBubbleKey(state)
      if (key) {
        const st = useGameStore.getState()
        if (st.ui.panel) st.closePanel()
        return st.setBubbleOpen(key)
      }
      return openPanel({ kind: 'growth', section: 'round' }, { root: true })
    }
    const a = moveAction(state, step.move)
    if (a && dispatch(a).ok) return
    return openPanel(step.move === 'module' ? { kind: 'projects' } : { kind: 'growth' }, { root: true })
  }
  switch (stepGo(step)) {
    case 'projects':
      return openPanel({ kind: 'projects' }, { root: true })
    case 'shop':
      return openPanel(step.slotId ? { kind: 'shop', slotTarget: step.slotId } : { kind: 'shop' }, { root: true })
    case 'team':
      return openPanel({ kind: 'team' }, { root: true })
    case 'act': {
      // The founder's focus on finding users (fix round 1: it repeats on its own); already there: the growth numbers.
      if (state.founder.focus !== 'users' && dispatch({ type: 'setFounderFocus', focus: 'users' }).ok) return
      return openPanel({ kind: 'growth' }, { root: true })
    }
    case 'growth':
      return openPanel(step.id === 'round' || step.id === 'roundWait' ? { kind: 'growth', section: 'round' } : { kind: 'growth' }, { root: true })
  }
}

/**
 * A1: why the CAC is what it is, one line (≤ 8 words): the biggest factor at or above CAC_REASON_MIN that has words
 * ("CAC ×1.6: Reklam savaşı", "CAC ×1.4: bütçe MRR'ı aştı, reklam doyuyor"). A top factor with nothing to name (a module
 * mix without one module behind it, a policy that is not adopted) hands the line to the next one. null when nothing
 * stands out.
 */
export function cacReasonText(s: GameState): string | null {
  // cacFactors lists in the tie order (crisis > spend > … > policy); the sort is stable, so equal values keep it.
  const big = cacFactors(s)
    .filter((f) => f.value >= B.CAC_REASON_MIN - 1e-9)
    .sort((a, b) => (Math.abs(a.value - b.value) < 1e-9 ? 0 : b.value - a.value))
  for (const f of big) {
    const text = cacFactorText(s, f)
    if (text) return text
  }
  return null
}

function cacFactorText(s: GameState, r: CacFactor): string | null {
  const f = fixed(r.value, 1)
  switch (r.key) {
    case 'crisis': {
      const src = r.source ?? ''
      const crisis = CRISES.find((c) => `crisis:${c.id}` === src || c.cardId === src)
      return crisis ? t('ads.cac.crisis', { f, name: crisis.name }) : t('ads.cac.card', { f })
    }
    case 'spend':
      // "aştı" only when it did: a budget under the MRR still saturates (the curve starts well below it).
      return t(s.finance.adBudget > s.finance.mrr ? 'ads.cac.spend' : 'ads.cac.spendBig', { f })
    case 'market':
      return t('ads.cac.market', { f, p: Math.round((r.pen ?? 0) * 100) })
    case 'focus':
      return t('ads.cac.focus', { f, d: r.days ?? 1 })
    case 'maturity':
      return t('ads.cac.maturity', { f })
    case 'stage':
      return t('ads.cac.stage', { f, stage: withCase(STAGES[s.stage]?.name ?? '', 'loc') })
    case 'category':
      // A category only ever lowers the CAC (web 0.85): never the reason it is high.
      return null
    case 'modules':
      return r.module ? t('ads.cac.modules', { f, module: moduleName(r.module) }) : null
    case 'policy': {
      const adopted = s.derived.policies?.adopted ?? []
      const pol = POLICIES.find((p) => adopted.includes(p.id) && (p.effect.mult?.cac ?? 1) > 1)
      return pol ? t('ads.cac.policy', { f, policy: pol.name }) : null
    }
  }
}
