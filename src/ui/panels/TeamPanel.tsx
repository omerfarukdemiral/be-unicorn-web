// Ekip: candidate pool (hire by dept) + team list (status, morale, resignation responses).
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DEPTS, type Dept, type Employee } from '../../engine/types'
import { DEPT_TEXT } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money } from '../format'
import { Bar, Button, Chip, cx, Dot, Empty, Pill, QualityStars } from '../primitives'
import { DEPT_COLOR, moraleTone, STATUS_DOT, STATUS_TONE } from '../theme'

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
  return <Pill dot={DEPT_COLOR[dept].dot}>{DEPT_TEXT[dept].short}</Pill>
}

// `dept` stays in the signature for callers; the avatar itself is neutral (department = the pill's dot).
export function Avatar({ name, size = 36 }: { name: string; dept: Dept; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span className="grid shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-[11px] font-semibold tracking-wide text-ink-2" style={{ width: size, height: size }}>
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
          {freeDesks === 0 ? <Dot color="var(--color-negative)" size={6} /> : <Icon name="desk" size={14} />}
          {freeDesks > 0 ? t('team.freeDesks', { n: freeDesks }) : emptySlots > 0 ? t('team.needDeskItem') : t('team.noSlot')}
        </span>
        <Button size="sm" tone="ghost" icon="refresh" onClick={() => dispatch({ type: 'refreshCandidates' })}>
          {t('team.refresh')}
        </Button>
      </div>
      {list.length === 0 ? (
        <Empty text={t('team.noCandidates')} icon="users" />
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-1 py-2.5">
              <Avatar name={c.name} dept={c.dept} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <DeptPill dept={c.dept} />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-2">
                  <span className="tabular font-semibold text-ink">{t('hud.perMonthPlain', { v: money(c.salary) })}</span>
                  {showQuality && <QualityStars quality={c.quality} />}
                  <span>{t('team.expires', { n: Math.max(0, Math.ceil(c.expiresDay - day)) })}</span>
                </div>
              </div>
              <Button tone="primary" size="sm" onClick={() => dispatch({ type: 'hire', candidateId: c.id })}>
                {t('team.hire')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TeamList() {
  const employees = useGameStore(useShallow((s) => s.state.employees))
  const select = useGameStore((s) => s.select)
  const sorted = employees.slice().sort((a, b) => Number(b.status === 'leaving') - Number(a.status === 'leaving') || a.dept.localeCompare(b.dept))
  if (sorted.length === 0) return <Empty text={t('team.empty')} icon="users" />
  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {sorted.map((e) => (
        <li key={e.id} className="py-1">
          {e.status === 'leaving' ? (
            <ResignationCard employee={e} />
          ) : (
            <button type="button" onClick={() => select({ kind: 'employee', id: e.id })} className="flex w-full items-center gap-3 rounded-control px-1 py-1.5 text-left transition-colors hover:bg-surface-2">
              <EmployeeRow employee={e} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function EmployeeRow({ employee: e }: { employee: Employee }) {
  return (
    <>
      <Avatar name={e.name} dept={e.dept} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{e.name}</span>
          {e.star && <Icon name="star" size={13} fill="currentColor" className="shrink-0 text-ink" />}
          <DeptPill dept={e.dept} />
          <Pill className={STATUS_TONE[e.status]} dot={STATUS_DOT[e.status]}>{t(`status.${e.status}`)}</Pill>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Bar value={e.morale / 100} tone={moraleTone(e.morale)} height={5} className="max-w-28" />
          <span className="tabular text-[11px] text-ink-2">{money(e.salary)}</span>
          {!e.deskSlotId && (
            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-ink-2">
              <Dot color="var(--color-negative)" size={6} />
              <span className="truncate">{t('team.noSeat')}</span>
            </span>
          )}
        </div>
      </div>
    </>
  )
}

/** Resignation warning with the three responses (raise / talk / let go). */
export function ResignationCard({ employee: e }: { employee: Employee }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const day = useGameStore((s) => s.state.time.day)
  const left = e.leaveDay !== undefined ? Math.max(0, Math.ceil(e.leaveDay - day)) : null
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
