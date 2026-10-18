// Detail content for a scene selection (slot, employee, project, visitor, founder), shown in the single
// right panel (RightPanel). Header + close-up preview + metrics + actions.
import { useEffect, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PROJECT_NAME_MAX, TEAM_ADJ_BONUS } from '../engine/balance'
import { teamClusteredEmployees } from '../engine/office'
import { effortOn, isBuilder } from '../engine/effort'
import { nameKey } from '../engine/names'
import { FOUNDER_SLOT_ID, type Employee, type Project, type Slot } from '../engine/types'
import { DEPT_TEXT, FURNITURE, PROJECT_CATEGORY_TEXT } from '../content'
import { founderSub, npcTitle } from '../content/stageBand'
import { useGameStore } from '../store/gameStore'
import type { Selection } from '../store/types'
import { Icon, type IconName } from './icons'
import { castName } from './bubbles/speaker'
import { t } from './i18n'
import { fixed, money, pct } from './format'
import { Bar, Button, CostPreview, cx, Dot, Pill, QualityStars, SectionTitle, Stat } from './primitives'
import { useSpendPreview } from './widgets'
import { upgradeCost } from '../engine/loopSelectors'
import { iconTone, moraleTone, soft } from './theme'
import { useIsMobile, useTwoStep } from './hooks'
import { effectTags } from './panels/ShopPanel'
import { AdFocusToggle } from './panels/AdFocus'
import { AssignList, CATEGORY_COLOR, CATEGORY_ICON, MaturityBar, ProductUsers, VersionBadge } from './panels/ProjectsPanel'
import { ModulesSection } from './panels/ModulesSection'
import { ChipRow } from './EffectChips'
import { fatigueGood, fitChips, hiddenLossChip, LeadLine, loadChip, personLabel, PersonEffortRows, SprintRow, TeamOf } from './effort'
import { Avatar, DeptPill, ResignationCard } from './panels/TeamPanel'
import { ChipMark } from './ChipMark'

export type RenderPreview = (target: Selection) => ReactNode

/** Close-up of the selection (render's ObjectPreview when available). */
export function DetailPreview({ selection, renderPreview }: { selection: Selection; renderPreview?: RenderPreview }) {
  const category = useGameStore((s) => (selection.kind === 'project' ? s.state.projects.find((p) => p.id === selection.id)?.category : undefined))
  // A product is its category's icon, as on its card: the turntable model read as a black bar on a beige disc in the
  // 64px phone thumbnail (a phone turning edge-on, N8).
  if (category) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-control" style={{ background: soft(CATEGORY_COLOR[category], 14) }}>
        <Icon name={CATEGORY_ICON[category]} size={32} style={{ color: iconTone(CATEGORY_COLOR[category]) }} />
      </div>
    )
  }
  return (
    <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-control border border-border bg-surface-2">
      {renderPreview ? <div className="absolute inset-0">{renderPreview(selection)}</div> : <Icon name={previewIcon(selection)} size={40} className="text-ink-3" />}
    </div>
  )
}

function previewIcon(sel: Selection): IconName {
  switch (sel.kind) {
    case 'slot':
      return 'desk'
    case 'employee':
      return 'users'
    case 'project':
      return 'rocket'
    case 'visitor':
      return 'door'
    case 'founder':
      return 'unicorn'
  }
}

// ---------------------------------------------------------------------------
// Header (title + subtitle per kind)
// ---------------------------------------------------------------------------

