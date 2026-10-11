// The founder's own calls, asked at the central desk (scene-first spec §2 rows 4–10): payday, the round window, the
// weekly pitch, a contract renewal, waiting candidates, the first product and, on a tap on the founder, the founder
// actions. One topic at a time (render picks it). Every number is read from the engine's derived views
// (paydayView, derived.round, derived.renewals, candidates, useFounderActions); this file only lays them out as rows
// with labelled chips. The deeper views stay one tap away: Detay / Masa / Ekip close the bubble, then open the panel.
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PROJECT_NAMES } from '../../content'
import * as B from '../../engine/balance'
import { ledgerCosts } from '../../engine/economy'
import { autoPaydayChoice } from '../../engine'
import { actionEnergy } from '../../engine/founder'
import { FOUNDER_ACTIONS, PROJECT_CATEGORIES, ROUND_SIZES, type ActionErrorCode, type PaydayChoice, type PitchOption } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { renewalRows, type RenewalRow } from '../center/centerData'
import { ChipRow, type Chip } from '../EffectChips'
import { FOUNDER_COLOR, FOUNDER_ICON } from '../theme'
import { useFounderActions } from '../FounderActions'
import { money, pct } from '../format'
import { t } from '../i18n'
import { requestOverlay } from '../modalQueue'
import { PAYDAY_LINES, paydayView, type PaydayDesk } from '../overlays/paydayView'
import { CATEGORY_COLOR, CATEGORY_ICON } from '../panels/ProjectsPanel'
import { cx, IconBadge } from '../primitives'
import { BlockedLine, ChoiceRow, closeBubble, Expandable, launch, type BubbleMark } from './Expandable'
import { castName } from './speaker'

/** Mirrors render/bubbles.ts DeskTopic (ui may not import render). */
export type DeskTopic = 'payday' | 'round' | 'pitch' | 'renewal' | 'hire' | 'project' | 'actions'

/** "Hepsini öde": every line of the month paid in full. */
export const PAY_ALL: PaydayChoice = { salaries: 'full', rent: 'pay', infra: 'pay', ads: 'pay', founder: 'pay' }

const MAX_CANDIDATES = 3

const openGrowthRound = () => useGameStore.getState().openPanel({ kind: 'growth', section: 'round' })

/** Days until the week's moves refill (≥ 1), or null off the move budget (the garage). */
function useMovesResetIn(): number | null {
  return useGameStore((s) => {
    const m = s.state.derived.moves
    return m ? Math.max(1, Math.ceil(m.resetDay - s.state.time.day)) : null
  })
}

/** A blocked answer in words: "Hamle yok · yeni hafta 3g", "Enerji yetmiyor", else the engine's short error. */
export function blockedText(code: ActionErrorCode, resetIn: number | null): string {
  if (code === 'noMoves') return resetIn !== null ? t('bubble.noMoves', { d: resetIn }) : t('error.noMoves')
  if (code === 'noEnergy') return t('bubble.noEnergy')
  return t(`error.${code}`)
}

/** Every row is faded: say why, and give a full-width way out besides the × (the bubble holds the world while open). */
function Blocked({ text, close }: { text: string; close?: boolean }) {
  return (
    <>
      <BlockedLine text={text} />
      {close && <ChoiceRow primary label={t('bubble.close')} onClick={closeBubble} />}
    </>
  )
}

export function DeskBubble({ bubbleKey, topic, refId }: { bubbleKey: string; topic: DeskTopic; refId?: string }) {
  switch (topic) {
    case 'payday':
      return <PaydayBubble bubbleKey={bubbleKey} />
    case 'round':
      return <RoundBubble bubbleKey={bubbleKey} />
    case 'pitch':
      return <PitchBubble bubbleKey={bubbleKey} kind="desk" speaker={t('founder.you')} />
    case 'renewal':
      return <RenewalBubble bubbleKey={bubbleKey} refId={refId} />
    case 'hire':
      return <HireBubble bubbleKey={bubbleKey} />
    case 'project':
      return <ProjectBubble bubbleKey={bubbleKey} />
    case 'actions':
      return <ActionsBubble bubbleKey={bubbleKey} />
  }
}

// ---------------------------------------------------------------------------
// Payday (row 6)
// ---------------------------------------------------------------------------

/** "Kasayı koru": the most cash kept this month (half salaries, the rest waits, ads cut, the founder skips). */
export const PAY_KEEP: PaydayChoice = { salaries: 'half', rent: 'defer', infra: 'defer', ads: 'cut', founder: 'skip' }

const sameChoice = (a: PaydayChoice, b: PaydayChoice) => PAYDAY_LINES.every((l) => a[l] === b[l])

