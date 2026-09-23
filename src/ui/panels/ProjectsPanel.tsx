// Projeler: 6 categories to start, active projects with maturity (MVP ≥ 0.2) and assignments.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PROJECT_CATEGORIES, type Project, type ProjectCategory } from '../../engine/types'
import { PROJECT_CATEGORY_TEXT, PROJECT_NAMES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { pct } from '../format'
import { Bar, Button, cx, Empty, Pill, SectionTitle } from '../primitives'
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
          <ul className="flex flex-col gap-2">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <SectionTitle>{t('projects.new')}</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROJECT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => dispatch({ type: 'startProject', category: c, name: nextProjectName() })}
              className="flex min-h-16 flex-col items-start gap-1 rounded-2xl border border-cream-200 bg-cream-100/70 p-2.5 text-left transition-colors hover:border-lilac-300 hover:bg-lilac-100/60"
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <Icon name={CATEGORY_ICON[c]} size={16} className="text-lilac-500" />
                {PROJECT_CATEGORY_TEXT[c].name}
              </span>
              <span className="text-[11px] leading-snug text-ink-600">{PROJECT_CATEGORY_TEXT[c].description}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-lilac-500">
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

export function MaturityBar({ value }: { value: number }) {
  return (
    <div className="relative">
      <Bar value={value} marker={MVP_MATURITY} tone={value >= MVP_MATURITY ? 'bg-mint-300' : 'bg-lilac-300'} height={10} />
      <span className="absolute -top-4 text-[9px] font-bold text-ink-600" style={{ left: `calc(${MVP_MATURITY * 100}% - 12px)` }}>
        MVP
      </span>
    </div>
  )
}

function ProjectCard({ project: p }: { project: Project }) {
  const [open, setOpen] = useState(false)
  const select = useGameStore((s) => s.select)
  return (
    <li className="rounded-2xl bg-cream-100/80 p-3">
      <div className="flex items-center gap-2">
        <Icon name={CATEGORY_ICON[p.category]} size={18} className="text-lilac-500" />
        <button type="button" className="min-h-9 min-w-0 flex-1 truncate py-1 text-left text-sm font-bold hover:underline max-md:min-h-11" onClick={() => select({ kind: 'project', id: p.id })}>
          {p.name}
        </button>
        {p.launched ? <Pill className="bg-mint-100 text-mint-600">{t('projects.live')}</Pill> : <Pill className="bg-cream-200 text-ink-600">{t('projects.building')}</Pill>}
        <span className="tabular text-xs font-bold">{pct(p.maturity)}</span>
      </div>
      <div className="mt-4">
        <MaturityBar value={p.maturity} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-600">{t('projects.assigned', { n: p.assignedIds.length })}</span>
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
  if (employees.length === 0) return <p className="mt-2 text-[11px] text-ink-600">{t('team.empty')}</p>
  const sorted = employees.slice().sort((a, b) => rank(a.dept) - rank(b.dept))
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {sorted.map((e) => {
        const here = e.projectId === project.id
        const elsewhere = e.projectId && !here ? projects.find((x) => x.id === e.projectId)?.name : undefined
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => dispatch({ type: 'assign', employeeId: e.id, projectId: here ? null : project.id })}
              aria-pressed={here}
              className={cx('flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left', here ? 'bg-mint-100' : 'hover:bg-cream-50')}
            >
              <Avatar name={e.name} dept={e.dept} size={28} />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{e.name}</span>
              <DeptPill dept={e.dept} />
              {elsewhere && <span className="max-w-24 truncate text-[10px] text-ink-600">{elsewhere}</span>}
              <span className={cx('grid size-6 place-items-center rounded-full', here ? 'bg-mint-600 text-cream-50' : 'bg-cream-200 text-transparent')}>
                <Icon name="check" size={14} />
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
