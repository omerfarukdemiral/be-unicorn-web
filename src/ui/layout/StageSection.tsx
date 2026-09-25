// Top bar, section A: stage name + date (neutral month ring) + stage progress (valuation / target) + the round.
// The round clock lives ONLY here ("Tur 3/10 hf" chip, docs/LAYOUT.md §2.1); "Tur başlat" takes the same slot.
import { useShallow } from 'zustand/react/shallow'
import { STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money } from '../format'
import { cx } from '../primitives'
import { DayClock } from '../time'
import { valuationLine } from '../loopUi'
import { openRoadmap, roadmapTitle, RoadmapStepper } from './RoadmapStepper'

/** Round chip / button → Büyüme panel scrolled to the round block (again closes it, like the dock tabs). */
export function openRound() {
  const { ui, openPanel, closePanel } = useGameStore.getState()
  if (ui.panel?.kind === 'growth') closePanel()
  else openPanel({ kind: 'growth', section: 'round' }, { root: true })
}

export type StageVariant = 'wide' | 'narrow' | 'mobile'

function useStage() {
  return useGameStore(
    useShallow((st) => ({
      stage: st.state.stage,
      progress: st.state.derived.stageProgress,
      valuation: st.state.finance.valuation,
      parts: st.state.derived.valuationParts,
      canStart: st.state.derived.canStartRound,
      roundActive: !!st.state.round?.active,
      weeksLeft: st.state.round?.weeksLeft ?? 0,
      weeksTotal: st.state.round?.weeksTotal ?? 0,
      gameOver: !!st.state.gameOver,
      company: st.state.meta.companyName,
    })),
  )
}

function progressTitle(s: ReturnType<typeof useStage>): string {
  const next = STAGES[s.stage + 1]
  if (!next) return t('top.lastStage')
  const head = t('top.progressTitle', { stage: next.name, v: money(s.valuation), target: money(next.targetValuation ?? 0) })
  return s.parts ? `${head}\n${valuationLine(s.parts)}` : head
}

/** Thin segmented Unicorn-yolu line (phones: 2px under row 1, no figures): one segment per stage step. */
export function StageProgressLine({ className }: { className?: string }) {
  const s = useStage()
  return <RoadmapStepper size="line" stage={s.stage} progress={STAGES[s.stage + 1] ? s.progress : 1} className={className} />
}

function RoundSlot({ variant }: { variant: StageVariant }) {
  const s = useStage()
  if (s.gameOver) return null
  if (s.roundActive) {
    const left = Math.max(0, Math.ceil(s.weeksLeft))
    const total = Math.max(1, Math.round(s.weeksTotal))
    // Weeks done, the same count as Büyüme › Tur's progress row ("3/11 hafta"): one number for the round.
    const week = Math.min(total, Math.max(0, Math.round(total - s.weeksLeft)))
    const title = t('top.roundTitle', { v: left })
    return (
      <button
        type="button"
        onClick={openRound}
        title={title}
        aria-label={title}
        className={cx(
          'tabular inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-soft text-[11px] font-semibold text-brand-ink transition-colors hover:bg-brand/20',
          // Phones: a 44px target (the row is h44); desktop: a small h24 chip.
          variant === 'mobile' ? 'h-11 px-2' : 'h-6 px-2',
        )}
      >
        <Icon name="timer" size={12} />
        {/* Same meaning everywhere: weeks DONE of the total ("3/11"), never a bare countdown number. */}
        {variant === 'mobile' ? t('top.roundShort', { w: week, t: total }) : t('top.round', { w: week, t: total })}
      </button>
    )
  }
  if (!s.canStart) return null
  return (
    <button
      type="button"
      onClick={openRound}
      title={t('top.roundStart')}
      aria-label={t('top.roundStart')}
      className={cx(
        'inline-flex shrink-0 animate-pop-in items-center gap-1 rounded-control bg-brand px-2 text-xs font-semibold tracking-wide text-on-ink transition-colors hover:bg-brand-hover',
        variant === 'mobile' ? 'h-11' : 'h-8',
      )}
    >
      <Icon name="rocket" size={14} />
      {variant === 'wide' ? t('top.roundStart') : t('top.roundStartShort')}
    </button>
  )
}

/**
 * wide (≥1280, ≥256px, grows so the name is never cut): name · date on row 1, progress bar + "$412K / $1M" on row 2, round slot on the right.
 * narrow (<1280, ≥216px, grows like wide): same without the figures (they are in the tooltip).
 * mobile: one row (name · date · round); TopBar draws StageProgressLine under it.
 */
export function StageSection({ variant = 'wide' }: { variant?: StageVariant }) {
  const s = useStage()
  const name = STAGES[s.stage]?.name ?? '—'
  const next = STAGES[s.stage + 1]

  const nameEl = (
    <button
      type="button"
      onClick={openRoadmap}
      title={roadmapTitle(s.stage)}
      className={cx(
        'inline-flex min-w-0 items-center gap-1.5 rounded-md text-[13px] font-semibold tracking-wide text-ink transition-colors hover:text-brand-ink',
        variant === 'mobile' && 'h-11',
      )}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
      <span className="shrink-0">{name}</span>
      {variant !== 'mobile' && s.company && (
        <span title={t('top.companyTitle', { v: s.company })} className="font-text min-w-0 truncate text-[11px] font-medium tracking-normal text-ink-2">
          {s.company}
        </span>
      )}
    </button>
  )

  if (variant === 'mobile') {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {nameEl}
        <DayClock compact />
        <RoundSlot variant="mobile" />
      </div>
    )
  }

  return (
    <div className={cx('flex shrink-0 items-center gap-2', variant === 'wide' ? 'min-w-64' : 'min-w-[216px]')}>
      {/* wide: the stepper keeps room (≥ 288px column) next to the figures even with the round chip beside it. */}
      <div className={cx('flex-1', variant === 'wide' ? 'min-w-72' : 'min-w-0')}>
        <div className="flex h-5 min-w-0 items-center gap-2">
          {nameEl}
          <DayClock />
        </div>
        <div className="mt-1 flex items-center gap-2" title={progressTitle(s)}>
          <RoadmapStepper stage={s.stage} progress={next ? s.progress : 1} />
          {variant === 'wide' && (
            <span className="tabular shrink-0 text-[11px] font-medium text-ink-2">
              {next ? t('top.progress', { v: money(s.valuation), target: money(next.targetValuation ?? 0) }) : t('top.lastStage')}
            </span>
          )}
        </div>
      </div>
      <RoundSlot variant={variant} />
    </div>
  )
}
