// Layout scale (docs/LAYOUT.md §1). One spacing unit, one surface family.
export const GAP = 8
export const EDGE = 8
export const BAR_H = 56
/** Landscape phone: every bar is one row, h52 (docs/LAYOUT.md §1.4). */
export const LANDSCAPE_BAR_H = 52
export const STRIP_H = 40
/** Phone strip: 44 so its ⌃ button is a full touch target. */
export const STRIP_H_MOBILE = 44
export const MOBILE_BOTTOM_H = 104
export const MOBILE_BOTTOM_TABS_H = 56
export const PANEL_W = 400
export const PANEL_W_NARROW = 360
export const PANEL_NARROW_BELOW = 1280
/** Landscape phone: the panel is a right column, at most this wide and never over 46% of the screen. */
export const PANEL_W_LANDSCAPE = 360
export const PIN_VISIBLE = (vw: number): number => (vw >= 1440 ? 2 : vw >= 1280 ? 1 : 0)
