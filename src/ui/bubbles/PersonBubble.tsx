// The card of an employee the player tapped in the scene (T14, Two Point's card beside the character): it opens
// beside them, already expanded (the world holds while it is open). Face, dept and the numbers that matter at a
// glance (morale, salary, battery, load, fit), then the project to put them on (each row with the load they would
// have there) and, from Pre-seed, the effort moves: pace, leave, lead (E3). Desk moves, firing and the rest are one tap
// further in the panel (Detay); the Ekip panel stays the list.
import { useShallow } from 'zustand/react/shallow'
import { DEPT_TEXT } from '../../content'
import { effortOn } from '../../engine/effort'
import type { EmployeeId } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import type { Chip } from '../EffectChips'
import { ChipRow } from '../EffectChips'
import { FatigueMeter, loadChip, loadIf, PersonEffortRows } from '../effort'
import { money } from '../format'
import { t } from '../i18n'
import { CATEGORY_COLOR, CATEGORY_ICON } from '../panels/ProjectsPanel'
import { DEPT_COLOR } from '../theme'
import { ChoiceRow, Expandable, launch } from './Expandable'

const MAX_PROJECTS = 3

export function PersonBubble({ bubbleKey, employeeId }: { bubbleKey: string; employeeId: EmployeeId }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const { e, projects } = useGameStore(useShallow((s) => ({ e: s.state.employees.find((x) => x.id === employeeId), projects: s.state.projects })))
  // The effort numbers (derived.people) and the "if they joined" loads read the whole state; the card is one bubble.
  const state = useGameStore((s) => s.state)
  if (!e) return null
  const detail = () => useGameStore.getState().openPanel({ kind: 'detail', selection: { kind: 'employee', id: e.id } })
  const project = projects.find((p) => p.id === e.projectId)
  const morale = Math.round(e.morale)
  const stats: Chip[] = [
    { icon: 'heart', label: t('fx.tag.morale'), text: String(morale), good: morale >= 50, title: t('hud.morale') },
    { icon: 'cash', label: t('fx.tag.salary'), text: money(e.salary), tail: t('bubble.month'), good: true, title: t('detail.salary') },
  ]
  const effort = effortOn(state) ? state.derived.people?.[e.id] : undefined
  const fitChip: Chip | null = effort?.fit && project ? { icon: CATEGORY_ICON[project.category], label: '', text: '✓', good: true, title: t('team.fit') } : null
  const sub: Chip[] = effort
    ? [loadChip(effort.load), ...(fitChip ? [fitChip] : []), ...(project?.leadId === e.id ? [{ icon: 'star' as const, label: '', text: t('team.lead'), good: true, title: t('team.lead') }] : [])]
    : []
  // The current project first, then the others: a tap moves them, the current one's tap takes them off it.
  const list = [...(project ? [project] : []), ...projects.filter((p) => p.id !== e.projectId)].slice(0, MAX_PROJECTS)
  return (
    <Expandable
      bubbleKey={bubbleKey}
      kind="person"
      face={`team-${e.dept}`}
      mark={{ icon: 'users', color: DEPT_COLOR[e.dept].dot }}
      speaker={e.name}
      line={DEPT_TEXT[e.dept].name}
      detail={detail}
    >
      <ChipRow chips={stats} />
      {effort && (
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <FatigueMeter fatigue={e.fatigue ?? 0} />
          <ChipRow chips={sub} />
        </span>
      )}
      {list.length > 0 ? (
        <>
          <span className="ui-label px-0.5 pt-1">{project ? t('detail.project') : t('bubble.assign')}</span>
          {list.map((p) => {
            const on = p.id === e.projectId
            return (
              <ChoiceRow
                key={p.id}
                primary={on}
                icon={{ icon: on ? 'check' : CATEGORY_ICON[p.category], color: CATEGORY_COLOR[p.category] }}
                label={<span className="block max-w-[200px] truncate">{p.name}</span>}
                chips={effort ? [loadChip(loadIf(state, p, e))] : undefined}
                title={p.name}
                onClick={() => dispatch({ type: 'assign', employeeId: e.id, projectId: on ? null : p.id })}
              />
            )
          })}
        </>
      ) : (
        <ChoiceRow primary label={t('bubble.startProject')} onClick={() => launch(() => useGameStore.getState().openPanel({ kind: 'projects' }))} />
      )}
      <PersonEffortRows e={e} />
    </Expandable>
  )
}
