// Bottom bar, left part (docs/LAYOUT.md §1.2): founder energy + the founder actions.
// Desktop: energy (bolt, bar, number) + labelled chips (icon + short label, h40); a locked action is a 40px lock.
// Phone / landscape phone: energy number + round 44px icons (label in aria + title; long-press shows the title).
import { t } from '../i18n'
import { cx } from '../primitives'
import { EnergyMeter, FounderActionButton, useFounderActions } from '../FounderActions'

export function FounderBar({ variant, className }: { variant: 'bar' | 'mobile'; className?: string }) {
  const { energy, low, actions } = useFounderActions()
  const mobile = variant === 'mobile'
  return (
    <div role="group" aria-label={t('bottom.actions')} className={cx('flex min-w-0 items-center', mobile ? 'gap-1' : 'gap-2', className)}>
      <EnergyMeter energy={energy} low={low} compact={mobile} />
      <span aria-hidden="true" className={cx('h-6 w-px shrink-0 bg-border', mobile && 'mx-0.5')} />
      <div className={cx('flex min-w-0 items-center', mobile ? 'ui-scroll gap-1 overflow-x-auto' : 'gap-1')}>
        {actions.map((a, i) => (
          <FounderActionButton key={a.kind} a={a} variant={mobile ? 'icon' : 'chip'} tipAlign={i < 2 ? 'left' : 'center'} />
        ))}
      </div>
    </div>
  )
}
