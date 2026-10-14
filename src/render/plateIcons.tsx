// Path data (24x24, 2px round outline) for the head plate: one specialty glyph per dept and the three state glyphs.
// Copied from ui/icons (render does not import ui); keep the shapes in step with it.
import type { ReactNode } from 'react'
import type { Dept } from '../engine/types'
import type { PlateGlyph } from './headPlate'

const eng = <path d="m8.5 7.5-4.5 4.5 4.5 4.5M15.5 7.5l4.5 4.5-4.5 4.5M13.2 5.5l-2.4 13" />
const product = <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>
const marketing = <><path d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5v-15L7 9H5a1 1 0 0 0-1 1Z" /><path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" /></>
const sales = <><path d="M3.5 17.5 9 12l3.5 3.5L20.5 7" /><path d="M15 7h5.5v5.5" /></>
const ops = <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="6.5" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2" /></>

export const DEPT_PATH: Record<Dept, ReactNode> = { eng, product, marketing, sales, ops }

export const GLYPH_PATH: Record<PlateGlyph | 'lead', ReactNode> = {
  tired: <><rect x="3" y="7.5" width="15.5" height="9" rx="2.5" /><path d="M21 10.5v3M6.5 11v2" /></>,
  morale: <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />,
  bored: <path d="M5 6h6l-6 6h6M13 12h5l-5 5.5h5" />,
  lead: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9Z" />,
}
