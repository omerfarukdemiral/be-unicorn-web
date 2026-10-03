// Ekip: candidate pool (hire by dept) + team list (status, morale, resignation responses). HUD grammar (GAMEPLAY V2
// §10.5): 36px person cards with a 4px gap (no hairline list), salary as the number, every hire carries its CostPreview.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { idleBuilders } from '../../engine/loopSelectors'
import { DEPTS, type Candidate, type Dept, type Employee } from '../../engine/types'
import { DEPT_TEXT } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money } from '../format'
import { Bar, Button, Chip, CostPreview, cx, Dot, Empty, Pill, QualityStars } from '../primitives'
import { useSpendPreview } from '../widgets'
import { DEPT_COLOR, moraleTone, soft, STATUS_DOT, STATUS_TONE } from '../theme'

type Sub = 'hire' | 'team'

export function TeamPanel() {
  const leaving = useGameStore((s) => s.state.employees.some((e) => e.status === 'leaving'))
  const teamSize = useGameStore((s) => s.state.employees.length)
  const [sub, setSub] = useState<Sub>(leaving ? 'team' : 'hire')
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <Chip active={sub === 'hire'} onClick={() => setSub('hire')} icon="plus">
          {t('team.candidates')}
        </Chip>
        <Chip active={sub === 'team'} onClick={() => setSub('team')} icon="users">
          {t('team.members', { n: teamSize })}
        </Chip>
      </div>
      {sub === 'hire' ? <HireView /> : <TeamList />}
    </div>
  )
}

export function DeptPill({ dept }: { dept: Dept }) {
  return <Pill dot={DEPT_COLOR[dept].dot} tint={DEPT_COLOR[dept].dot}>{DEPT_TEXT[dept].short}</Pill>
}

/** Initials on a light tint of the department hue, with a thin ring in the same hue. Text stays ink. */
export function Avatar({ name, dept, size = 36 }: { name: string; dept: Dept; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border text-[11px] font-semibold tracking-wide text-ink"
      style={{ width: size, height: size, background: soft(DEPT_COLOR[dept].dot, 18), borderColor: soft(DEPT_COLOR[dept].dot, 45) }}
    >
      {initials}
    </span>
  )
}

