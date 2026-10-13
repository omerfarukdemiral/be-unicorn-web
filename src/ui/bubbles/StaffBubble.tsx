// An employee who needs the player, answered right above their head (scene-first spec §2 rows 11–12). Same engine
// actions as the Ekip panel: a leaver gets raise / talk / let go (a bored one the projects to move to first), a builder
// with nothing to build gets the open projects (or a launcher to start one). From Pre-seed (E3) the worn out ask too:
// burnt out (leave / slow down / let go), tired (slow down / leave / carry on), bored (the busiest projects).
// Effects read as labelled chips, never a sentence.
import { useShallow } from 'zustand/react/shallow'
import { actionEnergy } from '../../engine/founder'
import * as B from '../../engine/balance'
import { hasOpenWork, projectLoad, fatigueRate } from '../../engine/effort'
import { CONTENT } from '../../content'
import type { Employee, EmployeeId, GameState, Project } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import type { Chip } from '../EffectChips'
import { batteryChip, calmChips, carryOnChips, cooldownChip, fatigueGood, leaveChips, loadChip, outputChip, personControls } from '../effort'
import { money, pct } from '../format'
import { t } from '../i18n'
import { CATEGORY_COLOR, CATEGORY_ICON } from '../panels/ProjectsPanel'
import { ChoiceRow, Expandable, launch } from './Expandable'

export type StaffNeed = 'leaving' | 'burnout' | 'tired' | 'bored' | 'calmBack' | 'idle'

const MAX_PROJECTS = 3
/** The busiest projects a bored person can move to. */
const MAX_BUSY = 2

/** Projects with work left, the heaviest load first (the ones a bored person would help most). */
export function busiestProjects(s: GameState, skip?: string): { project: Project; load: number }[] {
  return s.projects
    .filter((p) => p.id !== skip && hasOpenWork(p))
    .map((project) => ({ project, load: projectLoad(s, project) }))
    .sort((a, b) => b.load - a.load)
    .slice(0, MAX_BUSY)
}

