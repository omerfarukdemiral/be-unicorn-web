// Unicorn yolu, compact: 7 nodes (Garaj → Unicorn) joined by 6 links. Passed = filled, current = ringed,
// future = faint, the last node is the unicorn. The link leaving the current stage fills with stage progress.
// Tapping it opens the Yol haritası panel (again closes it, like the round chip).
import { STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx } from '../primitives'

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

export function roadmapTitle(stage: number): string {
  return t('top.roadmapTitle', { stage: STAGES[stage]?.name ?? '', n: stage + 1 })
}

/**
 * `size`: 'bar' (desktop top bar, 16px tall nodes) or 'line' (phones: a 4px segmented line, no nodes, not a button;
 * the stage name opens the panel there).
 */
export function RoadmapStepper({ stage, progress, size = 'bar', className }: { stage: number; progress: number; size?: 'bar' | 'line'; className?: string }) {
  const title = roadmapTitle(stage)
  if (size === 'line') {
    return (
      <div className={cx('flex h-1 gap-0.5', className)} title={title} aria-hidden="true">
        {Array.from({ length: STAGE_COUNT - 1 }, (_, i) => (
          <div key={i} className="h-full flex-1 overflow-hidden rounded-full bg-brand/25">
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${linkFill(i, stage, progress) * 100}%` }} />
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
              <span className="mx-0.5 h-1 flex-1 overflow-hidden rounded-full bg-brand/15">
                <span className="block h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${linkFill(i, stage, progress) * 100}%` }} />
              </span>
            )}
          </span>
        )
      })}
    </button>
  )
}
