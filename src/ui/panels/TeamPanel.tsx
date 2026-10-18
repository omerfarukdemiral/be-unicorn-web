// Ekip: candidate pool (hire by dept) + team list (status, morale, resignation responses). HUD grammar (GAMEPLAY V2
// §10.5): 36px person cards with a 4px gap (no hairline list), salary as the number, every hire carries the runway it leaves (HireRunway).
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { idleBuilders } from '../../engine/loopSelectors'
import { hireDeskCost } from '../../engine/office'
import { DEPTS, type Candidate, type Dept, type Employee, type SpendPreview } from '../../engine/types'
import { CONTENT, DEPT_TEXT } from '../../content'
import { useGameStore } from '../../store/gameStore'
import * as B from '../../engine/balance'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money } from '../format'
import { candidateFit, fatigueGood, fitChips, personLabel } from '../effort'
import { ChipRow } from '../EffectChips'
import { CATEGORY_ICON } from './ProjectsPanel'
import { Bar, Button, Chip, cx, Dot, Empty, Pill, QualityStars } from '../primitives'
import { useSpendPreview } from '../widgets'
import { useTwoStep } from '../hooks'
import { DEPT_COLOR, moraleTone, soft } from '../theme'

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

/**
 * The department's portrait (T13: public/portraits/team-<dept>, rendered from the scene's character model, T16) on a
 * light tint of the department hue with a thin ring in the same hue. One face per department (the scene varies people,
 * the set does not); the name next to it tells them apart, and is the image's alt.
 */
export function Avatar({ name, dept, size = 36 }: { name: string; dept: Dept; size?: number }) {
  const src = `/portraits/team-${dept}`
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-full border"
      style={{ width: size, height: size, background: soft(DEPT_COLOR[dept].dot, 18), borderColor: soft(DEPT_COLOR[dept].dot, 45) }}
    >
      <img src={`${src}@1x.png`} srcSet={`${src}@1x.png 1x, ${src}@2x.png 2x`} alt={name} width={size} height={size} draggable={false} className="size-full object-cover" />
    </span>
  )
}

function HireView() {
  const [dept, setDept] = useState<Dept | 'all'>('all')
  const { candidates, day, showQuality, freeDesks, emptySlots, deskCost } = useGameStore(
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
        // F6: 0 = a desk stands free, a price = the hire buys the desk too, null = no desk slot left (open a ring).
        deskCost: hireDeskCost(s.state, CONTENT),
      }
    }),
  )
  const dispatch = useGameStore((s) => s.dispatch)
  const list = candidates.filter((c) => dept === 'all' || c.dept === dept)
  // A hire is a monthly salary (plus a desk when none is free): the first tap arms, the second commits.
  const [armed, tap] = useTwoStep()
  const [err, setErr] = useState<{ id: string; text: string } | null>(null)
  const hire = (id: string) =>
    tap(id, () => {
      // Always autoDesk: a bare hire refused with noDesk sent the player to the shop and was never retried (F6).
      const res = dispatch({ type: 'hire', candidateId: id, autoDesk: true })
      setErr(res.ok || !res.error ? null : { id, text: t(`error.${res.error}`) })
    })

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
            <CandidateCard
              key={c.id}
              candidate={c}
              day={day}
              showQuality={showQuality}
              deskCost={deskCost}
              armed={armed === c.id}
              error={err?.id === c.id ? err.text : undefined}
              onHire={() => hire(c.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * N1: what the hire leaves, in one short phrase on the offer ("Kasa 2 ay taşır"); red under HIRE_RUNWAY_MIN months or
 * when the next payday would bounce. Numbers from the engine's previewSpend, nothing computed here.
 */
export function HireRunway({ preview }: { preview: SpendPreview }) {
  const after = preview.runwayAfter
  const danger = preview.paydayShort || (after !== null && after < B.HIRE_RUNWAY_MIN)
  const text = preview.paydayShort
    ? t('team.runwayShort')
    : after === null
      ? t('team.runwayOk')
      : after < 1
        ? t('team.runwayUnder1')
        : t('team.runwayAfter', { v: Math.floor(after) })
  return (
    <span
      data-danger={danger ? '' : undefined}
      className={cx(
        'tabular inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-px text-[11px] font-bold',
        danger ? 'bg-[color-mix(in_oklab,var(--color-negative)_10%,transparent)] text-negative-ink' : 'text-ink-2',
      )}
    >
      <Icon name="hourglass" size={12} />
      {text}
    </span>
  )
}

/** Before candidateQuality: a rough low / mid / high (bolt pips), never the exact number. */
function RoughQuality({ quality }: { quality: number }) {
  const span = B.CANDIDATE_QUALITY_MAX - B.CANDIDATE_QUALITY_MIN
  const n = quality < B.CANDIDATE_QUALITY_MIN + span / 3 ? 1 : quality < B.CANDIDATE_QUALITY_MIN + (2 * span) / 3 ? 2 : 3
  return (
    <span title={t('team.roughQuality')} aria-label={`${t('team.roughQuality')} ${n}/3`} className="inline-flex items-center gap-px text-g-equity">
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="bolt" size={11} fill={i < n ? 'currentColor' : 'none'} className={i < n ? '' : 'text-ink-3'} />
      ))}
    </span>
  )
}

