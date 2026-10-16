// Module offers as numbers the player can weigh (design §2): the estimate chips of an offer card, the relation chip,
// the measured line of a built slot, the version line of a project card. Pure (state in, chips / strings out): the
// panel, the desk bubble and the tests read the same helpers. The numbers are the engine's (moduleEstimate,
// moduleMeasured, moduleHeadlines); this file only picks which ones to show and in what unit.
import { CONTENT, MODULE_TEXT, moduleName } from '../../content'
import * as B from '../../engine/balance'
import { actionEnergy } from '../../engine/founder'
import { buildStatus, slotsAt, moduleEstimate, moduleHeadlines, moduleLock, moduleMeasured, moduleUpkeepHint, projectVersion, versionProgress, type ModuleEstimate, type ModuleHeadline, type ModuleOffer } from '../../engine/modules'
import type { GameState, ModuleEffectKind, Project, ProjectModule, ProjectModuleId } from '../../engine/types'
import type { Chip } from '../EffectChips'
import { money, num, pct } from '../format'
import { t } from '../i18n'
import type { IconName } from '../icons'

export const KIND_ICON: Record<ModuleEffectKind, IconName> = {
  churn: 'leak',
  arpu: 'coin',
  organic: 'trend',
  cac: 'magnet',
  tam: 'globe',
  wave: 'rocket',
  updateWork: 'hourglass',
  talk: 'chat',
  infra: 'cloud',
}

/** "+6" / "−2" with the number formatter of the unit. */
const signed = (v: number, f: (x: number) => string): string => (v < 0 ? `−${f(-v)}` : `+${f(v)}`)

/** A headline multiplier as a percent chip: "Churn −%6" (green), "ARPU −%5" (red). The fallback when there is no better unit. */
export function headlineChip(h: ModuleHeadline, title: string): Chip {
  const text = h.mult < 1 ? `−${pct(1 - h.mult)}` : `+${pct(h.mult - 1)}`
  return { icon: KIND_ICON[h.kind], label: t(`module.tag.${h.kind}`), text, good: h.good, title }
}

/** What a build costs the founder besides cash: one move, or 10 energy in the garage (no move budget there). */
export function founderBuildCost(s: GameState): { icon: IconName; text: string } {
  return s.derived.moves ? { icon: 'flag', text: '1' } : { icon: 'bolt', text: String(actionEnergy(s, B.MODULE_ENERGY)) }
}

/** Cash now, the days it takes as the tail. The same chip in the panel and in the desk bubble. */
export function costChip(offer: Pick<ModuleOffer, 'cost' | 'days'>): Chip {
  return { icon: 'cash', label: t('fx.tag.cash'), text: `−${money(offer.cost)}`, ...(offer.days !== null ? { tail: t('module.daysEta', { d: offer.days }) } : {}), good: false, title: t('hud.cash') }
}

/** The one-line unit of the gain: users a month, dollars a month, or the kind's own number. */
function gainChip(s: GameState, est: ModuleEstimate, gain: ModuleHeadline | undefined, title: string): Chip | null {
  const usersMoney = est.users * s.stats.arpu
  const dollars = est.mrr + est.infra
  const icon = gain ? KIND_ICON[gain.kind] : 'trend'
  const fullTitle = gain ? `${title} (${t(`module.tag.${gain.kind}`)} ${gain.mult < 1 ? `−${pct(1 - gain.mult)}` : `+${pct(gain.mult - 1)}`})` : title
  const chip = (text: string, good: boolean | null): Chip => ({ icon, label: '', text, good, title: fullTitle })
  if (Math.abs(est.users) >= 0.5 && Math.abs(usersMoney) >= Math.abs(dollars)) return chip(t('module.est.users', { n: signed(Math.round(est.users), num) }), est.users > 0)
  if (Math.abs(dollars) >= 1) return chip(t('module.est.money', { v: signed(Math.round(dollars), (x) => money(x)) }), dollars > 0)
  if (Math.abs(est.users) >= 0.5) return chip(t('module.est.users', { n: signed(Math.round(est.users), num) }), est.users > 0)
  if (Math.abs(est.tam) >= 1 && gain?.kind === 'tam') return chip(t('module.est.tam', { n: signed(Math.round(est.tam), num) }), est.tam > 0)
  if (gain?.kind === 'wave' && Math.abs(est.wave) >= 0.5) return chip(t('module.est.wave', { n: signed(Math.round(est.wave), num) }), est.wave > 0)
  if (gain?.kind === 'updateWork') return chip(t('module.est.fast', { p: Math.round((1 - gain.mult) * 100) }), gain.mult < 1)
  if (gain?.kind === 'talk') return chip(t('module.est.talk', { n: `+${pct(gain.mult - 1)}` }), gain.mult > 1)
  return null
}