export function StaffBubble({ bubbleKey, employeeId, need }: { bubbleKey: string; employeeId: EmployeeId; need: StaffNeed }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const state = useGameStore((s) => s.state)
  const { e, day, energy, projects } = useGameStore(
    useShallow((s) => ({
      e: s.state.employees.find((x) => x.id === employeeId),
      day: Math.floor(s.state.time.day),
      energy: actionEnergy(s.state, B.TALK_ENERGY),
      projects: s.state.projects,
    })),
  )
  if (!e) return null
  const detail = () => useGameStore.getState().openPanel({ kind: 'detail', selection: { kind: 'employee', id: e.id } })

  if (need === 'leaving') {
    const left = e.leaveDay !== undefined ? Math.max(0, Math.ceil(e.leaveDay - day)) : null
    // The notice's cause (E3): a burnt-out leaver stays calmer and rested, a bored one only buys time (the fix is work).
    const cause = e.leaveCause
    const rested: Chip = { icon: 'battery', label: t('pace.calm'), text: String(B.RETAIN_BURNOUT_FATIGUE).replace('-', '−'), good: true, title: t('fx.tag.fatigue') }
    const busy = cause === 'bored' ? busiestProjects(state, e.projectId) : []
    const raise = Math.round(e.salary * (B.RAISE_FACTOR - 1))
    const respond = (response: 'raise' | 'talk' | 'letGo') => dispatch({ type: 'respondResignation', employeeId: e.id, response })
    const talk: Chip[] = [
      ...(energy > 0 ? [{ icon: 'bolt' as const, label: t('fx.tag.energy'), text: `−${energy}`, good: false, title: t('fx.energyLabel') }] : []),
      { icon: 'heart', label: t('fx.tag.morale'), text: `+${B.TALK_MORALE}`, good: true, title: t('hud.morale') },
      ...(cause === 'burnout' ? [rested] : []),
    ]
    return (
      <Expandable
        bubbleKey={bubbleKey}
        kind="staff"
        face={`team-${e.dept}`}
        attention
        mark={{ icon: 'warning', color: 'var(--color-negative)' }}
        line={
          left === null
            ? t('bubble.leavingNow', { name: e.name })
            : t(cause === 'burnout' ? 'bubble.leavingBurnout' : cause === 'bored' ? 'bubble.leavingBored' : 'bubble.leaving', { name: e.name, d: left })
        }
        detail={detail}
      >
        {busy.map(({ project: p, load }) => (
          <ChoiceRow
            key={p.id}
            icon={{ icon: CATEGORY_ICON[p.category], color: CATEGORY_COLOR[p.category] }}
            label={<span className="block max-w-[140px] truncate">{p.name}</span>}
            title={p.name}
            chips={[loadChip(load)]}
            onClick={() => dispatch({ type: 'assign', employeeId: e.id, projectId: p.id })}
          />
        ))}
        <ChoiceRow
          primary
          label={t('team.raise')}
          onClick={() => respond('raise')}
          chips={[
            { icon: 'cash', label: t('fx.tag.salary'), text: `−${money(raise)}`, tail: t('bubble.month'), good: false, title: t('hud.cash') },
            { icon: 'heart', label: t('fx.tag.morale'), text: `+${B.RAISE_MORALE}`, good: true, title: t('hud.morale') },
            ...(cause === 'burnout' ? [rested] : []),
          ]}
        />
        <ChoiceRow label={t('team.talk')} onClick={() => respond('talk')} chips={talk} />
        <ChoiceRow label={t('team.letGo')} onClick={() => respond('letGo')} chips={[{ icon: 'users', label: t('fx.tag.team'), text: '−1', good: false, title: e.name }]} />
      </Expandable>
    )
  }

  if (need === 'calmBack') return <CalmBack bubbleKey={bubbleKey} e={e} state={state} detail={detail} />
  if (need === 'burnout' || need === 'tired' || need === 'bored') return <EffortNeed bubbleKey={bubbleKey} e={e} need={need} state={state} detail={detail} />

  const open = projects.slice(0, MAX_PROJECTS)
  return (
    <Expandable bubbleKey={bubbleKey} kind="staff" face={`team-${e.dept}`} mark={{ icon: 'users', color: 'var(--color-energy)' }} line={t('bubble.idle', { name: e.name })} detail={detail}>
      {open.length > 0 ? (
        <>
          {/* A bare project name does not say what a tap does: one caption names the move. */}
          <span className="ui-label px-0.5">{t('bubble.assign')}</span>
          {open.map((p) => (
            <ChoiceRow
              key={p.id}
              icon={{ icon: CATEGORY_ICON[p.category], color: CATEGORY_COLOR[p.category] }}
              label={<span className="block max-w-[140px] truncate">{p.name}</span>}
              title={p.name}
              onClick={() => dispatch({ type: 'assign', employeeId: e.id, projectId: p.id })}
            />
          ))}
        </>
      ) : (
        <ChoiceRow primary label={t('bubble.startProject')} onClick={() => launch(() => useGameStore.getState().openPanel({ kind: 'projects' }))} />
      )}
    </Expandable>
  )
}

/** "Dinlendi. Normale dönsün mü?": back to the normal pace (faster, tires again) or stay calm (waved off for a while). */
function CalmBack({ bubbleKey, e, state, detail }: { bubbleKey: string; e: Employee; state: GameState; detail: () => void }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const gain = 1 / B.PACE_OUTPUT.calm - 1
  return (
    <Expandable bubbleKey={bubbleKey} kind="staff" face={`team-${e.dept}`} mark={{ icon: 'battery', color: 'var(--color-positive)' }} line={t('bubble.calmBack', { name: e.name })} detail={detail}>
      <ChoiceRow
        primary
        label={t('team.backToNormal')}
        chips={[outputChip(`+${pct(gain)}`, true), batteryChip(fatigueRate(state, CONTENT, e, 'normal'), t('fx.tag.fatigue'))]}
        onClick={() => dispatch({ type: 'setPace', employeeId: e.id, pace: 'normal' })}
      />
      <ChoiceRow label={t('team.keepCalm')} onClick={() => dispatch({ type: 'ackStaff', employeeId: e.id })} />
    </Expandable>
  )
}