/** A payday answer as labelled chips: cash left, what stays owed, and the price of each line that waits. */
function paydayChips(d: PaydayDesk): Chip[] {
  const out: Chip[] = [{ icon: 'cash', label: t('fx.tag.cashAfter'), text: money(d.cashAfter), good: d.cashAfter < 0 ? false : null, title: t('desk.cashAfter') }]
  if (d.owedAfter > 0) out.push({ icon: 'coin', label: t('fx.tag.debt'), text: money(d.owedAfter), good: false, title: t('desk.owedAfter') })
  for (const r of d.rows) {
    const c = r.cost
    if (c?.kind === 'morale') out.push({ icon: 'heart', label: t('fx.tag.morale'), text: `−${Math.abs(c.value)}`, good: false, title: t('desk.title') })
    else if (c?.kind === 'energy') out.push({ icon: 'bolt', label: t('fx.tag.energy'), text: `−${Math.abs(c.value)}`, good: false, title: t('fx.energyLabel') })
    else if (c?.kind === 'capacity') out.push({ icon: 'cloud', label: t('fx.tag.mod.capacity'), text: `×${c.value}`, good: false, title: t('desk.title') })
    else if (c?.kind === 'rent') out.push({ icon: 'building', label: t('fx.tag.mod.rent'), text: `${c.n}/${c.max}`, good: false, title: t('desk.title') })
  }
  return out
}

function PaydayBubble({ bubbleKey }: { bubbleKey: string }) {
  const dispatch = useGameStore((s) => s.dispatch)
  // paydayView runs the engine on a copy: recompute only when the month or the till moves, never every frame.
  const key = useGameStore((s) => {
    const p = s.state.finance.pendingPayday
    return p ? `${p.day}|${Math.round(s.state.stats.cash)}` : ''
  })
  const v = useMemo(() => {
    const st = useGameStore.getState().state
    const p = st.finance.pendingPayday
    if (!key || !p) return null
    const total = ledgerCosts(p.ledger) + p.deferredBefore * (1 + B.DEFER_INTEREST)
    // A month the till covers gets one row; a short month (the usual case: the engine only waits on those) gets the
    // default order and the cash-keeping answer, each with what it leaves behind.
    const affordable = st.stats.cash >= total
    const order = autoPaydayChoice(st)
    const rows: { id: string; choice: PaydayChoice; desk: PaydayDesk | null }[] = affordable
      ? [{ id: 'payAll', choice: PAY_ALL, desk: paydayView(st, PAY_ALL) }]
      : [{ id: 'payOrder', choice: order, desk: paydayView(st, order) }, ...(sameChoice(order, PAY_KEEP) ? [] : [{ id: 'payKeep', choice: PAY_KEEP, desk: paydayView(st, PAY_KEEP) }])]
    return { total, salaries: p.ledger.salaries, rent: p.ledger.rent, rows }
  }, [key])
  if (!v) return null
  const openDesk = () => requestOverlay({ kind: 'payday' })
  // The chips add up to the headline: salaries, rent, and the rest (infra, ads, founder pay, deferred debt) as Diğer.
  // A zero line gets no chip ("Maaş −$0" read as a bug).
  const other = v.total - v.salaries - v.rent
  const chips: Chip[] = [
    ...(v.salaries > 0 ? [{ icon: 'users' as const, label: t('fx.tag.salary'), text: `−${money(v.salaries)}`, good: false, title: t('desk.title') }] : []),
    ...(v.rent > 0 ? [{ icon: 'building' as const, label: t('fx.tag.mod.rent'), text: `−${money(v.rent)}`, good: false, title: t('desk.title') }] : []),
    ...(other >= 1 ? [{ icon: 'cash' as const, label: t('fx.tag.other'), text: `−${money(other)}`, good: false, title: t('desk.title') }] : []),
  ]
  return (
    <Expandable bubbleKey={bubbleKey} kind="desk" face="founder" mark={{ icon: 'cash', color: 'var(--color-g-burn)' }} speaker={t('founder.you')} line={t('bubble.payday', { v: money(v.total) })} detail={openDesk}>
      <ChipRow chips={chips} />
      {v.rows.map((r, i) => (
        <ChoiceRow
          key={r.id}
          primary={i === 0}
          label={t(`bubble.${r.id}`)}
          chips={r.desk ? paydayChips(r.desk) : undefined}
          onClick={() => dispatch({ type: 'resolvePayday', choice: r.choice })}
        />
      ))}
      {/* The line-by-line desk is the header's (i), as on every other expanded bubble (one control per action, QA). */}
    </Expandable>
  )
}

