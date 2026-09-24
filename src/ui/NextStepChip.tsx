// "Sıradaki adım" (docs/CORE_LOOP.md §5): the next link of the main chain, one tap opens where it is done.
// Engine picks the link (state.derived.nextStep). It is the notification strip's resting item (P3, docs/LAYOUT.md §3):
// `variant="strip"` draws it borderless inside the strip. The start of time is asked by the StartCall card, so the
// strip hides this item while that card is up (stripRules.nextStepShown).
import { useShallow } from 'zustand/react/shallow'
import type { NextStep } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { cx } from './primitives'
import { followStep, stepGo, stepText, type StepGo } from './loopUi'
import { useIsMobile } from './hooks'

const GO_ICON: Record<StepGo | 'start', IconName> = {
  projects: 'rocket',
  shop: 'bag',
  team: 'users',
  growth: 'growth',
  act: 'search',
  start: 'play',
}

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
      const step = s.state.derived.nextStep
      const paused = !s.ui.runStarted && s.state.time.speed === 0
      return {
        step,
        text: step ? stepText(step, s.state) : '',
        needsStart: paused && step !== undefined && step.id !== 'idea',
        startCall: paused && !s.state.gameOver && s.ui.overlay === null,
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
  const openKind = useGameStore((s) => s.ui.panel?.kind)
  const step = v.step
  if (!step || v.over) return null
  const go: StepGo | 'start' = v.needsStart ? 'start' : stepGo(step)
  const text = v.needsStart ? t(touch || compact ? 'step.startTouch' : 'step.start') : v.text
  const onClick = () => (v.needsStart ? dispatch({ type: 'setSpeed', speed: 1 }) : followStep(step))
  const progress = step.progress
  const there = go !== 'start' && go !== 'act' && openKind === go

  // Borderless row for the strip: [n] "Sıradaki adım 6/8 · text" [Yap ›]. The strip draws the surface.
  return (
    <button type="button" onClick={onClick} title={`${t('step.label')} · ${text}`} className={cx('group flex h-full w-full min-w-0 items-center gap-2 text-left', className)}>
      {/* An icon, not the step number: a bare number here would sit next to the top bar's round figures. */}
      <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-brand-soft text-brand-ink" aria-hidden="true">
        <Icon name="flag" size={14} />
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        {!compact && <span className="tabular shrink-0 text-[12px] font-medium text-ink-2">{t('strip.step', { i: step.index, n: step.total })}</span>}
        <span key={step.id} className="min-w-0 animate-fade-in truncate text-[13px] font-semibold text-ink">
          {text}
        </span>
      </span>
      {/* No "Büyüme ›" while Büyüme is already the open panel: the call would point at what is on screen. */}
      {!there && (
        <span className={cx('inline-flex h-7 shrink-0 items-center gap-1 rounded-[8px] bg-brand-soft px-2 text-[12px] font-semibold text-brand-ink transition-colors group-hover:bg-brand group-hover:text-on-ink')}>
          <Icon name={GO_ICON[go]} size={14} />
          {!compact && t(`step.go.${go}`)}
          <Icon name="chevronRight" size={12} />
        </span>
      )}
      {progress !== undefined && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-brand/12">
          <span className="block h-full bg-brand transition-[width] duration-700" style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
        </span>
      )}
    </button>
  )
}
