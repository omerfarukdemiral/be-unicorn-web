// "Sıradaki adım" (docs/CORE_LOOP.md §5, docs/GAMEPLAY_V2.md §11): flag + "6/8" + a short *why* (≤ 6 words). No
// "Panel ›" call: the object to touch breathes instead (guidance.ts: the Dock tab, the "Bul" slot, the gauge's goal
// notch). Garage only: from Pre-seed on the chip closes. Engine picks the link (state.derived.nextStep).
// It is the notification strip's resting item (P3, docs/LAYOUT.md §3): borderless inside the strip. The start of time
// is asked by the StartCall card, so the strip hides this item while that card is up (stripRules.nextStepShown).
import { useShallow } from 'zustand/react/shallow'
import type { NextStep } from '../engine/types'
import { blockingOverlay, useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { cx } from './primitives'
import { followStep, stepText } from './loopUi'
import { useIsMobile } from './hooks'

export interface NextStepView {
  step: NextStep | undefined
  text: string
  /** Paused start with a project: the next link is time itself (StartCall asks the same). */
  needsStart: boolean
  /** StartCall card is on screen (the strip hides the step then). */
  startCall: boolean
  canStartRound: boolean
  over: boolean
}

export function useNextStep(): NextStepView {
  return useGameStore(
    useShallow((s) => {
      // Past the garage the chip is closed: no step, so the strip keeps no resting row for it.
      const step = s.state.stage > 0 ? undefined : s.state.derived.nextStep
      const paused = !s.ui.runStarted && s.state.time.speed === 0
      return {
        step,
        text: step ? stepText(step, s.state) : '',
        needsStart: paused && step !== undefined && step.id !== 'idea',
        startCall: paused && !s.state.gameOver && blockingOverlay(s.ui) === null,
        canStartRound: !!s.state.derived.canStartRound,
        over: !!s.state.gameOver,
      }
    }),
  )
}

/** The strip's resting row (`variant` kept as "strip": the strip is its only home now). */
export function NextStepChip({ compact, className }: { compact?: boolean; className?: string; variant?: 'strip' }) {
  const v = useNextStep()
  const dispatch = useGameStore((s) => s.dispatch)
  // Touch screens have no Space key: the hint lives only on keyboards.
  const touch = useIsMobile()
  const step = v.step
  if (!step || v.over) return null
  const text = v.needsStart ? t(touch || compact ? 'step.startTouch' : 'step.start') : v.text
  // A tap still helps (opens the place or starts time), but nothing on the row asks for it.
  const onClick = () => (v.needsStart ? dispatch({ type: 'setSpeed', speed: 1 }) : followStep(step))
  const progress = step.progress

  // Borderless row for the strip: [flag] 6/8 · why. The strip draws the surface.
  return (
    <button type="button" onClick={onClick} title={`${t('step.label')} · ${text}`} className={cx('group flex h-full w-full min-w-0 items-center gap-2 text-left', className)}>
      <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-brand-soft text-brand-ink" aria-hidden="true">
        <Icon name="flag" size={14} />
      </span>
      <span className="tabular shrink-0 text-[13px] font-semibold text-ink-2">{t('step.count', { i: step.index, n: step.total })}</span>
      <span key={step.id} className="min-w-0 flex-1 animate-fade-in truncate text-[13px] font-semibold text-ink">
        {text}
      </span>
      {progress !== undefined && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-brand/12">
          <span className="block h-full bg-brand transition-[width] duration-700" style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
        </span>
      )}
    </button>
  )
}
