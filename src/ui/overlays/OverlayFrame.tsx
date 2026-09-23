// Blocking overlay shell: dim backdrop + centered card (bottom sheet on phones).
import { useEffect, type ReactNode } from 'react'
import { t } from '../i18n'
import { cx, IconButton } from '../primitives'

export function OverlayFrame({
  children,
  onClose,
  labelledBy,
  wide,
  bare,
}: {
  children: ReactNode
  /** Omit for overlays that must be answered (post-mortem, decision). */
  onClose?: () => void
  labelledBy?: string
  wide?: boolean
  /** Child draws its own surface. */
  bare?: boolean
}) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-ink-900/35 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'relative flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden sm:animate-pop-in',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
          bare ? 'rounded-t-[var(--radius-card)] bg-cream-50 shadow-[var(--shadow-pop)] sm:rounded-[var(--radius-card)]' : 'ui-card rounded-b-none sm:rounded-[var(--radius-card)]',
        )}
      >
        {onClose && (
          <div className="absolute right-2 top-2 z-10">
            <IconButton icon="close" label={t('common.close')} onClick={onClose} />
          </div>
        )}
        {/* Safe-area padding inside the scroller, so the last button is reachable above the home indicator. */}
        <div className="ui-scroll min-h-0 flex-1 safe-bottom">{children}</div>
      </div>
    </div>
  )
}