/** The main minus in absolute terms when the estimate carries it, else the percent chip of its kind. */
function minusChip(est: ModuleEstimate, minus: ModuleHeadline, title: string): Chip {
  const userKind = minus.kind === 'organic' || minus.kind === 'cac' || minus.kind === 'churn' || minus.kind === 'wave'
  if (userKind && est.users < -0.5) return { icon: KIND_ICON[minus.kind], label: '', text: t('module.est.users', { n: signed(Math.round(est.users), num) }), good: false, title }
  if ((minus.kind === 'arpu' || minus.kind === 'infra') && est.mrr + est.infra < -1) return { icon: KIND_ICON[minus.kind], label: '', text: t('module.est.money', { v: signed(Math.round(est.mrr + est.infra), (x) => money(x)) }), good: false, title }
  return headlineChip(minus, title)
}

/** "Kira $200/ay", or "Kira kazançtan büyük" (red) when the upkeep outweighs everything the module brings. */
export function rentChip(s: GameState, est: ModuleEstimate, title: string): Chip | null {
  if (est.upkeep < 1) return null
  const gain = est.users * s.stats.arpu + est.mrr + est.infra
  const rent = `${money(est.upkeep)}/${t('bubble.month')}`
  if (est.upkeep > Math.max(0, gain)) return { icon: 'building', label: '', text: t('module.est.rentBig'), tail: rent, good: false, title }
  return { icon: 'building', label: '', text: t('module.est.rent', { v: money(est.upkeep) }), good: false, title }
}

/** Why a module that brings nothing today brings nothing ("Şu an etkisi yok" + the reason as its tail). */
function noEffectChip(est: ModuleEstimate, title: string): Chip {
  return { icon: 'pause', label: '', text: t('module.est.none'), tail: t(`module.est.why.${est.zero}`), good: null, title }
}

/** The relation chip: a synergy (green) with the partner the module is stronger with. */
export function relationChip(p: Project, est: ModuleEstimate): Chip | null {
  if (!est.synergy) return null
  const name = moduleName(est.synergy.with, p.category)
  const text = t('module.rel.synergy', { module: name, p: est.synergy.pct })
  return { icon: 'branch', label: '', text, good: true, title: text }
}

/** The lock of a module not open yet, as a grey chip: "v3 ile açılır", "Önce Analitik", "Paywall varken olmaz". */
export function lockChip(s: GameState, p: Project, id: ProjectModuleId): Chip | null {
  const lock = moduleLock(s, p, id)
  if (!lock) return null
  const text =
    lock.kind === 'version'
      ? t('module.lockVersion', { v: lock.v })
      : lock.kind === 'requires'
        ? t('module.lockRequires', { module: lock.ids.map((x) => moduleName(x, p.category)).join(', ') })
        : t('module.lockExcluded', { module: moduleName(lock.by, p.category) })
  return { icon: 'lock', label: '', text, good: null, title: text }
}

/**
 * The offer card's chips (design §2.1): headline gain in its own unit (or "Şu an etkisi yok"), the main minus or the
 * rent ("Kira kazançtan büyük"), the cost with the days, then an optional synergy chip (the desk bubble leaves it out:
 * three chips there). The percent stays in the title.
 */
export function buildChips(s: GameState, p: Project, offer: ModuleOffer, withRelation = true): Chip[] {
  const title = MODULE_TEXT[offer.id].line
  const { gain, minus } = moduleHeadlines(offer.id, p.category)
  const est = moduleEstimate(s, p, offer.id, CONTENT)
  const out: Chip[] = []
  const first = est.zero ? noEffectChip(est, title) : gainChip(s, est, gain, title)
  if (first) out.push(first)
  else if (gain) out.push(headlineChip(gain, title))
  const rent = rentChip(s, est, title)
  if (rent && est.upkeep > Math.max(0, est.users * s.stats.arpu + est.mrr + est.infra)) out.push(rent)
  else if (minus) out.push(minusChip(est, minus, title))
  else if (rent) out.push(rent)
  else {
    const up = moduleUpkeepHint(s, p, offer.id)
    if (up > 0) out.push({ icon: 'building', label: '', text: t('module.est.rent', { v: money(up) }), good: false, title })
  }
  out.push(costChip(offer))
  const rel = withRelation ? relationChip(p, est) : null
  if (rel) out.push(rel)
  return out
}

