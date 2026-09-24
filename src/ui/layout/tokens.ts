// Layout scale (docs/LAYOUT.md §1). One spacing unit, one surface family.
export const GAP = 8
export const EDGE = 8
export const BAR_H = 56
export const CONTROL = 40
export const STRIP_H = 40
export const STRIP_H_MOBILE = 36
export const MOBILE_TOP_H = 96
export const MOBILE_BOTTOM_H = 104
export const MOBILE_BOTTOM_TABS_H = 56
export const PANEL_W = 400
export const PANEL_W_NARROW = 360
export const PANEL_NARROW_BELOW = 1280
export const PIN_VISIBLE = (vw: number): number => (vw >= 1440 ? 2 : vw >= 1280 ? 1 : 0)
