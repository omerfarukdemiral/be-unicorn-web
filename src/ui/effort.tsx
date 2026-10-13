// Effort management in the UI (E3): the chips, the battery meter and the controls the person card, the staff bubbles,
// the Ekip / Projeler panels and the detail panel share. Numbers come from the engine (balance, effort.ts); nothing here
// decides a rule. From Pre-seed only: in the Garage effortOn is false and every control hides.
import * as B from '../engine/balance'
import { buildersOf, effortOn, founderProject, hasOpenWork, isBuilder, isSprinting, onLeave, projectDemand, projectLoad, supplyOf } from '../engine/effort'
import { useShallow } from 'zustand/react/shallow'
import type { Candidate, Employee, GameState, Pace, Project, ProjectCategory } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import type { Chip } from './EffectChips'
import { fixed, pct } from './format'
import { t } from './i18n'
import { Icon, type IconName } from './icons'
import { Bar, cx } from './primitives'
import { ChoiceRow } from './bubbles/Expandable'

const dispatch = (a: Parameters<ReturnType<typeof useGameStore.getState>['dispatch']>[0]) => useGameStore.getState().dispatch(a)

// ---------------------------------------------------------------------------
// Tones and chips (pure)
// ---------------------------------------------------------------------------

/** Fatigue: red from FATIGUE_TIRED, green under 40, neutral between. */
export const fatigueGood = (f: number): boolean | null => (f >= B.FATIGUE_TIRED ? false : f < 40 ? true : null)
/** Load: over 1.2 red, 0.8–1.2 green, the rest (a slack project) neutral grey. */
export const loadGood = (l: number): boolean | null => (l > 1.2 ? false : l >= 0.8 ? true : null)

const signed = (v: number, text: string): string => `${v < 0 ? '−' : '+'}${text}`

/** "Yük 1.4×". */
export const loadChip = (load: number): Chip => ({ icon: 'scale', label: t('fx.tag.load'), text: `${fixed(load, 1)}×`, good: loadGood(load), title: t('fx.tag.load') })

/** ▲ output: "Hız −%15". `text` is already signed. */
export const outputChip = (text: string, good: boolean | null, tail?: string): Chip => ({ icon: 'arrowUp', label: t('fx.tag.mod.production'), text, tail, good, title: t('fx.mod.production') })

/** Fatigue per day: "−3.5/g" (a falling battery is the good direction). */
export const batteryChip = (perDay: number, label = ''): Chip => ({ icon: 'battery', label, text: signed(perDay, fixed(Math.abs(perDay), 1)), tail: t('bubble.perDay'), good: perDay < 0, title: t('fx.tag.fatigue') })

/** The calm pace: slower, recovers. Shown on the pill and on every "Yavaşlat". */
export const calmChips = (): Chip[] => [outputChip(`−${pct(1 - B.PACE_OUTPUT.calm)}`, false), batteryChip(B.PACE_FATIGUE.calm)]

/** A leave: nothing made for LEAVE_DAYS, the battery refills. */
export const leaveChips = (): Chip[] => [
  outputChip('0', false, t('fx.daysShort', { v: B.LEAVE_DAYS })),
  { icon: 'battery', label: '', text: `−${B.LEAVE_RECOVERY_PER_DAY * B.LEAVE_DAYS}`, good: true, title: t('fx.tag.fatigue') },
]

/** A tired person left as they are: the output the engine already takes off. */
export const carryOnChips = (): Chip[] => [outputChip(`−${pct(1 - B.TIRED_OUTPUT)}`, false)]

/** A sprint: faster, tires, and from TECH_DEBT_MIN_STAGE debt per engineer. */
export function sprintChips(s: Pick<GameState, 'stage'>, engineers: number): Chip[] {
  const out = [outputChip(`+${pct(B.SPRINT_OUTPUT - 1)}`, true), batteryChip(B.SPRINT_FATIGUE)]
  if (s.stage >= B.TECH_DEBT_MIN_STAGE && engineers > 0)
    out.push({ icon: 'bug', label: t('fx.tag.techDebt'), text: `+${fixed(B.SPRINT_DEBT_PER_ENG * engineers, 1)}`, good: false, title: t('hud.techDebt') })
  return out
}

/** A promotion: salary once, the whole team tires a little less. */
export const leadChips = (first: boolean): Chip[] => [
  ...(first ? [{ icon: 'cash' as const, label: t('fx.tag.salary'), text: `+${pct(B.LEAD_SALARY_FACTOR - 1)}`, good: false, title: t('detail.salary') }] : []),
  { icon: 'battery', label: t('fx.tag.team'), text: `−${fixed(B.LEAD_FATIGUE_RELIEF, 1)}`, tail: t('bubble.perDay'), good: true, title: t('fx.tag.fatigue') },
]

/** A cooldown as a passive chip: "⌛ 30g". */
export const cooldownChip = (days: number): Chip => ({ icon: 'hourglass', label: '', text: t('fx.daysShort', { v: days }), good: null, title: t('fx.daysShort', { v: days }) })