/** The chips of a row still locked: the lock, then what it would do in the module's own percent. */
export function lockedChips(s: GameState, p: Project, id: ProjectModuleId): Chip[] {
  const out: Chip[] = []
  const lock = lockChip(s, p, id)
  if (lock) out.push(lock)
  const { gain } = moduleHeadlines(id, p.category)
  if (gain) out.push(headlineChip(gain, MODULE_TEXT[id].line))
  return out
}

// Measured effect (design §2.2) ----------------------------------------------------------------------------------

export interface MeasuredLine {
  text: string
  /** true = better than before, false = worse, null = nothing to compare with (yet). */
  good: boolean | null
}

/** Mean gap in days between the project's releases (updates) inside [from, to); null under two of them. */
function releaseGap(s: GameState, p: Project, from: number, to: number): number | null {
  const days = (s.releases ?? []).filter((r) => r.projectId === p.id && !r.module && r.update !== undefined && r.day >= from && r.day < to).map((r) => r.day)
  if (days.length < 2) return null
  return Math.round((days[days.length - 1]! - days[0]!) / (days.length - 1))
}

/**
 * One line under a built slot: what the product really gained since the module shipped against its rate before.
 * churn → people lost, arpu → revenue, organic / cac / wave / tam → users acquired, infra → the counterfactual, update
 * work / talk → the gap between updates. null when the module has no base (built before MV2a) or nothing is measurable.
 */
export function measuredLine(s: GameState, p: Project, m: ProjectModule): MeasuredLine | null {
  const kind = moduleHeadlines(m.id, p.category).gain?.kind
  if (!kind) return null
  if (kind === 'infra') {
    const est = moduleEstimate(s, p, m.id, CONTENT)
    return est.infra > 0.5 ? { text: t('module.measured.infra', { x: money(est.infra) }), good: true } : null
  }
  if (kind === 'updateWork' || kind === 'talk') {
    const base = m.base
    if (!base) return null
    const after = releaseGap(s, p, base.day, Infinity)
    const before = releaseGap(s, p, 0, base.day)
    if (after === null) return null
    return before === null ? { text: t('module.measured.every1', { a: after }), good: null } : { text: t('module.measured.every', { a: after, b: before }), good: after < before }
  }
  const me = moduleMeasured(s, p, m)
  if (!me || me.days < 1) return null
  const done = me.phase === 'frozen'
  const metric = kind === 'churn' ? 'lost' : kind === 'arpu' ? 'rev' : 'acq'
  const x = me.delta[metric]
  const y = me.before?.[metric]
  const fmt = metric === 'rev' ? (v: number) => money(v) : (v: number) => num(v)
  const key = `module.measured.${metric}${done ? 'Done' : y === undefined ? 'New' : ''}`
  const text = t(key, { d: me.days, x: fmt(x), ...(y !== undefined ? { y: fmt(y) } : {}) })
  if (y === undefined || me.days < 7) return { text, good: null }
  // Live days are a part of a month: compare per 30 days.
  const rate = done ? x : (x * B.MODULE_MEASURE_DAYS) / me.days
  const better = metric === 'lost' ? rate < y : rate > y
  return { text, good: Math.abs(rate - y) < 0.5 ? null : better }
}

// Project card version line (design §1.1, MV2c) ----------------------------------------------------------------------

/** The version bar's text: "v3 · %72" toward the next version, or "Davet sistemi geliştiriliyor · ≈12g" while a module builds. */
export function versionLine(s: GameState, p: Project): string {
  const b = buildStatus(s, p)
  if (b && !b.refresh) return t('module.buildingEta', { module: moduleName(b.id, p.category), d: b.days ?? '–' })
  const v = projectVersion(p)
  const done = B.VERSION_FLOOR + (1 - B.VERSION_FLOOR) * versionProgress(s, p)
  return t('module.toVersion', { v: v + 1, p: Math.round(done * 100) })
}

/** The locked preview before v1: "v1 · 3 slot açılır · %83". */
export function previewLine(p: Project): string {
  return t('module.slotsPreview', { n: slotsAt(1), p: Math.round(p.maturity * 100) })
}