// ---------------------------------------------------------------------------
// Round window (row 5) and the weekly pitch (row 4; also VisitorBubble)
// ---------------------------------------------------------------------------

function RoundBubble({ bubbleKey }: { bubbleKey: string }) {
  const sizes = useGameStore((s) => s.state.derived.round?.sizes)
  const ready = useGameStore((s) => s.state.derived.canStartRound)
  const down = useGameStore((s) => !!s.state.derived.round?.downRound && !s.state.derived.round.retryIn)
  const dispatch = useGameStore((s) => s.dispatch)
  if (!sizes) return null
  return (
    <Expandable bubbleKey={bubbleKey} kind="desk" face="founder" mark={{ icon: 'rocket', color: 'var(--color-brand)' }} speaker={t('founder.you')} line={t('bubble.round')} detail={openGrowthRound}>
      {/* Sizes only while the window's open; the down round alone (window shut) keeps just its row. */}
      {ready && ROUND_SIZES.map((k) => {
        const o = sizes.find((x) => x.size === k)
        if (!o) return null
        return (
          <ChoiceRow
            key={k}
            primary={k === 'target'}
            label={t(`round.size.${k}`)}
            title={t('round.sizeTitle')}
            chips={[
              { icon: 'cash', label: t('fx.tag.cash'), text: `+${money(o.offer)}`, tail: t('unit.months', { v: o.months }), good: true, title: t('hud.cash') },
              { icon: 'key', label: t('fx.tag.equity'), text: `−${pct(o.equity, 1)}`, good: false, title: t('hud.founderStake') },
            ]}
            onClick={() => dispatch({ type: 'startRound', size: k })}
          />
        )
      })}
      {/* The one-time down round is a panel flow (spec §4 launcher-only): one row that opens it. */}
      {down && <ChoiceRow label={t('round.downGo')} title={t('round.downTitle')} onClick={() => launch(openGrowthRound)} />}
    </Expandable>
  )
}

const signedPct = (v: number, digits = 1) => (v >= 0 ? `+${pct(v, digits)}` : `−${pct(-v, digits)}`)

/** A pitch as labelled chips: offer change (the story's gamble as its upside + its risk), weeks off, equity, energy. */
export function pitchChips(o: PitchOption): Chip[] {
  const out: Chip[] = []
  if (o.pitch === 'story' && o.min !== undefined && o.max !== undefined) {
    // "Teklif −%3.4…+%6.6" read as noise (QA): whole percents, the best case and the worst case as two chips.
    const title = t(`pitch.${o.pitch}`)
    if (Math.round(o.max * 100) > 0) out.push({ icon: 'scale', label: t('fx.tag.offer'), text: signedPct(o.max, 0), good: true, title })
    if (Math.round(o.min * 100) < 0) out.push({ icon: 'warning', label: t('fx.tag.risk'), text: signedPct(o.min, 0), good: false, title })
  } else if (o.delta !== 0) {
    out.push({ icon: 'scale', label: t('fx.tag.offer'), text: signedPct(o.delta), good: o.delta > 0, title: t(`pitch.${o.pitch}`) })
  }
  if (o.weeks > 0) out.push({ icon: 'timer', label: t('fx.tag.roundWeeks'), text: `−${t('fx.weeksShort', { v: o.weeks })}`, good: true, title: t('fx.roundLabel') })
  // Extra equity sold is the founder's stake going down: the same sign as the round size rows.
  if (o.equity > 0) out.push({ icon: 'key', label: t('fx.tag.equity'), text: `−${pct(o.equity, 0)}`, good: false, title: t('hud.founderStake') })
  if (o.energy > 0) out.push({ icon: 'bolt', label: t('fx.tag.energy'), text: `−${o.energy}`, good: false, title: t('fx.energyLabel') })
  return out
}

const PITCH_ICON: Record<PitchOption['pitch'], BubbleMark> = {
  metrics: { icon: 'bars', color: 'var(--color-brand)' },
  story: { icon: 'chat', color: 'var(--color-brand)' },
  coinvestor: { icon: 'handshake', color: 'var(--color-brand)' },
}

