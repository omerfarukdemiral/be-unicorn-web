// An employee who needs the player, answered right above their head (scene-first spec §2 rows 11–12). Same engine
// actions as the Ekip panel: a leaver gets raise / talk / let go, a builder with nothing to build gets the open
// projects (or a launcher to start one). Effects read as labelled chips, never a sentence.
import { useShallow } from 'zustand/react/shallow'
import { actionEnergy } from '../../engine/founder'
import * as B from '../../engine/balance'
import type { EmployeeId } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import type { Chip } from '../EffectChips'
import { money } from '../format'
import { t } from '../i18n'
import { CATEGORY_COLOR, CATEGORY_ICON } from '../panels/ProjectsPanel'
import { ChoiceRow, Expandable, launch } from './Expandable'

export type StaffNeed = 'leaving' | 'idle'

const MAX_PROJECTS = 3

export function StaffBubble({ bubbleKey, employeeId, need }: { bubbleKey: string; employeeId: EmployeeId; need: StaffNeed }) {
  const dispatch = useGameStore((s) => s.dispatch)
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
    const raise = Math.round(e.salary * (B.RAISE_FACTOR - 1))
    const respond = (response: 'raise' | 'talk' | 'letGo') => dispatch({ type: 'respondResignation', employeeId: e.id, response })
    const talk: Chip[] = [
      ...(energy > 0 ? [{ icon: 'bolt' as const, label: t('fx.tag.energy'), text: `−${energy}`, good: false, title: t('fx.energyLabel') }] : []),
      { icon: 'heart', label: t('fx.tag.morale'), text: `+${B.TALK_MORALE}`, good: true, title: t('hud.morale') },
    ]
    return (
      <Expandable
        bubbleKey={bubbleKey}
        kind="staff"
        face={`team-${e.dept}`}
        attention
        mark={{ icon: 'warning', color: 'var(--color-negative)' }}
        line={left !== null ? t('bubble.leaving', { name: e.name, d: left }) : t('bubble.leavingNow', { name: e.name })}
        detail={detail}
      >
        <ChoiceRow
          primary
          label={t('team.raise')}
          onClick={() => respond('raise')}
          chips={[
            { icon: 'cash', label: t('fx.tag.salary'), text: `−${money(raise)}`, tail: t('bubble.month'), good: false, title: t('hud.cash') },
            { icon: 'heart', label: t('fx.tag.morale'), text: `+${B.RAISE_MORALE}`, good: true, title: t('hud.morale') },
          ]}
        />
        <ChoiceRow label={t('team.talk')} onClick={() => respond('talk')} chips={talk} />
        <ChoiceRow label={t('team.letGo')} onClick={() => respond('letGo')} chips={[{ icon: 'users', label: t('fx.tag.team'), text: '−1', good: false, title: e.name }]} />
      </Expandable>
    )
  }

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
