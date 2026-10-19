// Realistic look, tier 1 (?look=real): image-based light, smooth PBR surfaces with real roughness/metalness, ambient
// occlusion and a post pass. Same geometry and palette as the classic look; a URL flag so both can be compared on one
// build. Pure: no three import, read once at module load (the material caches are built from it).

function readFlag(): boolean {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).get('look') === 'real'
  } catch {
    return false
  }
}

export const REAL_LOOK = readFlag()

export interface Surface {
  roughness: number
  metalness: number
}

/** Painted wood, fabric, plaster, skin: everything without an entry below. */
const DIFFUSE: Surface = { roughness: 0.68, metalness: 0 }
/** Monitor bezels, chair bases, lamp arms, laptop lids: dark satin plastic / powder-coated steel. */
const DARK_SATIN: Surface = { roughness: 0.42, metalness: 0 }
/** Brushed aluminium (laptop, espresso machine, stands). */
const ALUMINIUM: Surface = { roughness: 0.32, metalness: 0.85 }
/** Brass trim, nameplates, plaques. */
const BRASS: Surface = { roughness: 0.28, metalness: 1 }
/** Porcelain mugs, pots, monitor chins: glazed, a sharp highlight. */
const GLAZED: Surface = { roughness: 0.22, metalness: 0 }

/** The scene's recurring hardware colours (resources.mat is cached by colour, so the colour is the surface key). */
const BY_COLOR: Record<string, Surface> = {
  '#3e3c48': DARK_SATIN,
  '#2b2a33': DARK_SATIN,
  '#2b2d42': DARK_SATIN,
  '#1b1b1e': DARK_SATIN,
  '#4a4a4a': DARK_SATIN,
  '#34323f': DARK_SATIN,
  '#c0c4cc': ALUMINIUM,
  '#c9ccd6': ALUMINIUM,
  '#8c8c96': ALUMINIUM,
  '#8d99ae': ALUMINIUM,
  '#8d8a99': ALUMINIUM,
  '#d9b45a': BRASS,
  '#e8c46a': BRASS,
  '#fbf8f2': GLAZED,
  '#f4f1ea': GLAZED,
}

/** Hair: a soft sheen, never the hardware its colour shares (black hair is the monitor ink, grey hair the aluminium). */
const HAIR: Surface = { roughness: 0.55, metalness: 0 }

/** Car paint: a clear-coat sheen over a metallic flake. */
const PAINT: Surface = { roughness: 0.24, metalness: 0.45 }
/** Tinted car glass: a dark mirror of the sky. */
const CAR_GLASS: Surface = { roughness: 0.06, metalness: 0.7 }
/** Tyres, bumpers, rubber trim. */
const RUBBER: Surface = { roughness: 0.88, metalness: 0 }
/** Leaves and grass: no sheen at all. */
const FOLIAGE: Surface = { roughness: 0.9, metalness: 0 }

const BY_KIND = { hair: HAIR, paint: PAINT, glass: CAR_GLASS, rubber: RUBBER, foliage: FOLIAGE } as const

/** Callers that know what a part is name it; the colour table only guesses for the rest. */
export type SurfaceKind = keyof typeof BY_KIND

export function surfaceOf(color: string, kind?: SurfaceKind): Surface {
  if (kind) return BY_KIND[kind]
  return BY_COLOR[color.toLowerCase()] ?? DIFFUSE
}
