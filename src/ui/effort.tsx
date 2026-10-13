// Effort management in the UI (E3): the chips, the battery meter and the controls the person card, the staff bubbles,
// the Ekip / Projeler panels and the detail panel share. Numbers come from the engine (balance, effort.ts); nothing here
// decides a rule. From Pre-seed only: in the Garage effortOn is false and every control hides.
import * as B from '../engine/balance'
import { buildersOf, effortOn, fatigueRate, fits, founderProject, hasOpenWork, isBuilder, isSprinting, onLeave, projectDemand, projectLoad, supplyOf } from '../engine/effort'
import { useShallow } from 'zustand/react/shallow'
import type { Candidate, Employee, GameState, Pace, Project, ProjectCategory } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { CONTENT } from '../content'
import { ChipRow, type Chip } from './EffectChips'
import { fixed, pct } from './format'
import { t } from './i18n'
import { Icon, type IconName } from './icons'
import { Bar, cx } from './primitives'
import { ChoiceRow, launch } from './bubbles/Expandable'
import { CATEGORY_COLOR, CATEGORY_ICON } from './panels/ProjectsPanel'

const dispatch = (a: Parameters<ReturnType<typeof useGameStore.getState>['dispatch']>[0]) => useGameStore.getState().dispatch(a)

// ---------------------------------------------------------------------------
// Tones and chips (pure)
// ---------------------------------------------------------------------------

/** Fatigue: red from FATIGUE_TIRED, green under 40, neutral between. */
export const fatigueGood = (f: number): boolean | null => (f >= B.FATIGUE_TIRED ? false : f < 40 ? true : null)
/** Load: over 1.2 red, 0.8–1.2 green, the rest (a slack project) neutral grey. */
export const loadGood = (l: number): boolean | null => (l > 1.2 ? false : l >= 0.8 ? true : null)

const signed = (v: number, text: string): string => `${v < 0 ? '−' : '+'}${text}`

/** The load as a word: under 0.7 "az", up to 1.2 "iyi", up to 1.6 "ağır", beyond "aşırı". */
export const loadWord = (load: number): string => t(load < 0.7 ? 'load.low' : load <= 1.2 ? 'load.ok' : load <= 1.6 ? 'load.heavy' : 'load.over')

/** "Yük 1.4× ağır". */
export const loadChip = (load: number): Chip => ({ icon: 'scale', label: t('fx.tag.load'), text: `${fixed(load, 1)}×`, tail: loadWord(load), good: loadGood(load), title: t('fx.tag.load') })

/** The output a tired or burnt-out person already loses ("Hız −%20"); none when they are fresh. */
export const hiddenLossChip = (fatigueFactor: number): Chip[] => (fatigueFactor < 1 ? [outputChip(`−${pct(1 - fatigueFactor)}`, false)] : [])

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

/** The one label a person shows (team list, person card pill, bubbles): the cause, so a bored person is never "Yorgun". */
export interface PersonLabel {
  key: 'leaving' | 'leave' | 'burnout' | 'tired' | 'bored' | 'lowMorale' | 'new' | 'break' | 'working'
  text: string
  /** The mark colour: red only for what costs you a person or their output. */
  dot: string
  tone: string
}

export function personLabel(s: GameState, e: Employee): PersonLabel {
  const day = s.time.day
  const f = e.fatigue ?? 0
  const on = effortOn(s)
  const make = (key: PersonLabel['key'], dot: string, tone: string, d?: number): PersonLabel => ({ key, text: t(`person.${key}`, { d: d ?? 0 }), dot, tone })
  const red = 'var(--color-negative)'
  const grey = 'var(--color-ink-3)'
  if (e.status === 'leaving') return make('leaving', red, 'text-ink', e.leaveDay !== undefined ? Math.max(0, Math.ceil(e.leaveDay - day)) : 0)
  if (on && onLeave(e, day)) return make('leave', grey, 'text-ink-2', Math.ceil((e.offUntil ?? 0) - day))
  if (on && (f >= B.FATIGUE_BURNOUT)) return make('burnout', red, 'text-ink')
  if (on && f >= B.FATIGUE_TIRED) return make('tired', grey, 'text-ink')
  if (on && e.dept !== 'sales' && (e.loadAvg ?? 1) < B.UNDERLOAD && (e.boredDays ?? 0) >= BORED_LABEL_DAYS) return make('bored', 'var(--color-energy)', 'text-ink')
  if (e.morale < B.TIRED_MORALE) return make('lowMorale', grey, 'text-ink')
  if (e.status === 'onboarding') return make('new', grey, 'text-ink-2')
  if (e.status === 'break') return make('break', grey, 'text-ink-2')
  return make('working', 'var(--color-positive)', 'text-ink-2')
}

/** Days under UNDERLOAD before "Sıkılıyor" shows (design §4.3). */
const BORED_LABEL_DAYS = 7

