// Where the side panel and the open bubble card sit on a phone held sideways (M2). Pure, so the numbers are testable:
// a landscape phone is ~390px tall, and every px the bars take from the panel body or the bubble card is a card less.
import type { LayoutMode } from '../hooks'
import { BAR_H, EDGE, GAP } from './tokens'

/** The open card's header row (face + topic + the two 44px buttons) and the breathing room under the card. */
export const CARD_HEADER_H = 52
export const CARD_SLACK = 16
/** Landscape phone: the open card is a column, not the whole screen width. */
export const CARD_W_LANDSCAPE = 420
/** The card's old scroll-area cap (vh share), still the ceiling when the free area is bigger. */
const CARD_MAX_H = 420

/**
 * Side panel top offset and bottom offset (past the EDGE gap). Desktop: between the top bar and the bottom bar. Landscape phone: from the top
 * edge to the bottom edge; the top bar and the tab island shrink to the scene side while a panel is open
 * (TopBar, BottomStack), so the panel body gets the full height.
 */
export function sidePanelOffsets(mode: LayoutMode): {
  top: number
  bottom: number
} {
  if (mode === 'landscape') return { top: EDGE, bottom: 0 }
  return { top: EDGE + BAR_H + GAP, bottom: BAR_H + GAP }
}

/** Panel height for a viewport (`bottom` is on top of the EDGE gap; the safe area only ever adds). */
export function sidePanelHeight(mode: LayoutMode, vh: number): number {
  const o = sidePanelOffsets(mode)
  return vh - o.top - EDGE - o.bottom
}

/**
 * Open bubble card limits from the free scene area (what the fixed UI leaves; store ui.sceneInset): the scroll area
 * ends where the free area does, and a landscape card is capped at 420px instead of the whole screen width.
 */
export function expandableLimits(
  viewport: { w: number; h: number },
  inset: { top: number; right: number; bottom: number },
  mode: LayoutMode,
): { maxH: number; maxW: number } {
  const free = viewport.h - inset.top - inset.bottom - CARD_HEADER_H - CARD_SLACK
  const maxH = Math.max(120, Math.min(CARD_MAX_H, Math.round(viewport.h * 0.6), Math.round(free)))
  const maxW = mode === 'landscape' ? Math.min(CARD_W_LANDSCAPE, viewport.w - inset.right - 24) : viewport.w - 24
  return { maxH, maxW: Math.round(maxW) }
}
