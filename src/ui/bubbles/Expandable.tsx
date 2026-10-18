// Shared frame of every actionable scene bubble (scene-first spec §4): collapsed it is one pill above whoever asks
// (mark + one line + chevron); a tap expands it in place, options stacked one per row with their labelled chips, and
// the world holds while it is open (store ui.bubbleOpen → the `bubble` pause). Acting dispatches an engine action
// (the store clears bubbleOpen and time resumes); × / Esc / a floor tap close it. "Detay" opens the deeper panel.
// The open key lives in the store, so at most one bubble is expanded at a time.
import { useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import { ChipRow, type Chip } from '../EffectChips'
import { useIsMobile, useLayoutMode } from '../hooks'
import { CARD_SLACK, expandableLimits } from '../layout/panelFit'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { cx, IconButton } from '../primitives'
import { iconTone, soft } from '../theme'
import { Face, type FaceId } from './face'
import { BUBBLE_HOVER, BUBBLE_SHELL, BubbleTail, SpeakerLine, tintEdge, tintGround } from './shell'

export interface BubbleMark {
  icon: IconName
  color: string
}

/** Expands `key` (closing the phone's bottom sheet first so the bubble is not hidden under it). */
export function openBubble(key: string, mobile = false): void {
  const st = useGameStore.getState()
  if (mobile && st.ui.panel) st.closePanel()
  st.setBubbleOpen(key)
}

export function closeBubble(): void {
  useGameStore.getState().setBubbleOpen(null)
}

/** A launcher into a panel / overlay: the bubble closes first, then the deeper view takes over (and its own pause). */
export function launch(open: () => void): void {
  closeBubble()
  open()
}

function subscribeResize(cb: () => void): () => void {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}
const viewportKey = () => `${window.innerWidth}x${window.innerHeight}`

/** The open card's limits from the free scene area (see expandableLimits); re-read on resize and when the HUD insets move. */
function useCardLimits(): { maxH: number; maxW: number; landscape: boolean } {
  const key = useSyncExternalStore(subscribeResize, viewportKey, () => '1440x900')
  const inset = useGameStore((s) => s.ui.sceneInset)
  const mode = useLayoutMode()
  const [w, h] = key.split('x').map(Number) as [number, number]
  return { ...expandableLimits({ w, h }, inset, mode), landscape: mode === 'landscape' }
}

/** Pointer events stay in the bubble: a tap on it is never a floor tap (which clears the selection and the bubble). */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

export function Expandable({
  bubbleKey,
  kind,
  mark,
  face,
  speaker,
  line,
  detail,
  attention,
  lineInBody,
  children,
}: {
  bubbleKey: string
  /** data-bubble value (QA scripts select on it). */
  kind: string
  mark: BubbleMark
  /** Who asks, as a portrait (T15); the mark becomes its corner badge. Without one the mark tile stands alone. */
  face?: FaceId
  speaker?: string
  /** The collapsed line (one line, clamped). */
  line: string
  /** Opens the deeper view (panel / overlay). */
  detail?: () => void
  /** A short nudge when it appears (decisions). */
  attention?: boolean
  /** The body repeats the line (a decision's question): the open header then names only the speaker. */
  lineInBody?: boolean
  children: ReactNode
}) {
  const open = useGameStore((s) => s.ui.bubbleOpen === bubbleKey)
  const mobile = useIsMobile()
  const limits = useCardLimits()
  // Opening / closing swaps the pill for the card: from the first swap on, each new face fades + scales in
  // (the very first face is faded in by the scene's BubbleAnchor).
  const first = useRef(open)
  const swapped = useRef(false)
  if (open !== first.current) swapped.current = true
  const swap = swapped.current && 'animate-bubble-swap'
  const ground = tintGround(mark.color)

  if (!open) {
    // The tail sits outside the pill so the pill itself never overflows (QA: scrollHeight ≤ clientHeight).
    return (
      // Keyed per face: React would otherwise reuse the node and the swap animation would run only once.
      <div key="pill" className={cx('relative w-max max-w-[min(260px,70vw)]', swap)}>
        <button
          type="button"
          data-bubble={kind}
          data-open="false"
          aria-expanded={false}
          aria-label={speaker ? `${speaker} · ${line}` : line}
          onPointerDown={stop}
          onClick={(e) => {
            e.stopPropagation()
            openBubble(bubbleKey, mobile)
          }}
          style={ground}
          className={cx(
            BUBBLE_SHELL,
            BUBBLE_HOVER,
            // 36px with a mouse, 44px under a thumb or on a phone layout (spec §4 pill height vs the touch target).
            'group flex min-h-9 w-max max-w-full items-center gap-1.5 py-1 pl-1 pr-2 text-left pointer-coarse:min-h-11',
            mobile && 'min-h-11',
            attention && 'animate-attention',
          )}
        >
          {face ? <Face id={face} size={28} color={mark.color} badge={mark.icon} className="mr-0.5" /> : <MarkTile mark={mark} />}
          <span className="font-text line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-tight text-ink">
            {/* Two lines, not one (C1): a long question ("Kervan.io için sıradaki modül: Ödeme altyapısı?") was cut
                before the part being asked; two 13px lines still fit the 44px phone pill. */}
            {/* Phones: a question pill spends its ~260px on the question; the stem and the mark already say who asks
                ("Metin · En büyük iki müşterin s…" cut the hook mid-word, QA). The open card names the speaker. */}
            {speaker && !(mobile && lineInBody) && <span className="text-ink-2">{speaker} · </span>}
            {line}
          </span>
          <Icon name="chevronDown" size={14} className="shrink-0 text-ink-2 transition-transform group-hover:translate-y-px group-hover:text-ink" />
        </button>
        <BubbleTail style={ground} />
      </div>
    )
  }

  return (
    <div key="card" className={cx('relative', swap)} onPointerDown={stop} onClick={stop}>
      <div
        data-bubble={kind}
        data-open="true"
        role="dialog"
        aria-label={line}
        // The whole card is capped by the free scene area and only the body scrolls: a long topic wraps the header to
        // 3-4 lines on a 320-375px phone (C1), and a fixed header allowance would push the card's top off the scene.
        style={{ ...tintEdge(mark.color), maxHeight: `calc(var(--scene-free-h, 9999px) - ${CARD_SLACK}px)`, ...(limits.landscape ? { width: limits.maxW } : null) }}
        className={cx(BUBBLE_SHELL, 'flex flex-col overflow-hidden', !limits.landscape && (mobile ? 'w-[calc(100vw-24px)]' : 'w-[min(340px,calc(100vw-32px))]'))}
      >
        {/* The answers come first in the DOM (the header is drawn on top with order-first): the first control after the
            pill tap is an answer, not Detay / ×, for Tab and for scripted players (fix round F5: bubble → answer, 2 taps). */}
        <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain px-2.5 pb-2.5 *:shrink-0" style={{ maxHeight: limits.maxH }}>{children}</div>
        {/* The header on the kind's ground, the answers on the neutral surface (chips keep their green / red). */}
        <div className={cx('order-first mb-2 flex min-w-0 shrink-0 items-center gap-1.5 py-1 pr-1', face ? 'pl-1.5' : 'pl-2.5')} style={{ background: ground.background }}>
          {face && <Face id={face} size={32} color={mark.color} badge={mark.icon} />}
          {/* Open, the pill's line stays as the header topic ("Sen · Tur penceresi açık"): the rows below need that context. */}
          <SpeakerLine icon={face ? undefined : mark.icon} color={mark.color} speaker={speaker} topic={lineInBody && speaker ? undefined : line} className="min-w-0 flex-1" />
          {/* 44px on touch (a 30px desktop hit area is too small for a thumb), the header stays one row. */}
          {detail && <IconButton icon="info" label={t('bubble.detail')} size={mobile ? 44 : 30} className="pointer-coarse:size-11!" onClick={() => launch(detail)} />}
          <IconButton icon="close" label={t('bubble.close')} size={mobile ? 44 : 30} className="pointer-coarse:size-11!" onClick={closeBubble} />
        </div>
      </div>
      <BubbleTail style={tintEdge(mark.color)} />
    </div>
  )
}

function MarkTile({ mark }: { mark: BubbleMark }) {
  return (
    <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-[7px]" style={{ color: iconTone(mark.color), background: soft(mark.color, 14) }}>
      <Icon name={mark.icon} size={14} />
    </span>
  )
}

/**
 * One answer, full width, one per line: label (13px, ≤ 2 lines) and its chips below, wrapping between chips only.
 * `primary` with no chips is the ink-filled main move; with chips it is an ink outline, so the chips' green / red
 * stay readable on a light ground.
 */
export function ChoiceRow({
  label,
  chips,
  effects,
  onClick,
  primary,
  disabled,
  title,
  icon,
  danger,
  focused,
}: {
  label: ReactNode
  chips?: readonly Chip[]
  /** Custom effects line in place of `chips` (a decision option's OptionEffects). */
  effects?: ReactNode
  onClick: () => void
  primary?: boolean
  disabled?: boolean
  title?: string
  icon?: BubbleMark
  /** An armed destructive tap ("Projeden çıkar? Onayla"): red outline. */
  danger?: boolean
  /** The founder's standing focus (N3): marked like the bar slot, a brand ring, the repeat mark and "Odak". */
  focused?: boolean
}) {
  const mobile = useIsMobile()
  const hasFx = !!effects || (chips?.length ?? 0) > 0
  const filled = primary && !hasFx
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-pressed={focused === undefined ? undefined : focused}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cx(
        'flex min-h-9 w-full min-w-0 flex-col items-start justify-center gap-1 rounded-control border px-2.5 py-1.5 text-left transition-colors pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-50',
        mobile && 'min-h-11',
        danger
          ? 'border-negative bg-surface text-negative-ink ring-1 ring-negative'
          : focused
          ? 'border-brand bg-surface text-ink ring-2 ring-brand'
          : filled
          ? 'border-ink bg-ink text-on-ink enabled:hover:opacity-90'
          : primary
            ? 'border-ink bg-surface text-ink ring-1 ring-ink enabled:hover:bg-surface-2'
            : 'border-border bg-surface-2/60 text-ink enabled:hover:border-border-strong enabled:hover:bg-surface-2',
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        {icon && <Icon name={icon.icon} size={15} tone={icon.color} className="shrink-0" />}
        <span className="font-text line-clamp-2 min-w-0 text-[13px] font-semibold leading-snug">{label}</span>
        {focused && (
          <span data-focus-mark="" className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-brand py-0.5 pl-1 pr-1.5 text-[11px] font-bold leading-none text-on-ink">
            <Icon name="refresh" size={10} />
            {t('focus.tag')}
          </span>
        )}
      </span>
      {effects ?? (chips && chips.length > 0 && <ChipRow chips={chips} />)}
    </button>
  )
}

/**
 * Why the rows above are faded ("Hamle yok · yeni hafta 3g"): a disabled row's title tooltip never reaches a thumb,
 * so a bubble whose every answer is blocked says so in its body. The × stays the way out.
 */
export function BlockedLine({ text, icon = 'warning' }: { text: string; icon?: IconName }) {
  return (
    <span role="status" className="font-text flex min-w-0 items-center gap-1.5 rounded-control bg-surface-2/60 px-2.5 py-1.5 text-[12px] font-semibold leading-snug text-ink-2">
      <Icon name={icon} size={14} tone="var(--color-energy)" className="shrink-0" />
      <span className="min-w-0">{text}</span>
    </span>
  )
}
