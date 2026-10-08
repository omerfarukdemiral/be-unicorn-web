// Blocking moment shell: a game event card set into the office, not a web dialog on a grey dim. A mood veil changes
// only the room's light (event: edges darken; win: warm brand glow; loss: the office goes grey over 900 ms; desk:
// paused-world stillness), so the scene the moment is about stays lit. Every card has the same anatomy: a round
// emblem medallion over the top edge, a title ribbon (a red stamp when the run is lost), one pinned answer row, and
// Esc where onClose exists. No corner X, no click-outside dismiss, no phone bottom sheet: a moment is answered with
// its key. The skin comes only from .ui-card, the --shadow-* tokens and token-only classes in index.css, so a
// material change restyles every frame in one place.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useLayoutMode } from '../hooks'
import type { IconName } from '../icons'
import { cx, IconBadge, Label } from '../primitives'
import { BAR_H, EDGE, GAP, LANDSCAPE_BAR_H, MOBILE_BOTTOM_TABS_H } from '../layout/tokens'
import { usePanelWidth } from '../layout/useSceneInset'

export type OverlayMood = 'event' | 'win' | 'loss' | 'desk'
export type OverlayPlace = 'center' | 'low' | 'dock'

// Literal class strings (not composed), so Tailwind sees and generates every animate-* utility.
const VEIL = {
  event: 'ui-vignette-event animate-fade-in',
  win: 'ui-vignette-win animate-fade-in',
  loss: 'ui-vignette-loss animate-veil-slow',
  desk: 'ui-vignette-desk animate-fade-in',
} as const

const FADE_MASK = 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)'
const FADE: CSSProperties = { maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }

/** Below this much scene width (a landscape phone with the panel open) the card ignores the panel and uses the screen. */
const NARROW_SCENE_W = 360

// `fixed` boxes sit in the viewport, not in GameUI's root, so they add the safe-area padding (notch, rounded corners)
// that the root's `safe-top safe-x` gives the bars and RightPanel.
const safeL = (px: number) => `calc(env(safe-area-inset-left, 0px) + ${px}px)`
const safeR = (px: number) => `calc(env(safe-area-inset-right, 0px) + ${px}px)`