function HireView() {
  const [dept, setDept] = useState<Dept | 'all'>('all')
  const { candidates, day, showQuality, freeDesks, emptySlots } = useGameStore(
    useShallow((s) => {
      const open = new Set(s.state.office.rings.filter((r) => r.unlocked).map((r) => r.index))
      const free = s.state.office.slots.filter((sl) => sl.type === 'desk' && !sl.occupantId && !sl.spanOf && sl.id !== 'founder' && (sl.ring === 0 || open.has(sl.ring)))
      return {
        candidates: s.state.candidates,
        day: Math.floor(s.state.time.day),
        showQuality: s.state.unlockedWidgets.includes('candidateQuality'),
        // Same rule as the engine: a hire needs a desk item on a free desk slot.
        freeDesks: free.filter((sl) => sl.itemId !== undefined).length,
        emptySlots: free.filter((sl) => sl.itemId === undefined).length,
      }
    }),
  )
  const dispatch = useGameStore((s) => s.dispatch)
  const list = candidates.filter((c) => dept === 'all' || c.dept === dept)

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip active={dept === 'all'} onClick={() => setDept('all')}>
          {t('shop.all')}
        </Chip>
        {DEPTS.map((d) => (
          <Chip key={d} active={dept === d} onClick={() => setDept(d)}>
            <Dot color={DEPT_COLOR[d].dot} size={6} />
            {DEPT_TEXT[d].name}
          </Chip>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-2">
        <span className={cx('inline-flex items-center gap-1', freeDesks === 0 && 'font-semibold text-ink')}>
          {freeDesks === 0 ? <Dot color="var(--color-energy)" size={6} /> : <Icon name="desk" size={14} />}
          {freeDesks > 0 ? t('team.freeDesks', { n: freeDesks }) : emptySlots > 0 ? t('team.needDeskItem') : t('team.noSlot')}
        </span>
        <Button size="sm" tone="ghost" icon="refresh" onClick={() => dispatch({ type: 'refreshCandidates' })}>
          {t('team.refresh')}
        </Button>
      </div>
      {list.length === 0 ? (
        <Empty text={t('team.noCandidates')} icon="users" />
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((c) => (
            <CandidateCard key={c.id} candidate={c} day={day} showQuality={showQuality} onHire={() => dispatch({ type: 'hire', candidateId: c.id })} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** One candidate: avatar, name + dept, the salary (the number), days left, the hire commit with its runway preview. */
function CandidateCard({ candidate: c, day, showQuality, onHire }: { candidate: Candidate; day: number; showQuality: boolean; onHire: () => void }) {
  const preview = useSpendPreview(0, c.salary)
  const left = Math.ceil(c.expiresDay - day)
  return (
    <li className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-surface-2/60 px-1.5 py-1">
      <Avatar name={c.name} dept={c.dept} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Dot color={DEPT_COLOR[c.dept].dot} size={6} />
          <span className="truncate text-[13px] font-semibold">{c.name}</span>
          {showQuality && <QualityStars quality={c.quality} />}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <span className="tabular text-[15px] font-semibold leading-tight text-ink">{money(c.salary)}</span>
          <span className="tabular inline-flex items-center gap-0.5">
            <Icon name="hourglass" size={11} />
            {t('horizon.daysShort', { v: left > 0 ? left : 0 })}
          </span>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <CostPreview preview={preview} />
        <Button tone="commit" size="sm" onClick={onHire}>
          {t('team.hire')}
        </Button>
      </span>
    </li>
  )
}

function TeamList() {
  const employees = useGameStore(useShallow((s) => s.state.employees))
  const idle = useGameStore(useShallow((s) => idleBuilders(s.state)))
  const select = useGameStore((s) => s.select)
  // Leaving first (they need an answer), then builders with nothing to build, then by department.
  const sorted = employees
    .slice()
    .sort((a, b) => Number(b.status === 'leaving') - Number(a.status === 'leaving') || Number(idle.includes(b.id)) - Number(idle.includes(a.id)) || a.dept.localeCompare(b.dept))
  if (sorted.length === 0) return <Empty text={t('team.empty')} icon="users" />
  return (
    <ul className="flex flex-col gap-1">
      {sorted.map((e) => (
        <li key={e.id}>
          {e.status === 'leaving' ? (
            <ResignationCard employee={e} />
          ) : (
            <button
              type="button"
              onClick={() => select({ kind: 'employee', id: e.id })}
              className="flex min-h-9 w-full items-center gap-2 rounded-control bg-surface-2/60 px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
            >
              <EmployeeRow employee={e} idle={idle.includes(e.id)} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function EmployeeRow({ employee: e, idle = false }: { employee: Employee; idle?: boolean }) {
  return (
    <>
      <Avatar name={e.name} dept={e.dept} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Dot color={DEPT_COLOR[e.dept].dot} size={6} />
          <span className="truncate text-[13px] font-semibold">{e.name}</span>
          {e.star && <Icon name="star" size={12} fill="currentColor" className="shrink-0 text-g-equity" />}
          {e.status !== 'working' && <Pill className={STATUS_TONE[e.status]} dot={STATUS_DOT[e.status]}>{t(`status.${e.status}`)}</Pill>}
          {idle && e.status === 'working' && <Pill tint="var(--color-energy)" dot="var(--color-energy)">{t('team.idle')}</Pill>}
          {!e.deskSlotId && <Icon name="desk" size={12} className="shrink-0 text-negative" aria-label={t('team.noSeat')} />}
        </div>
        <Bar value={e.morale / 100} tone={moraleTone(e.morale)} height={4} className="mt-1 max-w-28" />
      </div>
      <span className="tabular shrink-0 text-[15px] font-semibold text-ink">{money(e.salary)}</span>
    </>
  )
}

/** Resignation warning with the three responses (raise / talk / let go). */
export function ResignationCard({ employee: e }: { employee: Employee }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const day = useGameStore((s) => s.state.time.day)
  const days = e.leaveDay !== undefined ? Math.ceil(e.leaveDay - day) : null
  const left = days !== null && days < 0 ? 0 : days
  const respond = (response: 'raise' | 'talk' | 'letGo') => dispatch({ type: 'respondResignation', employeeId: e.id, response })
  return (
    <div className="rounded-control border border-border bg-surface p-2.5">
      <div className="flex items-center gap-3">
        <Avatar name={e.name} dept={e.dept} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon name="warning" size={14} className="shrink-0 text-negative" />
            <span className="truncate text-sm font-semibold">{e.name}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-ink">
            <Dot color="var(--color-negative)" size={6} />
            {left !== null ? t('team.leavingIn', { n: left }) : t('status.leaving')}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Button size="sm" tone="primary" onClick={() => respond('raise')}>
          {t('team.raise')}
        </Button>
        <Button size="sm" onClick={() => respond('talk')}>
          {t('team.talk')}
        </Button>
        <Button size="sm" tone="ghost" onClick={() => respond('letGo')}>
          {t('team.letGo')}
        </Button>
      </div>
    </div>
  )
}