/** A fit hire: the category's icon with a tick, and the output it adds ("▲ +%8"). */
export const fitChips = (icon: IconName): Chip[] => [{ icon, label: '', text: '✓', good: true, title: t('team.fit') }, outputChip(`+${pct(B.FIT_OUTPUT - 1)}`, true)]

/** A candidate's one skill (eng / product, from Pre-seed) and whether the company builds it now; null when it does not apply. */
export function candidateFit(s: Pick<GameState, 'stage' | 'projects'>, c: Candidate): { category: ProjectCategory; fit: boolean } | null {
  const category = c.skills?.[0]
  if (!category || !effortOn(s)) return null
  return { category, fit: s.projects.some((p) => p.category === category) }
}

// ---------------------------------------------------------------------------
// What a person / a project can be asked (pure)
// ---------------------------------------------------------------------------

export interface PersonControls {
  /** Their own pace, or null when pace does not apply (garage, sales, leaving). */
  pace: Pace | null
  /** 'ready' | days of cooldown left | null (not offered: rested, new, away). */
  leave: 'ready' | number | null
  /** Offered as the lead of their project (or the current lead can step down). */
  lead: 'make' | 'unlead' | null
  /** The first promotion ever raises the salary. */
  leadFirst: boolean
}

export function personControls(s: GameState, e: Employee): PersonControls {
  const none: PersonControls = { pace: null, leave: null, lead: null, leadFirst: false }
  if (!effortOn(s) || e.status === 'leaving') return none
  const day = s.time.day
  const pace = e.dept === 'sales' ? null : (e.pace ?? 'normal')
  const tired = (e.fatigue ?? 0) >= 40 || e.status === 'burnout'
  const away = onLeave(e, day) || e.status === 'onboarding'
  const leave = !tired || away ? null : day < (e.leaveReadyDay ?? -Infinity) ? Math.ceil((e.leaveReadyDay ?? 0) - day) : 'ready'
  const p = e.projectId !== undefined ? s.projects.find((x) => x.id === e.projectId) : undefined
  let lead: PersonControls['lead'] = null
  if (p && s.stage >= B.LEAD_MIN_STAGE && isBuilder(e) && e.status !== 'onboarding') {
    if (p.leadId === e.id) lead = 'unlead'
    else if (buildersOf(s, p).length >= B.LEAD_MIN_TEAM) lead = 'make'
  }
  return { pace, leave, lead, leadFirst: !e.wasLead }
}

export interface ProjectEffort {
  /** FTE the builders bring / FTE the project asks. */
  supply: number
  demand: number
  load: number
  lead: Employee | undefined
  sprinting: boolean
  /** Days of sprint left. */
  sprintLeft: number
  /** Days until another sprint may start (0 = ready). */
  cooldown: number
  /** A sprint can start now (work left, builders, ready). */
  canSprint: boolean
  engineers: number
}

export function projectEffort(s: GameState, p: Project): ProjectEffort {
  const day = s.time.day
  const builders = buildersOf(s, p)
  const supply = (p === founderProject(s) ? B.FOUNDER_PROJECT_OUTPUT : 0) + builders.reduce((n, e) => n + supplyOf(e, day), 0)
  const sprinting = isSprinting(p, day)
  const cooldown = Math.max(0, Math.ceil((p.sprintReadyDay ?? -Infinity) - day))
  return {
    supply,
    demand: projectDemand(s, p),
    load: projectLoad(s, p),
    lead: p.leadId !== undefined ? s.employees.find((e) => e.id === p.leadId) : undefined,
    sprinting,
    sprintLeft: sprinting ? Math.max(0, Math.ceil((p.sprintUntil ?? 0) - day)) : 0,
    cooldown: Number.isFinite(cooldown) ? cooldown : 0,
    canSprint: hasOpenWork(p) && builders.length > 0 && !sprinting && cooldown === 0,
    engineers: builders.filter((e) => e.dept === 'eng').length,
  }
}

