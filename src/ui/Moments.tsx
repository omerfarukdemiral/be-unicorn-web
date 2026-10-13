// Moments (docs/CORE_LOOP.md §4.2, §7 "Popup bütçesi"; docs/LAYOUT.md §3): month receipt (ay fişi) on payday,
// release moment (sürüm anı) and "Kararın → sonucu". A ☆ goal only grows the Kazanımlar badge and the round beats
// live in the top bar (docs/GAMEPLAY_V2.md §12 D9).
// They are items of the ONE notification strip: `useMomentSource` turns fresh engine events into moments,
// `MomentLine` draws one as a single line, `momentLook` gives its icon / hue / panel. Nothing here pauses time.
// The receipt ends on one teaser: the next storm on the horizon, "→ 12g · Yatırımcı kışı" ("?" until revealed, §5.1).
import * as B from '../engine/balance'
import type { GameState, MonthReceipt } from '../engine/types'
import { moduleName } from '../content'
import type { Panel } from '../store/types'
import type { IconName } from './icons'
import { t } from './i18n'
import { fixed, money, num } from './format'
import { cx } from './primitives'
import { effectSummary, optionLabel, releaseName, useFreshEvents } from './loopUi'
import { momentPanel } from './momentRules'

export type Moment =
  | { key: number; kind: 'receipt'; receipt: MonthReceipt; next?: ReceiptTeaser }
  | { key: number; kind: 'release'; project: string; level: number; update?: number; version?: number; minor?: number; module?: string; users: number; mrr: number }
  | { key: number; kind: 'outcome'; option: string; effects: string }

/** The receipt's teaser: days to the next crisis on the horizon and its name ("?" while hidden). */
export interface ReceiptTeaser {
  days: number
  name: string
}

/** The next crisis the engine put on the horizon (within CRISIS_HORIZON_DAYS), or undefined. */
export function receiptTeaser(s: Pick<GameState, 'derived' | 'time'>): ReceiptTeaser | undefined {
  const c = s.derived.horizon?.find((h) => h.kind === 'crisis')
  if (!c) return undefined
  const name = c.hidden || !c.crisisId ? t('horizon.crisisHidden') : t(`crisis.${c.crisisId}`)
  return { days: Math.max(0, Math.round(c.day - s.time.day)), name }
}

const teaserText = (n: ReceiptTeaser): string => t('receipt.next', { d: t('horizon.daysShort', { v: n.days }), v: n.name })

/** Calls `onMoments` with the moments hidden in fresh engine events (skips a loaded run's history). */
export function useMomentSource(onMoments: (add: Moment[]) => void): void {
  useFreshEvents((events, s) => {
    const add: Moment[] = []
    for (const e of events) {
      if (e.kind === 'payday' && s.finance.lastReceipt) {
        const next = receiptTeaser(s)
        add.push({ key: e.id, kind: 'receipt', receipt: s.finance.lastReceipt, ...(next ? { next } : {}) })
      } else if (e.kind === 'release') {
        const r = s.releases?.find((x) => x.id === e.refId)
        const mod = r?.module ? moduleName(r.module, s.projects.find((p) => p.id === r.projectId)?.category) : undefined
        if (r) add.push({ key: e.id, kind: 'release', project: r.projectName, level: r.level, ...(r.update !== undefined ? { update: r.update } : {}), ...(r.version !== undefined ? { version: r.version } : {}), ...(r.minor !== undefined ? { minor: r.minor } : {}), ...(mod ? { module: mod } : {}), users: r.users, mrr: r.mrr })
      } else if (e.kind === 'delayedEffect') {
        const o = [...(s.decisions.outcomes ?? [])].reverse().find((x) => x.cardId === e.refId)
        if (o) add.push({ key: e.id, kind: 'outcome', option: optionLabel(o.cardId, o.optionIndex) ?? '', effects: effectSummary(o.effects) })
      }
    }
    if (add.length) onMoments(add)
  })
}

/** Icon, identity hue and the panel a moment opens. No red here (docs/LAYOUT.md §4.1): a negative receipt uses the burn identity hue. */
export function momentLook(m: Moment): { icon: IconName; color: string; panel: Panel } {
  const panel = momentPanel(m.kind)
  switch (m.kind) {
    case 'receipt':
      return { icon: 'cash', color: m.receipt.net >= 0 ? 'var(--color-positive)' : 'var(--color-g-burn)', panel }
    case 'release':
      return { icon: 'rocket', color: 'var(--color-brand)', panel }
    case 'outcome':
      return { icon: 'hourglass', color: 'var(--color-kind-decision)', panel }
  }
}

/** A version release past the first 1.0 (design §2.3): "{project} v2 yayında · +3 slot". */
const isVersionRelease = (m: { version?: number; minor?: number; module?: string }): boolean => m.version !== undefined && m.version > 1 && m.minor === undefined && !m.module