// ---------------------------------------------------------------------------
// What a person / a project can be asked (pure)
// ---------------------------------------------------------------------------

export interface PersonControls {
  /** Their own pace, or null when pace does not apply (garage, sales, leaving). */
  pace: Pace | null
  /** 'ready' | days of cooldown left | null (not offered: rested, new, away). */
  leave: 'ready' | number | null
  /** Offered as the lead of their project (or the current lead can step down); 'locked' = shown, not yet possible. */
  lead: 'make' | 'unlead' | 'locked' | null
  /** Why a 'locked' lead row is not yet possible: before Seed, or too few builders on the project (flat: useShallow compares it). */
  leadLock: 'stage' | 'team' | null
  /** Builders on the project now (the "n/3 kişi" chip). */
  leadTeam: number
  /** The first promotion ever raises the salary. */
  leadFirst: boolean
}

export function personControls(s: GameState, e: Employee): PersonControls {
  const none: PersonControls = { pace: null, leave: null, lead: null, leadLock: null, leadTeam: 0, leadFirst: false }
  if (!effortOn(s) || e.status === 'leaving') return none
  const day = s.time.day
  const pace = e.dept === 'sales' ? null : (e.pace ?? 'normal')
  const tired = (e.fatigue ?? 0) >= 40 || e.status === 'burnout'
  const away = onLeave(e, day) || e.status === 'onboarding'
  const leave = !tired || away ? null : day < (e.leaveReadyDay ?? -Infinity) ? Math.ceil((e.leaveReadyDay ?? 0) - day) : 'ready'
  const p = e.projectId !== undefined ? s.projects.find((x) => x.id === e.projectId) : undefined
  let lead: PersonControls['lead'] = null
  let leadLock: PersonControls['leadLock'] = null
  let leadTeam = 0
  if (p && isBuilder(e) && e.status !== 'onboarding') {
    const n = buildersOf(s, p).length
    leadTeam = n
    if (p.leadId === e.id) lead = 'unlead'
    else if (s.stage < B.LEAD_MIN_STAGE) {
      lead = 'locked'
      leadLock = 'stage'
    } else if (n >= B.LEAD_MIN_TEAM) lead = 'make'
    else {
      lead = 'locked'
      leadLock = 'team'
    }
  }
  return { pace, leave, lead, leadLock, leadTeam, leadFirst: !e.wasLead }
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

/** Where a bored or idle builder helps most: the project to put them on, their load now and after joining. */
export interface ProjectFit {
  project: Project
  now: number
  after: number
  fit: boolean
}

/**
 * Among the projects with open work (not their own), the one whose load after they join stays at most 1.2, fluent
 * projects first, then the heaviest load after joining. None under 1.2: the project that needs hands most. Null when no
 * project has open work.
 */
export function bestProjectFor(s: GameState, e: Employee): ProjectFit | null {
  const now = s.derived.people?.[e.id]?.load ?? 0
  const open = s.projects.filter((p) => p.id !== e.projectId && hasOpenWork(p)).map((project) => ({ project, now, after: loadIf(s, project, e), fit: fits(e, project) }))
  if (open.length === 0) return null
  const fine = open.filter((x) => x.after <= 1.2)
  if (fine.length > 0) return fine.sort((a, b) => Number(b.fit) - Number(a.fit) || b.after - a.after)[0]!
  return open.sort((a, b) => b.after - a.after)[0]!
}

/** "Yük 0.3× → 1.1×" for the "Projeye ata" row. */
export const loadMoveChip = (now: number, after: number): Chip => ({ icon: 'scale', label: t('fx.tag.load'), text: `${fixed(now, 1)}× → ${fixed(after, 1)}×`, good: loadGood(after), title: t('fx.tag.load') })

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

/** What a pace does for this person: output ("Hız −%15") and their own fatigue per day ("Yorgunluk +1.2/g"). */
export function paceChips(pace: 'normal' | 'calm', rate: number): Chip[] {
  return [outputChip(pace === 'calm' ? `−${pct(1 - B.PACE_OUTPUT.calm)}` : `%${Math.round(B.PACE_OUTPUT.normal * 100)}`, pace === 'calm' ? false : null), batteryChip(rate, t('fx.tag.fatigue'))]
}

/** Both paces side by side, the one in force filled; each shows its own numbers for this person. A tap on the other switches. */
export function PaceRow({ e }: { e: Employee }) {
  const cur = e.pace ?? 'normal'
  const calm = cur === 'calm'
  const rates = useGameStore(useShallow((s) => ({ normal: fatigueRate(s.state, CONTENT, e, 'normal'), calm: fatigueRate(s.state, CONTENT, e, 'calm') })))
  return (
    <div role="group" aria-label={t('team.pace')} className="grid grid-cols-2 gap-1.5">
      {(['normal', 'calm'] as const).map((pace) => {
        const on = (pace === 'calm') === calm
        return (
          <button
            key={pace}
            type="button"
            aria-pressed={on}
            onClick={(ev) => {
              ev.stopPropagation()
              if (!on) dispatch({ type: 'setPace', employeeId: e.id, pace })
            }}
            className={cx(
              'flex min-h-11 min-w-0 flex-col items-start justify-center gap-1 rounded-control border px-2.5 py-1.5 text-left transition-colors',
              on ? 'border-ink bg-surface text-ink ring-1 ring-ink' : 'border-border bg-surface-2/60 text-ink hover:border-border-strong hover:bg-surface-2',
            )}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-snug">
              <Icon name="battery" size={15} tone={pace === 'calm' ? 'var(--color-positive)' : 'var(--color-ink-3)'} className="shrink-0" />
              {t(`pace.${pace}`)}
            </span>
            <ChipRow chips={paceChips(pace, rates[pace])} />
          </button>
        )
      })}
    </div>
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

/** Why "Lider yap" waits: "Seed" (stage) or "2/3 kişi". */
export const leadLockChip = (lock: NonNullable<PersonControls['leadLock']>, team: number): Chip =>
  lock === 'stage'
    ? { icon: 'lock', label: '', text: CONTENT.stages[B.LEAD_MIN_STAGE]!.name, good: null, title: t('team.leadLockStage') }
    : { icon: 'users', label: '', text: t('team.teamOf', { n: team, m: B.LEAD_MIN_TEAM }), good: null, title: t('team.leadLockTeam', { m: B.LEAD_MIN_TEAM }) }

/** The "Projeye ata" suggestion a bored or idle builder's card opens with; null when it does not apply. */
export function assignSuggestion(s: GameState, e: Employee): { fit: ProjectFit | null } | null {
  if (!effortOn(s) || !isBuilder(e) || e.status === 'leaving' || e.status === 'onboarding') return null
  const key = personLabel(s, e).key
  return e.projectId === undefined || key === 'bored' ? { fit: bestProjectFor(s, e) } : null
}

/** "Projeye ata: {project}" with the load before → after; with no open work, "İş yok: modül ekle" opens that project's module row. */
export function AssignRow({ e }: { e: Employee }) {
  const sug = useGameStore(
    useShallow((s) => {
      const a = assignSuggestion(s.state, e)
      if (!a) return null
      const f = a.fit
      return { id: f?.project.id ?? null, name: f?.project.name ?? '', category: f?.project.category ?? 'web', now: f?.now ?? 0, after: f?.after ?? 0, fit: f?.fit ?? false }
    }),
  )
  if (!sug) return null
  if (sug.id === null)
    return <ChoiceRow primary icon={{ icon: 'plus', color: 'var(--color-ink-3)' }} label={t('team.noWork')} onClick={() =>
          launch(() => {
            // The module row of the first project (where "Ekle" lives); no project at all → the list.
            const api = useGameStore.getState()
            const p = api.state.projects[0]
            if (p) api.select({ kind: 'project', id: p.id })
            else api.openPanel({ kind: 'projects' })
          })
        }
      />
  const chips = [loadMoveChip(sug.now, sug.after), ...(sug.fit ? [{ icon: CATEGORY_ICON[sug.category], label: '', text: '✓', good: true, title: t('team.fit') } satisfies Chip] : [])]
  return (
    <ChoiceRow
      primary
      icon={{ icon: CATEGORY_ICON[sug.category], color: CATEGORY_COLOR[sug.category] }}
      label={<span className="block max-w-[200px] truncate">{t('team.assignTo', { project: sug.name })}</span>}
      title={sug.name}
      chips={chips}
      onClick={() => dispatch({ type: 'assign', employeeId: e.id, projectId: sug.id! })}
    />
  )
}

/** The person-level effort controls: "Projeye ata" (bored / idle), pace, leave (when worn out), lead. */
export function PersonEffortRows({ e, skipAssign }: { e: Employee; skipAssign?: boolean }) {
  const c = useGameStore(useShallow((s) => personControls(s.state, e)))
  const projectId = e.projectId
  return (
    <>
      {!skipAssign && <AssignRow e={e} />}
      {c.pace && <PaceRow e={e} />}
      {c.leave !== null && <LeaveRow e={e} leave={c.leave} />}
      {c.lead === 'locked' && projectId !== undefined && (
        <ChoiceRow disabled icon={{ icon: 'star', color: 'var(--color-ink-3)' }} label={t('team.makeLead')} chips={c.leadLock ? [leadLockChip(c.leadLock, c.leadTeam)] : []} onClick={() => undefined} />
      )}
      {(c.lead === 'make' || c.lead === 'unlead') && projectId !== undefined && (
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
