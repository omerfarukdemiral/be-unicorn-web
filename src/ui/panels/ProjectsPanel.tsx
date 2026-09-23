// Projeler: 6 categories to start, active projects with maturity (MVP ≥ 0.2) and assignments.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PROJECT_CATEGORIES, type Project, type ProjectCategory } from '../../engine/types'
import { PROJECT_CATEGORY_TEXT, PROJECT_NAMES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { pct } from '../format'
import { Bar, Button, cx, Empty, IconBadge, Pill, SectionTitle } from '../primitives'
import { Avatar, DeptPill } from './TeamPanel'

/** Turkish project name from content, unique within the run. */
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

export const MVP_MATURITY = 0.2

export const CATEGORY_ICON: Record<ProjectCategory, IconName> = {
  mobile: 'phone',
  web: 'globe',
  ai: 'sparkle',
  api: 'branch',
  game: 'star',
  marketplace: 'bag',
}

/** Category hue: icon tile on the "new project" cards and in the project list. */
export const CATEGORY_COLOR: Record<ProjectCategory, string> = {
  mobile: 'var(--color-g-users)',
  web: 'var(--color-g-sky)',
  ai: 'var(--color-kind-concept)',
  api: 'var(--color-g-indigo)',
  game: 'var(--color-g-runway)',
  marketplace: 'var(--color-g-morale)',
}

export function ProjectsPanel() {
  const projects = useGameStore(useShallow((s) => s.state.projects))
  const dispatch = useGameStore((s) => s.dispatch)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionTitle>{t('projects.active')}</SectionTitle>
        {projects.length === 0 ? (
          <Empty text={t('projects.empty')} icon="rocket" />
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <SectionTitle>{t('projects.new')}</SectionTitle>
        <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
          {PROJECT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => dispatch({ type: 'startProject', category: c, name: nextProjectName() })}
              className="flex min-h-16 flex-col items-start gap-1 rounded-control border border-border p-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <IconBadge icon={CATEGORY_ICON[c]} size={24} color={CATEGORY_COLOR[c]} />
                {PROJECT_CATEGORY_TEXT[c].name}
              </span>
              <span className="font-text text-[11px] leading-snug text-ink-2">{PROJECT_CATEGORY_TEXT[c].description}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-brand-ink">
                <Icon name="plus" size={12} />
                {t('projects.start')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Maturity progress in the project's category hue (brand when no category is known). */
export function MaturityBar({ value, color = 'var(--color-brand)' }: { value: number; color?: string }) {
  return (
    <div className="relative">
      <Bar value={value} marker={MVP_MATURITY} color={color} height={6} />
      <span className="absolute -top-4 text-[10.5px] font-semibold tracking-wider text-ink-2" style={{ left: `calc(${MVP_MATURITY * 100}% - 12px)` }}>
        MVP
      </span>
    </div>
  )
}

function ProjectCard({ project: p }: { project: Project }) {
  const [open, setOpen] = useState(false)
  const select = useGameStore((s) => s.select)
  return (
    <li className="px-1 py-3">
      <div className="flex items-center gap-2">
        <IconBadge icon={CATEGORY_ICON[p.category]} size={28} color={CATEGORY_COLOR[p.category]} />
        <button type="button" className="min-h-9 min-w-0 flex-1 truncate py-1 text-left text-sm font-semibold hover:underline max-md:min-h-11" onClick={() => select({ kind: 'project', id: p.id })}>
          {p.name}
        </button>
        {p.launched ? <Pill tint="var(--color-positive)" dot="var(--color-positive)">{t('projects.live')}</Pill> : <Pill dot="var(--color-ink-3)">{t('projects.building')}</Pill>}
        <span className="tabular text-xs font-semibold">{pct(p.maturity)}</span>
      </div>
      <div className="mt-4">
        <MaturityBar value={p.maturity} color={CATEGORY_COLOR[p.category]} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="tabular text-[11px] text-ink-2">{t('projects.assigned', { n: p.assignedIds.length })}</span>
        <Button size="sm" tone="ghost" icon={open ? 'chevronUp' : 'users'} onClick={() => setOpen((o) => !o)}>
          {t('projects.assign')}
        </Button>
      </div>
      {open && <AssignList project={p} />}
    </li>
  )
}

export function AssignList({ project }: { project: Project }) {
  const employees = useGameStore(useShallow((s) => s.state.employees))
  const projects = useGameStore(useShallow((s) => s.state.projects))
  const dispatch = useGameStore((s) => s.dispatch)
  if (employees.length === 0) return <p className="font-text mt-2 text-[11px] text-ink-2">{t('team.empty')}</p>
  const sorted = employees.slice().sort((a, b) => rank(a.dept) - rank(b.dept))
  return (
    <ul className="mt-2 flex flex-col gap-0.5">
      {sorted.map((e) => {
        const here = e.projectId === project.id
        const elsewhere = e.projectId && !here ? projects.find((x) => x.id === e.projectId)?.name : undefined
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => dispatch({ type: 'assign', employeeId: e.id, projectId: here ? null : project.id })}
              aria-pressed={here}
              className={cx('flex min-h-11 w-full items-center gap-2 rounded-control px-2 text-left transition-colors', here ? 'bg-brand-soft' : 'hover:bg-surface-2')}
            >
              <Avatar name={e.name} dept={e.dept} size={28} />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{e.name}</span>
              <DeptPill dept={e.dept} />
              {elsewhere && <span className="max-w-24 truncate text-[10.5px] text-ink-2">{elsewhere}</span>}
              <span className={cx('grid size-5 shrink-0 place-items-center rounded-md border', here ? 'border-brand bg-brand text-on-ink' : 'border-border-strong text-transparent')}>
                <Icon name="check" size={12} />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function rank(d: string): number {
  return d === 'eng' ? 0 : d === 'product' ? 1 : 2
}
