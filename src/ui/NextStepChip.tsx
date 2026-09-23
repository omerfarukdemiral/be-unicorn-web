// "Sıradaki adım" chip (docs/CORE_LOOP.md §5): the next link of the main chain, one tap opens where it is done.
// Engine picks the link (state.derived.nextStep); before the first Başlat the chip asks to start time.
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '../store/gameStore'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { cx } from './primitives'
import { followStep, stepGo, stepText, type StepGo } from './loopUi'

const GO_ICON: Record<StepGo | 'start', IconName> = {
  projects: 'rocket',
  shop: 'bag',
  team: 'users',
  growth: 'growth',
  act: 'search',
  start: 'play',
}

export function NextStepChip({ compact, className }: { compact?: boolean; className?: string }) {
  const v = useGameStore(
    useShallow((s) => {
      const step = s.state.derived.nextStep
      return {
        step,
        text: step ? stepText(step, s.state) : '',
        // Once a project exists, the paused start's next link is time itself (the StartCall card says the same).
        needsStart: !s.ui.runStarted && s.state.time.speed === 0 && step !== undefined && step.id !== 'idea',
        over: !!s.state.gameOver,
      }
    }),
  )
  const dispatch = useGameStore((s) => s.dispatch)
  const step = v.step
  if (!step || v.over) return null
  const go: StepGo | 'start' = v.needsStart ? 'start' : stepGo(step)
  const text = v.needsStart ? t('step.start') : v.text
  const onClick = () => (v.needsStart ? dispatch({ type: 'setSpeed', speed: 1 }) : followStep(step))
  const progress = step.progress
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${t('step.label')} · ${text}`}
      className={cx(
        'group pointer-events-auto relative flex min-w-0 items-center gap-2 overflow-hidden rounded-control border border-brand/35 bg-surface/95 text-left shadow-card transition-colors hover:border-brand hover:bg-brand-soft',
        compact ? 'min-h-11 px-2 py-1' : 'min-h-9 px-2.5 py-1',
        className,
      )}
    >
      <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-on-ink" aria-hidden="true">
        {step.index}
      </span>
      <span className="min-w-0 flex-1">
        {!compact && <span className="ui-label block leading-none text-brand-ink">{t('step.label')} · {t('step.of', { i: step.index, n: step.total })}</span>}
        <span key={`${step.id}`} className="block animate-fade-in truncate text-[12.5px] font-semibold leading-tight text-ink">
          {text}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-soft px-1.5 py-1 text-[11px] font-semibold text-brand-ink group-hover:bg-surface">
        <Icon name={GO_ICON[go]} size={13} />
        {!compact && t(`step.go.${go}`)}
        <Icon name="chevronRight" size={12} />
      </span>
      {progress !== undefined && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-brand/12">
          <span className="block h-full bg-brand transition-[width] duration-700" style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
        </span>
      )}
    </button>
  )
}
