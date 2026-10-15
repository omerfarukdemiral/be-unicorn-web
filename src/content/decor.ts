// Office decor catalogue (grid design §6). Every piece is cosmetic: no stat reads it. Moving a piece is free, a new
// one costs cash, a piece taken out goes to storage (Depo) and comes back for free. Prices sit at about 1% of a
// month's rent at the piece's stage. Footprints are in cells: `w` along the piece's right axis, `d` along its front.
// The looks live in render/Decor.tsx; this file is pure data so the engine can price and fit pieces.
import type { StageIndex } from '../engine/types'

export type DecorGroup = 'separator' | 'floor' | 'wall'

export interface DecorDef {
  kind: string
  name: string
  group: DecorGroup
  price: number
  /** First stage the piece is on sale (a stored piece can always go back up). */
  stage: StageIndex
  w: 1 | 2
  d: 1 | 2
  /** Rugs lie under everything and are walked on. */
  blocking: boolean
}

const sep = (kind: string, name: string, price: number, stage: StageIndex): DecorDef => ({ kind, name, group: 'separator', price, stage, w: 1, d: 1, blocking: true })
const floor = (kind: string, name: string, price: number, stage: StageIndex, size: 1 | 2 = 1, blocking = true): DecorDef => ({ kind, name, group: 'floor', price, stage, w: size, d: size, blocking })
const wall = (kind: string, name: string, price: number, stage: StageIndex): DecorDef => ({ kind, name, group: 'wall', price, stage, w: 1, d: 1, blocking: false })

export const DECOR: readonly DecorDef[] = [
  sep('panel', 'Bölme paneli', 300, 0),
  sep('plantRow', 'Saksı sırası', 600, 1),
  sep('glass', 'Cam bölme', 1_500, 2),
  sep('slats', 'Ahşap çıta', 4_000, 3),
  sep('marblePlanter', 'Mermer saksılık', 20_000, 5),
  floor('plantPot', 'Saksı', 150, 0),
  floor('bin', 'Çöp kutusu', 150, 0),
  floor('lamp', 'Lambader', 250, 0),
  floor('whiteboard', 'Beyaz tahta', 500, 1),
  floor('rug', 'Halı', 400, 1, 2, false),
  floor('sign', 'Ayaklı tabela', 2_000, 2),
  floor('arcade', 'Atari makinesi', 6_000, 3),
  floor('sculpture', 'Heykel', 40_000, 5),
  wall('poster', 'Poster', 300, 0),
  wall('banner', 'Flama', 400, 1),
  wall('clock', 'Saat', 500, 1),
  wall('plaque', 'Plaket', 1_000, 2),
  wall('print', 'Çerçeveli baskı', 1_500, 2),
  wall('neon', 'Neon yazı', 3_000, 3),
  wall('canvas', 'Büyük tuval', 8_000, 4),
  wall('goldRecords', 'Altın plak duvarı', 25_000, 5),
]

const BY_KIND = new Map(DECOR.map((d) => [d.kind, d]))

export function decorDef(kind: string): DecorDef | undefined {
  return BY_KIND.get(kind)
}

/** One wall painted (the whole back or left wall). Paint is free of the decor cap. */
export const PAINT_PRICE = 200
export const PAINT_KIND = 'paint'

/** Wall colours: soft pastels plus two deep tones and two neutrals. */
export const PAINT_SWATCHES: readonly string[] = [
  '#f4efe6', '#e9e2d6', '#f6d9c4', '#f7e3a1', '#cfe6c4', '#bfe0d8',
  '#c9dcf3', '#d9cdf3', '#f3cdd9', '#9fb7a2', '#4e5d78', '#3b3a45',
]