/** Burnt out / tired / bored: the moves that change it, the first one the main move. */
function EffortNeed({ bubbleKey, e, need, state, detail }: { bubbleKey: string; e: Employee; need: 'burnout' | 'tired' | 'bored'; state: GameState; detail: () => void }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const c = personControls(state, e)
  const calm = (e.pace ?? 'normal') === 'calm'
  const slow = !calm && (
    <ChoiceRow primary={need === 'tired'} label={t('team.slowDown')} chips={calmChips()} onClick={() => dispatch({ type: 'setPace', employeeId: e.id, pace: 'calm' })} />
  )
  // Rows of "İzin ver": ready, or passive while the cooldown runs.
  const leave =
    c.leave === 'ready' ? (
      <ChoiceRow primary={need === 'burnout'} label={t('team.leave')} chips={leaveChips()} onClick={() => dispatch({ type: 'giveLeave', employeeId: e.id })} />
    ) : typeof c.leave === 'number' ? (
      <ChoiceRow disabled label={t('team.leave')} chips={[cooldownChip(c.leave)]} onClick={() => undefined} />
    ) : null
  const mark = { icon: need === 'bored' ? ('users' as const) : ('battery' as const), color: need === 'bored' ? 'var(--color-energy)' : fatigueGood(e.fatigue ?? 0) === false ? 'var(--color-negative)' : 'var(--color-energy)' }
  return (
    <Expandable bubbleKey={bubbleKey} kind="staff" face={`team-${e.dept}`} attention={need === 'burnout'} mark={mark} line={t(`bubble.${need}`, { name: e.name })} detail={detail}>
      {need === 'burnout' && (
        <>
          {leave}
          {slow}
          <ChoiceRow label={t('bubble.letGo')} onClick={() => dispatch({ type: 'fire', employeeId: e.id })} chips={[{ icon: 'users', label: t('fx.tag.team'), text: '−1', good: false, title: e.name }]} />
        </>
      )}
      {need === 'tired' && (
        <>
          {slow}
          {leave}
          <ChoiceRow label={t('team.carryOn')} chips={carryOnChips()} onClick={() => dispatch({ type: 'ackStaff', employeeId: e.id })} />
        </>
      )}
      {need === 'bored' && <BoredRows e={e} state={state} />}
    </Expandable>
  )
}

/** Where a bored person would be needed: the busiest projects (icon, name, its load), or a new one; "Devam" waves it off. */
function BoredRows({ e, state }: { e: Employee; state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const busy = busiestProjects(state, e.projectId)
  return (
    <>
      {busy.length > 0 ? (
        busy.map(({ project: p, load }, i) => (
          <ChoiceRow
            key={p.id}
            primary={i === 0}
            icon={{ icon: CATEGORY_ICON[p.category], color: CATEGORY_COLOR[p.category] }}
            label={<span className="block max-w-[140px] truncate">{p.name}</span>}
            title={p.name}
            chips={[loadChip(load)]}
            onClick={() => dispatch({ type: 'assign', employeeId: e.id, projectId: p.id })}
          />
        ))
      ) : (
        <ChoiceRow primary label={t('projects.new')} onClick={() => launch(() => useGameStore.getState().openPanel({ kind: 'projects' }))} />
      )}
      <ChoiceRow label={t('team.carryOn')} onClick={() => dispatch({ type: 'ackStaff', employeeId: e.id })} />
    </>
  )
}
