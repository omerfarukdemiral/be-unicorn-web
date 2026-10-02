// Blocking overlay shell: dim backdrop + centered card (bottom sheet on phones; `sheet`: full-screen sheet on phones).
import { useEffect, type ReactNode } from 'react'
import { t } from '../i18n'
import { cx, IconButton } from '../primitives'

export function OverlayFrame({
  children,
  onClose,
  labelledBy,
  wide,
  bare,
  sheet,
}: {
  children: ReactNode
  /** Omit for overlays that must be answered (post-mortem, decision). */
  onClose?: () => void
  labelledBy?: string
  wide?: boolean
  /** Child draws its own surface. */
  bare?: boolean
  /**
   * Full-screen sheet on phones (clears the notch), centered card from sm up. The child lays out its own header,
   * scroller and footer (it owns the safe-area bottom); no close button and the backdrop does not close it
   * (Escape still calls onClose).
   */
  sheet?: boolean
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

  if (sheet) {
    return (
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-stretch justify-center bg-ink/45 animate-fade-in sm:items-center sm:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={cx(
            'flex h-full w-full flex-col overflow-hidden bg-surface pt-[env(safe-area-inset-top,0px)] animate-slide-up sm:h-auto sm:pt-0 sm:max-h-[92dvh] sm:animate-pop-in sm:rounded-card sm:border sm:border-border sm:shadow-pop',
            wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
          )}
        >
          {children}
        </section>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-ink/35 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'relative flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden sm:animate-pop-in',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
          bare ? 'rounded-t-card border border-border bg-surface shadow-pop sm:rounded-card' : 'ui-card rounded-b-none shadow-pop sm:rounded-card',
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