/** The weekly pitch: at the desk, or above the round's investor (VisitorBubble passes its cast name). */
export function PitchBubble({ bubbleKey, kind, speaker }: { bubbleKey: string; kind: string; speaker: string }) {
  const options = useGameStore((s) => s.state.derived.round?.pitchOptions)
  const dispatch = useGameStore((s) => s.dispatch)
  const movesOut = useGameStore((s) => (s.state.derived.moves?.left ?? 1) <= 0)
  const resetIn = useMovesResetIn()
  if (!options || options.length === 0) return null
  // ok = energy and, from Pre-seed, a move: name the one that is short.
  const blocked = options.some((o) => !o.ok) ? blockedText(movesOut ? 'noMoves' : 'noEnergy', resetIn) : null
  const allBlocked = options.every((o) => !o.ok)
  return (
    <Expandable bubbleKey={bubbleKey} kind={kind} mark={{ icon: 'chat', color: 'var(--color-g-equity)' }} face={kind === 'visitor' ? 'investor' : 'founder'} speaker={speaker} line={t('bubble.pitch')} detail={openGrowthRound}>
      {options.map((o) => (
        <ChoiceRow
          key={o.pitch}
          icon={PITCH_ICON[o.pitch]}
          label={t(`pitch.${o.pitch}`)}
          disabled={!o.ok}
          chips={pitchChips(o)}
          onClick={() => dispatch({ type: 'roundPitch', pitch: o.pitch })}
        />
      ))}
      {blocked && <Blocked text={blocked} close={allBlocked} />}
    </Expandable>
  )
}

/** The investor's name for the visitor pitch bubble. */
export function useInvestorName(): string {
  const cast = useGameStore((s) => s.state.cast)
  return castName({ cast }, 'investor')
}

// ---------------------------------------------------------------------------
// Renewal (row 7)
// ---------------------------------------------------------------------------

function RenewalBubble({ bubbleKey, refId }: { bubbleKey: string; refId?: string }) {
  const dispatch = useGameStore((s) => s.dispatch)
  // The view is rebuilt every step: re-render only when one of this contract's numbers moves.
  const json = useGameStore((s) => {
    const rows = renewalRows(s.state.derived.renewals, s.state.time.day)
    return JSON.stringify(rows.find((r) => r.id === refId) ?? rows[0] ?? null)
  })
  const r = useMemo(() => JSON.parse(json) as RenewalRow | null, [json])
  const resetIn = useMovesResetIn()
  if (!r) return null
  const err = r.error ? blockedText(r.error, resetIn) : undefined
  const offer = (o: 'hold' | 'discount') => dispatch({ type: 'renewContract', id: r.id, offer: o })
  return (
    <Expandable
      bubbleKey={bubbleKey}
      kind="desk"
      face="founder"
      mark={{ icon: 'handshake', color: 'var(--color-g-morale)' }}
      speaker={t('founder.you')}
      line={t('bubble.renewal', { name: r.name, d: r.days })}
      detail={() => useGameStore.getState().openPanel({ kind: 'growth' })}
    >
      <ChoiceRow
        primary={!err}
        label={t('renew.hold')}
        disabled={!!r.error}
        title={err}
        chips={[
          { icon: 'scale', label: t('fx.tag.chance'), text: pct(r.holdChance), good: null, title: t('renew.chance', { p: pct(r.holdChance) }) },
          { icon: 'coin', label: t('fx.tag.mod.arpu'), text: `+${money(r.holdMrr - r.mrr)}`, tail: t('bubble.month'), good: true, title: t('renew.title') },
        ]}
        onClick={() => offer('hold')}
      />
      <ChoiceRow
        label={t('renew.discount')}
        disabled={!!r.error}
        title={err}
        chips={[
          { icon: 'tag', label: t('fx.tag.price'), text: `−${pct(r.mrr > 0 ? 1 - r.discountMrr / r.mrr : 0)}`, good: false, title: t('renew.title') },
          { icon: 'scale', label: t('fx.tag.chance'), text: pct(1), good: true, title: t('renew.title') },
        ]}
        onClick={() => offer('discount')}
      />
      {err && <Blocked text={err} close />}
    </Expandable>
  )
}

// ---------------------------------------------------------------------------
// Hiring (row 8)
// ---------------------------------------------------------------------------

function HireBubble({ bubbleKey }: { bubbleKey: string }) {
  const candidates = useGameStore(useShallow((s) => s.state.candidates))
  const dispatch = useGameStore((s) => s.dispatch)
  const [err, setErr] = useState<string | null>(null)
  if (candidates.length === 0) return null
  return (
    <Expandable
      bubbleKey={bubbleKey}
      kind="desk"
      face="founder"
      mark={{ icon: 'users', color: 'var(--color-g-users)' }}
      speaker={t('founder.you')}
      line={t('bubble.hire', { n: candidates.length })}
      detail={() => useGameStore.getState().openPanel({ kind: 'team' })}
    >
      {candidates.slice(0, MAX_CANDIDATES).map((c) => (
        <ChoiceRow
          key={c.id}
          label={`${c.name} · ${t(`dept.${c.dept}`)}`}
          title={t('team.hire')}
          chips={[{ icon: 'cash', label: t('fx.tag.salary'), text: `−${money(c.salary)}`, tail: t('bubble.month'), good: false, title: t('hud.cash') }]}
          onClick={() => {
            const res = dispatch({ type: 'hire', candidateId: c.id })
            setErr(res.ok || !res.error ? null : t(`error.${res.error}`))
          }}
        />
      ))}
      {candidates.length > MAX_CANDIDATES && (
        <ChoiceRow label={t('bubble.moreCandidates', { n: candidates.length - MAX_CANDIDATES })} onClick={() => launch(() => useGameStore.getState().openPanel({ kind: 'team' }))} />
      )}
      {err && <span className="font-text text-[12px] font-semibold text-negative-ink">{err}</span>}
    </Expandable>
  )
}