/**
 * One candidate: avatar, name + dept, the salary (the number), days left, the hire commit with its runway preview.
 * No free desk: the button carries the desk price and the hire buys it (deskCost); no desk slot at all: it is disabled.
 */
export function CandidateCard({
  candidate: c,
  day,
  showQuality,
  deskCost,
  armed,
  error,
  onHire,
}: {
  candidate: Candidate
  day: number
  showQuality: boolean
  deskCost: number | null
  armed: boolean
  error?: string
  onHire: () => void
}) {
  const preview = useSpendPreview(-(deskCost ?? 0), c.salary)
  const left = Math.ceil(c.expiresDay - day)
  // E3: the one category an engineer / product hire is fluent in; a match with a project they would build is faster.
  const skill = useGameStore(useShallow((s) => candidateFit(s.state, c)))
  return (
    <li className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-surface-2/60 px-1.5 py-1">
      <Avatar name={c.name} dept={c.dept} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Dot color={DEPT_COLOR[c.dept].dot} size={6} />
          <span className="truncate text-[13px] font-semibold">{c.name}</span>
          {/* Exact stars once İşe alım çıtası is learned; before it a rough three-step read (the trade-off is visible from day one). */}
          {showQuality ? <QualityStars quality={c.quality} /> : <RoughQuality quality={c.quality} />}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <span className="tabular text-[15px] font-semibold leading-tight text-ink">{money(c.salary)}</span>
          <span className="tabular inline-flex items-center gap-0.5">
            <Icon name="hourglass" size={11} />
            {t('horizon.daysShort', { v: left > 0 ? left : 0 })}
          </span>
          {skill && !skill.fit && <Icon name={CATEGORY_ICON[skill.category]} size={13} aria-label={t('team.fit')} />}
        </div>
        {skill?.fit && <ChipRow chips={fitChips(CATEGORY_ICON[skill.category])} className="mt-0.5" />}
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <HireRunway preview={preview} />
        <Button
          tone="commit"
          size="sm"
          disabled={deskCost === null}
          title={deskCost === null ? t('team.noSlot') : undefined}
          cost={deskCost ? t('team.deskCost', { v: money(deskCost) }) : undefined}
          onClick={onHire}
        >
          {armed ? t('team.hireConfirm') : t('team.hire')}
        </Button>
      </span>
      {error && <span className="w-full font-text text-[12px] font-semibold text-negative-ink">{error}</span>}
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
              className="flex min-h-9 pointer-coarse:min-h-11 w-full items-center gap-2 rounded-control bg-surface-2/60 px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
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
  // E3: the battery beside the morale bar, and the pills of what the player set (calm pace, lead, leave).
  const fx = useGameStore(useShallow((s) => ({ on: s.state.derived.people?.[e.id] !== undefined, lead: s.state.projects.some((p) => p.leadId === e.id) })))
  const label = useGameStore(useShallow((s) => personLabel(s.state, e)))
  const fatigue = Math.round(e.fatigue ?? 0)
  const fatigueColor = fatigueGood(fatigue) === false ? 'var(--color-negative)' : fatigueGood(fatigue) === true ? 'var(--color-positive)' : 'var(--color-energy)'
  return (
    <>
      <Avatar name={e.name} dept={e.dept} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Dot color={DEPT_COLOR[e.dept].dot} size={6} />
          <span className="truncate text-[13px] font-semibold">{e.name}</span>
          {e.star && <Icon name="star" size={12} fill="currentColor" className="shrink-0 text-g-equity" />}
          {label.key !== 'working' && <Pill className={label.tone} dot={label.dot}>{label.text}</Pill>}
          {fx.lead && <Pill tint="var(--color-g-equity)"><Icon name="star" size={10} fill="currentColor" />{t('team.lead')}</Pill>}
          {fx.on && e.pace === 'calm' && <Pill tint="var(--color-positive)">{t('pace.calm')}</Pill>}
          {idle && e.status === 'working' && <Pill tint="var(--color-energy)" dot="var(--color-energy)">{t('team.idle')}</Pill>}
          {!e.deskSlotId && <Icon name="desk" size={12} className="shrink-0 text-negative" aria-label={t('team.noSeat')} />}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Bar value={e.morale / 100} tone={moraleTone(e.morale)} height={4} className="max-w-28" />
          {fx.on && e.dept !== 'sales' && <Bar value={fatigue / 100} color={fatigueColor} height={4} className="max-w-14" />}
        </div>
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