export function DetailHeader({ selection }: { selection: Selection }) {
  const info = useGameStore(
    useShallow((s): { title: string; sub: string; pill?: string; pillTone?: string; pillDot?: string } => {
      const st = s.state
      switch (selection.kind) {
        case 'slot': {
          const slot = resolveSlot(st.office.slots, selection.id)
          const item = slot?.itemId ? FURNITURE.find((f) => f.id === slot.itemId) : undefined
          return {
            title: slot?.id === FOUNDER_SLOT_ID ? t('detail.founderDesk') : (item?.name ?? t('detail.emptySlot')),
            sub: slot ? t('detail.slotSub', { type: t(`slot.${slot.type}`), ring: slot.ring }) : '',
          }
        }
        case 'employee': {
          const e = st.employees.find((x) => x.id === selection.id)
          const label = e ? personLabel(st, e) : undefined
          return { title: e?.name ?? '—', sub: e ? DEPT_TEXT[e.dept].name : '', pill: label?.text, pillTone: label?.tone, pillDot: label?.dot }
        }
        case 'project': {
          const p = st.projects.find((x) => x.id === selection.id)
          return { title: p?.name ?? '—', sub: p ? PROJECT_CATEGORY_TEXT[p.category].name : '', pill: p ? (p.launched ? t('projects.live') : t('projects.building')) : undefined, pillTone: p?.launched ? 'text-ink' : 'text-ink-2', pillDot: p?.launched ? 'var(--color-positive)' : 'var(--color-ink-3)' }
        }
        case 'visitor': {
          const v = st.visitors.find((x) => x.id === selection.id)
          return { title: v ? castName(st, v.role) : '—', sub: v ? npcTitle(v.role, st.stage) : '' }
        }
        case 'founder':
          return { title: t('founder.you'), sub: founderSub(st.stage) }
      }
    }),
  )
  return (
    <div className="min-w-0">
      {selection.kind === 'project' && info.title !== '—' ? (
        <ProjectTitle id={selection.id} title={info.title} />
      ) : (
        <h2 className="truncate text-lg font-semibold leading-tight tracking-wide text-ink">{info.title}</h2>
      )}
      <p className="truncate text-xs text-ink-2">{info.sub}</p>
      {info.pill && <Pill className={cx('mt-1', info.pillTone)} dot={info.pillDot}>{info.pill}</Pill>}
    </div>
  )
}

/** Project name with a pencil: a tap swaps it for an input in place (Enter/blur saves, Esc cancels). */
function ProjectTitle({ id, title }: { id: string; title: string }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const names = useGameStore(useShallow((s) => s.state.projects.filter((x) => x.id !== id).map((x) => x.name)))
  const [draft, setDraft] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const done = () => {
    setDraft(null)
    setErr(null)
  }
  const save = () => {
    if (draft === null) return
    const clean = draft.replace(/\s+/g, ' ').trim()
    if (clean === title) return done()
    if (names.some((n) => nameKey(n) === nameKey(clean))) return setErr(t('project.nameTaken'))
    const res = dispatch({ type: 'renameProject', projectId: id, name: clean })
    if (res.ok) done()
    else setErr(t('project.nameBad'))
  }
  if (draft === null)
    return (
      <button
        type="button"
        aria-label={t('project.rename')}
        onClick={() => setDraft(title)}
        className="-ml-1 flex min-h-11 max-w-full items-center gap-1.5 rounded-control px-1 text-left hover:bg-surface-2"
      >
        <span className="truncate text-lg font-semibold leading-tight tracking-wide text-ink">{title}</span>
        <Icon name="pencil" size={16} className="shrink-0 text-ink-3" />
      </button>
    )
  return (
    <div>
      <input
        autoFocus
        value={draft}
        maxLength={PROJECT_NAME_MAX}
        aria-label={t('project.rename')}
        aria-invalid={err !== null}
        onChange={(e) => {
          setDraft(e.target.value)
          setErr(null)
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={save}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault()
            e.stopPropagation()
            e.currentTarget.select()
          } else if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') done()
        }}
        style={{ fontSize: 16 }}
        className={cx('min-h-11 w-full rounded-control border bg-surface px-2 font-semibold text-ink outline-none focus:border-brand', err ? 'border-negative' : 'border-border')}
      />
      {err && <p className="text-xs text-negative-ink">{err}</p>}
    </div>
  )
}

export function resolveSlot(slots: Slot[], id: string): Slot | undefined {
  const s = slots.find((x) => x.id === id)
  if (s?.spanOf) return slots.find((x) => x.id === s.spanOf) ?? s
  return s
}

export function DetailBody({ selection }: { selection: Selection }) {
  switch (selection.kind) {
    case 'slot':
      return <SlotDetail id={selection.id} />
    case 'employee':
      return <EmployeeDetail id={selection.id} />
    case 'project':
      return <ProjectDetail id={selection.id} />
    case 'visitor':
      return <VisitorDetail id={selection.id} />
    case 'founder':
      return <FounderDetail />
  }
}

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

/** A slot spend's money line: the same CostPreview (red when the next payday comes up short) Shop and Market show. */
function PaydayPreview({ cash, burn, className }: { cash: number; burn: number; className?: string }) {
  const preview = useSpendPreview(cash, burn)
  return <CostPreview preview={preview} className={cx('self-start justify-self-start', className)} />
}