// ---------------------------------------------------------------------------
// First product (row 9)
// ---------------------------------------------------------------------------

/** Same naming as the Projeler panel: the next unused name from the run's list. */
function nextProjectName(): string {
  const s = useGameStore.getState().state
  const used = new Set(s.projects.map((p) => p.name))
  const start = s.counters.projectsStarted ?? s.projects.length
  for (let i = 0; i < PROJECT_NAMES.length; i++) {
    const n = PROJECT_NAMES[(start + i) % PROJECT_NAMES.length]
    if (n && !used.has(n)) return n
  }
  return `${PROJECT_NAMES[0] ?? 'Proje'} ${start + 1}`
}

function ProjectBubble({ bubbleKey }: { bubbleKey: string }) {
  const dispatch = useGameStore((s) => s.dispatch)
  return (
    <Expandable
      bubbleKey={bubbleKey}
      kind="desk"
      face="founder"
      mark={{ icon: 'rocket', color: 'var(--color-brand)' }}
      speaker={t('founder.you')}
      line={t('bubble.project')}
      detail={() => useGameStore.getState().openPanel({ kind: 'projects' })}
    >
      <div className="grid grid-cols-3 gap-1.5">
        {PROJECT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            title={t('projects.start')}
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'startProject', category: c, name: nextProjectName() })
            }}
            className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-control border border-border bg-surface-2/60 px-1 py-1.5 transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <IconBadge icon={CATEGORY_ICON[c]} size={24} color={CATEGORY_COLOR[c]} />
            <span className="line-clamp-2 text-center text-[12px] font-semibold leading-tight text-ink">{t(`category.${c}`)}</span>
          </button>
        ))}
      </div>
    </Expandable>
  )
}

// ---------------------------------------------------------------------------
// Founder actions (row 10): exists only while open (a tap on the founder)
// ---------------------------------------------------------------------------

function ActionsBubble({ bubbleKey }: { bubbleKey: string }) {
  const { actions } = useFounderActions()
  const energy = useGameStore(useShallow((s) => FOUNDER_ACTIONS.map((k) => actionEnergy(s.state, B.FOUNDER_ACTION_DEFS[k].energy))))
  const movesOut = useGameStore((s) => (s.state.derived.moves?.left ?? 1) <= 0)
  const resetIn = useMovesResetIn()
  return (
    <Expandable
      bubbleKey={bubbleKey}
      kind="desk"
      face="founder"
      mark={{ icon: 'bolt', color: 'var(--color-energy)' }}
      speaker={t('founder.you')}
      line={t('founder.actions')}
      detail={() => useGameStore.getState().openPanel({ kind: 'detail', selection: { kind: 'founder' } })}
    >
      {actions
        .filter((a) => !a.locked)
        .map((a) => {
          const e = energy[FOUNDER_ACTIONS.indexOf(a.kind)] ?? 0
          const chips: Chip[] = [
            ...(a.moves > 0 ? [{ icon: 'flag' as const, label: t('bubble.tag.moves'), text: `−${a.moves}`, good: null, title: a.label }] : []),
            ...(e > 0 ? [{ icon: 'bolt' as const, label: t('fx.tag.energy'), text: `−${e}`, good: false, title: t('fx.energyLabel') }] : []),
          ]
          return (
            <ChoiceRow
              key={a.kind}
              icon={{ icon: FOUNDER_ICON[a.kind], color: FOUNDER_COLOR[a.kind] }}
              label={<span className={cx(a.running && 'text-brand-ink')}>{t(`founder.${a.kind}`)}</span>}
              title={a.label}
              disabled={a.disabled}
              chips={chips}
              onClick={a.run}
            />
          )
        })}
      {movesOut && <BlockedLine text={blockedText('noMoves', resetIn)} />}
    </Expandable>
  )
}