export function OverlayFrame({
  children,
  onClose,
  labelledBy,
  mood = 'event',
  place = 'center',
  wide,
  emblem,
  title,
  kicker,
  head,
  actions,
}: {
  children: ReactNode
  /** Esc only (capture phase, so shortcuts.ts never sees it). Omit = must be answered. No X, and the veil never closes. */
  onClose?: () => void
  /** id of the dialog's name. Default 'overlay-title' = the frame's own h2 when `title` is set. The desk passes 'payday-title'. */
  labelledBy?: string
  mood?: OverlayMood
  /** 'center' (default) / 'low' = in the scene area (low: bottom of it, the new office stays visible above). 'dock' = the right panel's slot. */
  place?: OverlayPlace
  /** max-w-2xl instead of max-w-md (ignored by dock). */
  wide?: boolean
  /** Medallion over the top edge; color = duotone hue (default brand). Not drawn when docked. */
  emblem?: { icon: IconName; color?: string }
  /** Frame <h2>: ribbon for event / win / desk, stamp for loss. */
  title?: ReactNode
  /** <Label> under the title. */
  kicker?: ReactNode
  /** Pinned custom header instead of title / kicker (payday desk); it owns its own h2 + id. */
  head?: ReactNode
  /** Pinned row under the scroller (the screen's Buttons; autoFocus stays on the screen's commit). Owns the safe-area bottom. */
  actions?: ReactNode
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

  // The body ends against the pinned actions: while more of it sits below, its last 28px fade out, so a phone player
  // sees there is another line before answering (a receipt row or a karne bar hidden under the actions tray).
  const body = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = body.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      if (el.firstElementChild) ro.observe(el.firstElementChild)
      setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // A swapped body (the post-mortem's page turn) brings a new child to observe.
    const mo = new MutationObserver(update)
    mo.observe(el, { childList: true })
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [])

  const inset = useGameStore((s) => s.ui.sceneInset)
  const mode = useLayoutMode()
  const panelW = usePanelWidth(mode)
  const titleId = labelledBy ?? 'overlay-title'
  const docked = place === 'dock'

  let boxClass: string
  let boxStyle: CSSProperties
  if (docked) {
    // The desk takes the right panel's slot: the panel and the desk are one surface, so "one right panel" still holds
    // while payday is open. Mirrors RightPanel.tsx's rect (EDGE, bar heights, safe-area bottom): change both together.
    // The top comes from the measured scene inset (the real HUD bottom + GAP, safe area included): the portrait HUD is
    // two rows, so a one-bar constant would put the desk over it. The constant only covers the first frame (inset 0).
    // The panel stays mounted underneath, so its state survives "Sonra".
    const barH = mode === 'landscape' ? LANDSCAPE_BAR_H : BAR_H
    const top = inset.top || EDGE + barH + GAP
    if (mode === 'portrait') {
      boxClass = 'fixed flex items-end'
      boxStyle = {
        left: safeL(EDGE),
        right: safeR(EDGE),
        top,
        bottom: `calc(max(${EDGE}px, env(safe-area-inset-bottom, 0px)) + ${MOBILE_BOTTOM_TABS_H + GAP}px)`,
      }
    } else {
      boxClass = 'fixed flex max-w-[calc(100vw-16px)]'
      boxStyle = {
        right: safeR(EDGE),
        width: panelW,
        top,
        bottom: `calc(max(${EDGE}px, env(safe-area-inset-bottom, 0px)) + ${barH + GAP}px)`,
      }
    }
  } else {
    // The scene area between the bars (sceneInset, 0 until first measured = full viewport). With the panel open on a
    // landscape phone the leftover scene is too thin for a card, so the card takes the screen width instead.
    const narrow = typeof window !== 'undefined' && window.innerWidth - GAP - inset.right < NARROW_SCENE_W
    boxClass = cx('fixed flex justify-center p-4', place === 'low' ? 'items-end' : 'items-center')
    boxStyle = { top: inset.top, bottom: inset.bottom, left: safeL(GAP), right: narrow ? safeR(GAP) : Math.max(GAP, inset.right) }
  }

  const hue = emblem?.color ?? 'var(--color-brand)'
  const medallion = emblem && !docked
  return (
    <div className="pointer-events-auto fixed inset-0 z-50" data-overlay-mood={mood}>
      {/* Veil is a sibling, not a parent: its fade / backdrop-filter must not fade or contain the card. */}
      <div aria-hidden="true" className={cx('ui-vignette absolute inset-0', VEIL[mood])} />
      <div className={boxClass} style={boxStyle}>
        {/* Overflow stays visible: the medallion and the ribbon tails hang past the card edge; only the body scrolls. */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cx(
            'ui-card relative flex min-h-0 w-full flex-col',
            docked
              ? cx('shadow-panel', mode === 'portrait' ? 'max-h-full animate-slide-up' : 'h-full animate-slide-in-right')
              : cx('shadow-pop max-h-full animate-deal', wide ? 'max-w-2xl' : 'max-w-md', medallion && 'mt-7'),
          )}
        >
          {medallion && (
            <span
              aria-hidden="true"
              className="ui-medallion animate-emblem absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
              style={{ '--medallion-hue': hue } as CSSProperties}
            >
              <IconBadge icon={emblem.icon} size={36} color={hue} />
            </span>
          )}
          {head ? (
            <div className="shrink-0">{head}</div>
          ) : (
            (title || kicker) && (
              <header className={cx('flex shrink-0 flex-col items-center gap-1.5 text-center', medallion ? 'pt-9' : 'pt-5')}>
                {/* The ribbon runs 10px past the card edge on both sides (its notched tails), so the header has no side padding. */}
                {title && (
                  <h2
                    id={titleId}
                    className={
                      mood === 'loss'
                        ? 'ui-stamp animate-stamp text-[22px] font-extrabold leading-tight'
                        : 'ui-ribbon -mx-2.5 self-stretch text-[19px] font-extrabold leading-tight'
                    }
                  >
                    {title}
                  </h2>
                )}
                {kicker && <Label className="px-5">{kicker}</Label>}
              </header>
            )
          )}
          <div ref={body} className="ui-scroll min-h-0 flex-1 px-5 py-4 sm:px-6" style={more ? FADE : undefined}>
            {children}
          </div>
          {actions && <footer className="shrink-0 px-5 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6">{actions}</footer>}
        </div>
      </div>
    </div>
  )
}
