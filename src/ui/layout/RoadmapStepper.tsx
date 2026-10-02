// Unicorn yolu, compact: 7 nodes (Garaj → Unicorn) joined by 6 links. Passed = filled, current = ringed,
// future = faint, the last node is the unicorn. The link leaving the current stage fills with stage progress.
// Tapping it opens the Yol haritası panel (again closes it, like the round chip).
// Curiosity (docs/GAMEPLAY_V2.md §9.4): the lead rival's shadow notch on the current link (ink-3, orange once it is
// ahead, one attention nudge when a rival card comes) and, past the right end, a 40% ghost of what the next stage opens.
import type { StageIndex, ToolId } from '../../engine/types'
import { STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { cx } from '../primitives'
import { FOUNDER_ICON, SLOT_ICON } from '../theme'

export const STAGE_COUNT = STAGES.length

export function openRoadmap() {
  const { ui, openPanel, closePanel } = useGameStore.getState()
  if (ui.panel?.kind === 'roadmap') closePanel()
  else openPanel({ kind: 'roadmap' }, { root: true })
}

/** Link fill 0–1 between stage i and i+1. */
export function linkFill(i: number, stage: number, progress: number): number {
  if (i < stage) return 1
  if (i > stage) return 0
  return Math.max(0, Math.min(1, progress))
}

const TOOL_ICON: Readonly<Partial<Record<ToolId, IconName>>> = {
  priceControl: 'tag',
  adBudget: 'megaphone',
  enterpriseSales: 'building',
  capTableView: 'pie',
  refactor: 'bug',
  segments: 'grid',
  mna: 'handshake',
}

/** The one big new verb a stage opens: its first founder action, else its first tool, else its new slot type (icon + name). */
export function stageVerb(stage: number): { icon: IconName; label: string } {
  const def = STAGES[stage]
  const action = def?.unlockActions?.[0]
  if (action) return { icon: FOUNDER_ICON[action], label: t(`founder.${action}`) }
  const tool = def?.unlockTools?.[0]
  if (tool) return { icon: TOOL_ICON[tool] ?? 'sparkle', label: t(`tool.${tool}`) }
  if (def?.newSlotType) return { icon: SLOT_ICON[def.newSlotType], label: t(`slot.${def.newSlotType}`) }
  return { icon: stage >= STAGES.length - 1 ? 'unicorn' : 'sparkle', label: def?.name ?? '' }
}

/** The lead rival on the current link: `at` 0–1 (valuation / the next target, the scale of derived.stageProgress). */
export interface RivalNotch {
  at: number
  ahead: boolean
  /** "Nova · değerleme $2.1M" (tooltip line). */
  title: string
  /** Changes when a rival card comes: the notch nudges once (0 = never). */
  pulse: number
}

/** What the next stage opens, drawn at 40% past the line's end; the teaser is its tooltip. */
export interface StageGhost {
  stage: StageIndex
  teaser: string
}

function Notch({ notch, tall }: { notch: RivalNotch; tall?: boolean }) {
  return (
    <span
      key={notch.pulse}
      aria-hidden="true"
      data-rival-notch=""
      className={cx('pointer-events-none absolute top-1/2 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full', tall ? 'h-3' : 'h-2.5', notch.pulse > 0 && 'animate-attention')}
      style={{ left: `${Math.max(0, Math.min(1, notch.at)) * 100}%`, background: notch.ahead ? 'var(--color-kind-decision)' : 'var(--color-ink-3)' }}
    />
  )
}

export function Ghost({ ghost, size = 14 }: { ghost: StageGhost; size?: number }) {
  const title = t('ghost.title', { v: ghost.teaser })
  return (
    <span title={title} aria-label={title} role="img" data-stage-ghost="" className="inline-flex shrink-0 items-center text-ink opacity-40">
      <Icon name={stageVerb(ghost.stage).icon} size={size} />
    </span>
  )
}

export function roadmapTitle(stage: number): string {
  return t('top.roadmapTitle', { stage: STAGES[stage]?.name ?? '', n: stage + 1 })
}

/**
 * `size`: 'bar' (desktop top bar, 16px tall nodes) or 'line' (phones: a 4px segmented line, no nodes, not a button;
 * the stage name opens the panel there).
 */
export function RoadmapStepper({
  stage,
  progress,
  size = 'bar',
  className,
  notch,
}: {
  stage: number
  progress: number
  size?: 'bar' | 'line'
  className?: string
  /** The lead rival's shadow notch on the current link. */
  notch?: RivalNotch | null
}) {
  const title = notch ? `${roadmapTitle(stage)}\n${notch.title}` : roadmapTitle(stage)
  if (size === 'line') {
    return (
      <div className={cx('flex h-1 gap-0.5', className)} title={title} aria-hidden="true">
        {Array.from({ length: STAGE_COUNT - 1 }, (_, i) => (
          <div key={i} className="relative h-full flex-1 rounded-full bg-brand/25">
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${linkFill(i, stage, progress) * 100}%` }} />
            {notch && i === stage && <Notch notch={notch} />}
          </div>
        ))}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={openRoadmap}
      title={title}
      aria-label={title}
      className={cx('group flex h-4 min-w-0 flex-1 items-center rounded-full', className)}
    >
      {STAGES.map((st, i) => {
        const last = i === STAGE_COUNT - 1
        const done = i < stage
        const here = i === stage
        return (
          <span key={st.key} className={cx('flex items-center', !last && 'min-w-2 flex-1')}>
            {last ? (
              <span
                className={cx(
                  'grid size-4 shrink-0 place-items-center rounded-full transition-colors',
                  here ? 'bg-brand text-on-ink' : 'text-ink-3 group-hover:text-brand-ink',
                )}
              >
                <Icon name="unicorn" size={here ? 11 : 13} />
              </span>
            ) : (
              <span
                className={cx(
                  'shrink-0 rounded-full transition-all',
                  here ? 'size-2.5 bg-brand ring-2 ring-brand/25' : done ? 'size-1.5 bg-brand' : 'size-1.5 bg-border-strong',
                )}
              />
            )}
            {!last && (
              <span className="relative mx-0.5 h-1 flex-1 rounded-full bg-brand/15">
                <span className="block h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${linkFill(i, stage, progress) * 100}%` }} />
                {notch && here && <Notch notch={notch} tall />}
              </span>
            )}
          </span>
        )
      })}
    </button>
  )
}