function SlotDetail({ id }: { id: string }) {
  const { slots, rings, employees, cash } = useGameStore(
    useShallow((s) => ({ slots: s.state.office.slots, rings: s.state.office.rings, employees: s.state.employees, cash: s.state.stats.cash })),
  )
  const dispatch = useGameStore((s) => s.dispatch)
  const setPlacing = useGameStore((s) => s.setPlacing)
  const select = useGameStore((s) => s.select)
  const closePanel = useGameStore((s) => s.closePanel)
  const mobile = useIsMobile()
  const slot = resolveSlot(slots, id)
  if (!slot) return <p className="text-xs text-ink-2">{t('detail.gone')}</p>

  const ring = rings.find((r) => r.index === slot.ring)
  const locked = slot.ring > 0 && ring !== undefined && !ring.unlocked
  const item = slot.itemId ? FURNITURE.find((f) => f.id === slot.itemId) : undefined
  const upgrade = item?.upgradesTo ? FURNITURE.find((f) => f.id === item.upgradesTo) : undefined
  const occupant = slot.occupantId ? employees.find((e) => e.id === slot.occupantId) : undefined
  const isFounder = slot.id === FOUNDER_SLOT_ID
  const unseated = employees.filter((e) => !e.deskSlotId)

  if (locked && ring) {
    // Rings open strictly inside-out (engine: ringOrder).
    const nextLocked = rings.filter((r) => !r.unlocked).reduce((m, r) => Math.min(m, r.index), Infinity)
    const inOrder = nextLocked === ring.index
    return (
      <div className="flex flex-col gap-3">
        <p className="font-text flex items-center gap-2 text-sm text-ink-2">
          <Icon name="lock" size={16} />
          {inOrder ? t('detail.ringLocked', { n: ring.index }) : t('detail.ringFirst', { n: nextLocked })}
        </p>
        <Button tone="primary" icon="plus" disabled={!inOrder || cash < ring.openCost} onClick={() => dispatch({ type: 'openRing', ring: ring.index })}>
          {`${t('shop.ringCost', { cost: money(ring.openCost) })} · ${t('shop.ringRent', { v: money(ring.rentPerMonth) })}`}
        </Button>
        {inOrder && <PaydayPreview cash={-ring.openCost} burn={ring.rentPerMonth} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {item && (
        <section>
          <p className="font-text text-xs leading-relaxed text-ink-2">{item.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {effectTags(item.effects).map((tag) => (
              <Pill key={tag} className="text-ink">
                {tag}
              </Pill>
            ))}
          </div>
        </section>
      )}

      {slot.type === 'desk' && (
        <section>
          <SectionTitle>{t('detail.occupant')}</SectionTitle>
          {isFounder ? (
            <p className="text-xs text-ink-2">{t('detail.founderSeat')}</p>
          ) : occupant ? (
            <button type="button" onClick={() => select({ kind: 'employee', id: occupant.id })} className="flex w-full items-center gap-3 rounded-control border border-border p-2.5 text-left hover:bg-surface-2">
              <Avatar name={occupant.name} dept={occupant.dept} size={56} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{occupant.name}</span>
              <DeptPill dept={occupant.dept} />
            </button>
          ) : item && unseated.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border">
              {unseated.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => dispatch({ type: 'assignDesk', employeeId: e.id, slotId: slot.id })} className="flex min-h-11 w-full items-center gap-2 rounded-control px-2 text-left hover:bg-surface-2">
                    <Avatar name={e.name} dept={e.dept} size={28} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{e.name}</span>
                    <span className="text-[11px] font-semibold text-ink underline decoration-border-strong underline-offset-2">{t('detail.seatHere')}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-2">{item ? t('detail.freeDesk') : t('detail.needDesk')}</p>
          )}
        </section>
      )}

      {item && !isFounder && (
        <section className="grid grid-cols-2 gap-2">
          {upgrade && item && (
            <>
              <Button className="col-span-2" tone="primary" icon="arrowUp" disabled={cash < upgradeCost(item, upgrade)} onClick={() => dispatch({ type: 'upgradeItem', slotId: slot.id, toItemId: upgrade.id })}>
                {t('detail.upgrade', { item: upgrade.name, v: money(upgradeCost(item, upgrade)) })}
              </Button>
              <PaydayPreview cash={-upgradeCost(item, upgrade)} burn={(upgrade.upkeep ?? 0) - (item.upkeep ?? 0)} className="col-span-2" />
            </>
          )}
          <Button
            icon="move"
            onClick={() => {
              setPlacing({ kind: 'move', fromSlotId: slot.id })
              // Phones: close the sheet so the office and the placing banner are visible.
              if (mobile) closePanel()
            }}
          >
            {t('detail.move')}
          </Button>
          <ConfirmButton icon="tag" label={t('detail.sell')} confirmLabel={t('detail.sellConfirm')} onConfirm={() => dispatch({ type: 'sellItem', slotId: slot.id })} />
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Employee
// ---------------------------------------------------------------------------

function EmployeeDetail({ id }: { id: string }) {
  const e = useGameStore((s) => s.state.employees.find((x) => x.id === id))
  const showQuality = useGameStore((s) => s.state.unlockedWidgets.includes('candidateQuality'))
  const projects = useGameStore(useShallow((s) => s.state.projects))
  const dispatch = useGameStore((s) => s.dispatch)
  const setPlacing = useGameStore((s) => s.setPlacing)
  const closePanel = useGameStore((s) => s.closePanel)
  const mobile = useIsMobile()
  // E3: the person's battery, load and fit (derived.people; absent in the Garage).
  const effort = useGameStore((s) => (e ? s.state.derived.people?.[e.id] : undefined))
  // Grid §5: sits in a team island (3+ same-team desks side by side) → "+%4 hız" under the desk.
  const island = useGameStore((s) => teamClusteredEmployees(s.state).has(id))
  // Taking someone off their project is two taps, like the sale of furniture.
  const [armed, tap] = useTwoStep()
  if (!e) return <p className="text-xs text-ink-2">{t('detail.gone')}</p>
  const fatigue = Math.round(e.fatigue ?? 0)
  const fatigueColor = fatigueGood(fatigue) === false ? 'var(--color-negative)' : fatigueGood(fatigue) === true ? 'var(--color-positive)' : 'var(--color-energy)'
  const current = projects.find((p) => p.id === e.projectId)
  return (
    <div className="flex flex-col gap-4">
      {e.status === 'leaving' && <ResignationCard employee={e} />}
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('hud.morale')} value={Math.round(e.morale)} sub={<Bar value={e.morale / 100} tone={moraleTone(e.morale)} height={4} className="mt-1" />} />
        <Stat label={t('detail.salary')} value={t('hud.perMonthPlain', { v: money(e.salary) })} />
        {effort && e.dept !== 'sales' && <Stat label={t('fx.tag.fatigue')} value={fatigue} sub={<Bar value={fatigue / 100} color={fatigueColor} height={4} className="mt-1" />} />}
        {showQuality && <Stat label={t('detail.quality')} value={<QualityStars quality={e.quality} />} />}
        <Stat
          label={t('detail.desk')}
          value={e.deskSlotId ? t('detail.seated') : <span className="inline-flex items-center gap-1.5"><Dot color="var(--color-negative)" size={6} />{t('team.noSeat')}</span>}
          sub={island ? <ChipRow className="mt-1" chips={[{ icon: 'users', label: '', text: t('team.islandChip', { v: Math.round(TEAM_ADJ_BONUS * 100) }), good: true, title: t('team.islandTitle') }]} /> : undefined}
        />
      </div>
      {effort && (
        <ChipRow chips={[loadChip(effort.load), ...hiddenLossChip(effort.fatigueFactor), ...(effort.fit && current ? fitChips(CATEGORY_ICON[current.category]) : [])]} />
      )}
      {(isBuilder(e) || current) && (
        <section>
          <SectionTitle>{t('detail.project')}</SectionTitle>
          {projects.length === 0 ? (
            <p className="text-xs text-ink-2">{t('projects.empty')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {/* Marketing / sales / ops add nothing to a project (effort.isBuilder): only the one they are on, to take them off. */}
              {projects.filter((p) => isBuilder(e) || p.id === e.projectId).map((p) => {
                const on = e.projectId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => (on ? tap(p.id, () => dispatch({ type: 'assign', employeeId: e.id, projectId: null })) : dispatch({ type: 'assign', employeeId: e.id, projectId: p.id }))}
                    className={cx(
                      'inline-flex min-h-9 items-center gap-1 rounded-control border px-3 text-xs font-semibold pointer-coarse:min-h-11',
                      on && armed === p.id ? 'border-negative bg-surface text-negative-ink' : on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-border text-ink-2 hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Icon name={on && armed === p.id ? 'warning' : CATEGORY_ICON[p.category]} size={13} />
                    {on && armed === p.id ? t('team.removeConfirm') : p.name}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}
      {effort && (
        <section className="flex flex-col gap-1.5">
          <PersonEffortRows e={e} />
        </section>
      )}
      <section className="grid grid-cols-2 gap-2">
        <Button
          icon="move"
          onClick={() => {
            setPlacing({ kind: 'seat', employeeId: e.id })
            if (mobile) closePanel()
          }}
        >
          {e.deskSlotId ? t('detail.changeDesk') : t('detail.pickDesk')}
        </Button>
        <ChipMark k={`fire:${e.id}`}>
          <ConfirmButton
            icon="door"
            label={t('detail.fire')}
            confirmLabel={t('detail.fireConfirm', { name: e.name.split(' ')[0] ?? e.name })}
            onConfirm={() => {
              const r = dispatch({ type: 'fire', employeeId: e.id })
              if (r.ok) closePanel()
            }}
          />
        </ChipMark>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

function ProjectDetail({ id }: { id: string }) {
  const p = useGameStore((s) => s.state.projects.find((x) => x.id === id))
  const employees = useGameStore(useShallow((s) => s.state.employees))
  const dispatch = useGameStore((s) => s.dispatch)
  const effort = useGameStore((s) => effortOn(s.state))
  if (!p) return <p className="text-xs text-ink-2">{t('detail.gone')}</p>
  const team = employees.filter((e) => p.assignedIds.includes(e.id))
  // Modules open on a live product at 1.0 (engine moduleError).
  const finished = p.launched && p.maturity >= 1
  return (
    <div className="flex flex-col gap-4">
      {finished ? (
        // 1.0: nothing left to fill, so the bar shrinks to a thin "Yayında" strip and the modules take the room.
        <section className="flex items-center gap-2">
          <Dot color="var(--color-positive)" size={7} />
          <span className="text-xs font-semibold text-ink-2">{t('detail.live')}</span>
          <VersionBadge project={p as Project} />
          <Bar value={1} color={CATEGORY_COLOR[p.category]} height={3} className="flex-1" />
          <ProductUsers projectId={p.id} className="shrink-0" />
        </section>
      ) : (
        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <SectionTitle>{t('detail.maturity')}</SectionTitle>
            <span className="tabular text-sm font-semibold">{pct(p.maturity)}</span>
          </div>
          <MaturityBar value={p.maturity} color={CATEGORY_COLOR[p.category]} />
          <p className="font-text mt-2 text-[11px] text-ink-2">{p.launched ? t('detail.launched') : t('detail.mvpHint', { v: pct(0.2) })}</p>
          {p.launched && <ProductUsers projectId={p.id} />}
        </section>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('detail.team')} value={team.length} sub={teamSummary(team)} />
        {effort && (
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <TeamOf project={p as Project} />
            <LeadLine project={p as Project} />
          </div>
        )}
        <Stat label={t('detail.scope')} value={fixed(p.size, 1)} />
      </div>
      <SprintRow project={p as Project} />
      {finished && <ModulesSection project={p as Project} />}
      {p.launched && <AdFocusToggle projectId={p.id} />}
      <Button icon="chat" onClick={() => dispatch({ type: 'setFounderFocus', focus: 'talk', targetId: p.id })}>
        {t('founder.talkToUsers')}
      </Button>
      <section>
        <SectionTitle>{t('projects.assign')}</SectionTitle>
        <AssignList project={p as Project} />
      </section>
    </div>
  )
}

function teamSummary(team: Employee[]): string {
  const counts = new Map<string, number>()
  for (const e of team) counts.set(DEPT_TEXT[e.dept].short, (counts.get(DEPT_TEXT[e.dept].short) ?? 0) + 1)
  return [...counts].map(([k, v]) => `${v} ${k}`).join(' · ')
}

// ---------------------------------------------------------------------------
// Visitor & founder
// ---------------------------------------------------------------------------

function VisitorDetail({ id }: { id: string }) {
  const v = useGameStore((s) => s.state.visitors.find((x) => x.id === id))
  if (!v) return <p className="text-xs text-ink-2">{t('detail.gone')}</p>
  return <p className="font-text text-sm leading-relaxed text-ink">{t(`visitor.${v.purpose}`)}</p>
}

function FounderDetail() {
  const f = useGameStore(useShallow((s) => ({ energy: s.state.founder.energy, current: s.state.founder.currentAction, equity: s.state.stats.equity, xp: s.state.meta.founderXp })))
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label={t('founder.energy')} value={Math.round(f.energy)} sub={<Bar value={f.energy / 100} color="var(--color-energy)" height={4} className="mt-1" />} />
      <Stat label={t('hud.equity')} value={pct(f.equity, 1)} />
      <Stat label={t('detail.doing')} value={f.current ? t(`founder.${f.current.kind}`) : t('detail.idle')} />
      <Stat label={t('detail.xp')} value={fixed(f.xp, 1)} />
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Two-step destructive button (the viewer has no confirm dialogs). */
export function ConfirmButton({ icon, label, confirmLabel, onConfirm }: { icon: IconName; label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(id)
  }, [armed])
  return (
    <Button
      tone={armed ? 'danger' : 'secondary'}
      icon={armed ? 'warning' : icon}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  )
}