/** The load e would have on p (already there: its own load; else with e joining). */
export function loadIf(s: GameState, p: Project, e: Employee): number {
  return projectLoad(s, p, p.assignedIds.includes(e.id) ? 0 : supplyOf(e, s.time.day))
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Battery icon + 4px bar + the number (red from FATIGUE_TIRED, green under 40). */
export function FatigueMeter({ fatigue, className }: { fatigue: number; className?: string }) {
  const f = Math.round(fatigue)
  const good = fatigueGood(f)
  const color = good === false ? 'var(--color-negative)' : good === true ? 'var(--color-positive)' : 'var(--color-energy)'
  return (
    <span title={t('fx.tag.fatigue')} className={cx('inline-flex items-center gap-1.5', className)}>
      <Icon name="battery" size={14} />
      <span className="block w-14 shrink-0">
        <Bar value={f / 100} color={color} height={4} />
      </span>
      <span className="tabular text-[13px] font-bold leading-none">{f}</span>
    </span>
  )
}

/** One-tap pace: the pill names the pace now; the chips say what "Rahat" does (what you get, or what you give up). */
export function PaceRow({ e }: { e: Employee }) {
  const calm = (e.pace ?? 'normal') === 'calm'
  return (
    <ChoiceRow
      primary={calm}
      icon={{ icon: 'battery', color: calm ? 'var(--color-positive)' : 'var(--color-ink-3)' }}
      label={`${t('team.pace')}: ${t(calm ? 'pace.calm' : 'pace.normal')}`}
      chips={calmChips()}
      onClick={() => dispatch({ type: 'setPace', employeeId: e.id, pace: calm ? 'normal' : 'calm' })}
    />
  )
}

/** "İzin ver · 5g" (chips ▲ 0 · 5g, battery −60); the cooldown shows as a passive "30g". */
export function LeaveRow({ e, leave, primary }: { e: Employee; leave: 'ready' | number; primary?: boolean }) {
  const label = `${t('team.leave')} · ${t('fx.daysShort', { v: B.LEAVE_DAYS })}`
  return leave === 'ready' ? (
    <ChoiceRow primary={primary} label={label} chips={leaveChips()} onClick={() => dispatch({ type: 'giveLeave', employeeId: e.id })} />
  ) : (
    <ChoiceRow disabled label={label} chips={[cooldownChip(leave)]} onClick={() => undefined} />
  )
}

/** The person-level effort controls: pace, leave (when worn out), lead (when eligible). */
export function PersonEffortRows({ e }: { e: Employee }) {
  const c = useGameStore(useShallow((s) => personControls(s.state, e)))
  const projectId = e.projectId
  return (
    <>
      {c.pace && <PaceRow e={e} />}
      {c.leave !== null && <LeaveRow e={e} leave={c.leave} />}
      {c.lead && projectId !== undefined && (
        <ChoiceRow
          icon={{ icon: 'star', color: 'var(--color-g-equity)' }}
          label={t(c.lead === 'make' ? 'team.makeLead' : 'team.unlead')}
          chips={c.lead === 'make' ? leadChips(c.leadFirst) : []}
          onClick={() => dispatch({ type: 'setLead', projectId, employeeId: c.lead === 'make' ? e.id : null })}
        />
      )}
    </>
  )
}

/** "4/5 kişi" in the load's colour: the builders the project has / the ones it asks for. */
export function TeamOf({ project, className }: { project: Project; className?: string }) {
  const fx = useGameStore(useShallow((s) => (effortOn(s.state) ? projectEffort(s.state, project) : null)))
  if (!fx) return null
  const good = loadGood(fx.load)
  return (
    <span title={t('fx.tag.load')} className={cx('tabular inline-flex items-center gap-1 text-[11px] font-semibold', good === false ? 'text-negative-ink' : good === true ? 'text-positive-ink' : 'text-ink-2', className)}>
      <Icon name="users" size={12} />
      {t('team.teamOf', { n: fixed(fx.supply, 1), m: fixed(fx.demand, 1) })}
    </span>
  )
}

/** The project's lead, gold star in front. */
export function LeadLine({ project }: { project: Project }) {
  const name = useGameStore((s) => (project.leadId !== undefined ? s.state.employees.find((e) => e.id === project.leadId)?.name : undefined))
  if (!name) return null
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold text-ink-2">
      <Icon name="star" size={12} fill="currentColor" className="shrink-0 text-g-equity" />
      <span className="truncate">{name}</span>
    </span>
  )
}

/** One "Sprint · 14g" row (chips ▲ +%20, battery +3/g, Series A+ debt); while it runs: days left and "Bitir"; the cooldown is passive. */
export function SprintRow({ project }: { project: Project }) {
  const fx = useGameStore(useShallow((s) => (effortOn(s.state) && hasOpenWork(project) ? projectEffort(s.state, project) : null)))
  const stage = useGameStore((s) => s.state.stage)
  if (!fx) return null
  if (fx.sprinting)
    return (
      <ChoiceRow
        primary
        icon={{ icon: 'rocket', color: 'var(--color-negative)' }}
        label={t('team.sprintLeft', { d: fx.sprintLeft })}
        chips={[{ icon: 'close', label: '', text: t('team.sprintEnd'), good: null, title: t('team.sprintEnd') }]}
        onClick={() => dispatch({ type: 'sprint', projectId: project.id, on: false })}
      />
    )
  const label = `${t('team.sprint')} · ${t('fx.daysShort', { v: B.SPRINT_DAYS })}`
  if (fx.cooldown > 0) return <ChoiceRow disabled icon={{ icon: 'rocket', color: 'var(--color-ink-3)' }} label={label} chips={[cooldownChip(fx.cooldown)]} onClick={() => undefined} />
  if (!fx.canSprint) return null
  return <ChoiceRow icon={{ icon: 'rocket', color: 'var(--color-negative)' }} label={label} chips={sprintChips({ stage }, fx.engineers)} onClick={() => dispatch({ type: 'sprint', projectId: project.id, on: true })} />
}