const neg = (v: number) => (v > 0.5 ? `−${money(v)}` : money(0))
const sgn = (v: number) => (v >= 0 ? `+${money(v)}` : `−${money(-v)}`)
const months = (r: number | null) => (r === null ? t('receipt.infinite') : t('unit.months', { v: fixed(r, 1) }))

/** The receipt's runway part, or null when it says nothing ("∞ → ∞", "4.2 ay → 4.2 ay", a first month at ∞). */
export function receiptRunway(r: Pick<MonthReceipt, 'month' | 'runwayBefore' | 'runwayAfter'>): string | null {
  const a = r.runwayBefore === null ? null : fixed(r.runwayBefore, 1)
  const b = r.runwayAfter === null ? null : fixed(r.runwayAfter, 1)
  if (r.month > 0 && a !== b) return t('receipt.runwayMove', { a: months(r.runwayBefore), b: months(r.runwayAfter) })
  return b === null ? null : months(r.runwayAfter)
}

/** A1: "Reklam: +n kullanıcı" when last month's ads brought anyone, else null. */
export function adUsersText(r: Pick<MonthReceipt, 'adUsers'>): string | null {
  return r.adUsers && r.adUsers >= 1 ? t('receipt.adUsers', { n: num(r.adUsers) }) : null
}

/** Plain one-line text of a moment (strip title attribute, screen readers). */
export function momentText(m: Moment): string {
  switch (m.kind) {
    case 'receipt': {
      const r = m.receipt
      const runway = receiptRunway(r)
      const ads = adUsersText(r)
      const line = t('strip.receipt', { m: r.month + 1, p: neg(r.paid), n: sgn(r.net), r: (ads ? ` · ${ads}` : '') + (runway ? ` · ${t('receipt.runway')} ${runway}` : '') })
      return m.next ? `${line} · ${teaserText(m.next)}` : line
    }
    case 'release':
      // A module delivery: "Proje: Modül yayında" (a refresh brings no users, so no wave).
      if (m.module) return `${m.project}: ${t('release.module', { module: m.module })}${m.users > 0 ? ` · ${t('release.wave', { u: Math.round(m.users), m: money(m.mrr) })}` : ''}`
      if (isVersionRelease(m)) return `${t('release.version', { project: m.project, v: m.version!, n: B.MODULE_SLOTS_PER_VERSION })} · ${t('release.wave', { u: Math.round(m.users), m: money(m.mrr) })}`
      return t('strip.release', { project: m.project, level: releaseName(m.level, m.update, undefined, m.version, m.minor), u: Math.round(m.users), m: money(m.mrr) })
    case 'outcome':
      return t('outcome.line', { option: m.option, effects: m.effects })
  }
}

/** One line: main text in ink semibold, the secondary part in ink-2 (everything truncates as one line). */
export function MomentLine({ m }: { m: Moment }) {
  const main = 'font-semibold text-ink'
  const sub = 'text-ink-2'
  switch (m.kind) {
    case 'receipt': {
      const r = m.receipt
      const runway = receiptRunway(r)
      // Net first: on a narrow strip the truncation eats the tail (ödenen, runway), never the month's result.
      return (
        <span className="tabular">
          <span className={main}>{t('receipt.title', { m: r.month + 1 })}</span>
          <span className={sub}>
            {' · '}
            {t('receipt.net')} <span className={cx('font-semibold', r.net >= 0 ? 'text-positive-ink' : 'text-ink')}>{sgn(r.net)}</span> · {t('strip.paid')} {neg(r.paid)}
            {adUsersText(r) && ` · ${adUsersText(r)}`}
            {runway && ` · ${t('receipt.runway')} ${runway}`}
          </span>
          {m.next && <span className="font-semibold" style={{ color: 'var(--color-g-burn)' }}> · {teaserText(m.next)}</span>}
        </span>
      )
    }
    case 'release':
      return (
        <span className="tabular">
          <span className={main}>
            {m.module
              ? `${m.project}: ${releaseName(m.level, m.update, m.module)}`
              : isVersionRelease(m)
                ? t('release.version', { project: m.project, v: m.version!, n: B.MODULE_SLOTS_PER_VERSION })
                : t('release.title', { project: m.project, level: releaseName(m.level, m.update, undefined, m.version, m.minor) })}
          </span>
          {(!m.module || m.users > 0) && <span className="font-medium text-positive-ink"> · {t('release.wave', { u: Math.round(m.users), m: money(m.mrr) })}</span>}
        </span>
      )
    case 'outcome':
      return (
        <span>
          <span className={main}>{t('outcome.title')}</span>
          <span className={sub}> · {t('outcome.line', { option: m.option, effects: m.effects })}</span>
        </span>
      )
  }
}

