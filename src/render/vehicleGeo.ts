// Street vehicles built from side profiles: each body is a 2D silhouette (length × height, wheel arches cut in)
// extruded across the car's width with a rounded bevel, so a car reads as a car and not as two stacked boxes.
// Scale: a person is ~1 unit tall (≈ 1.75 m), so a 4.5 m sedan is ~2.5 units. Origin at the footprint centre on the
// road, front = +x. Geometries are cached per kind: every car of a kind shares them.
import * as THREE from 'three'

export type VehicleKind = 'sedan' | 'hatch' | 'suv' | 'van' | 'bus'

type Pt = [number, number]

export interface VehicleSpec {
  /** Body length and width (bevel included). */
  len: number
  width: number
  /** Wheel centres along x, wheel radius, tyre width. */
  axles: readonly number[]
  wheelR: number
  tyreW: number
  /** Lower body (painted) silhouette, front at +x, drawn counter-clockwise from the front bottom. Arches are added. */
  body: readonly Pt[]
  /** Glasshouse silhouette (sits on the body's belt line). */
  glass: readonly Pt[]
  /** Roof slab silhouette over the glass (painted). */
  roof: readonly Pt[]
  /** Head and tail lamp centres (x, y). */
  head: Pt
  tail: Pt
  /** Pillars between the side windows (x positions). */
  pillars: readonly number[]
}

const SPECS: Record<VehicleKind, VehicleSpec> = {
  sedan: {
    len: 2.5,
    width: 1.0,
    axles: [0.82, -0.78],
    wheelR: 0.2,
    tyreW: 0.15,
    body: [[1.24, 0.13], [1.26, 0.3], [1.2, 0.4], [0.5, 0.47], [-0.98, 0.5], [-1.22, 0.47], [-1.25, 0.3], [-1.22, 0.13]],
    glass: [[0.5, 0.46], [0.08, 0.76], [-0.55, 0.76], [-0.98, 0.49]],
    roof: [[0.1, 0.74], [-0.56, 0.74], [-0.52, 0.8], [0.04, 0.8]],
    head: [1.2, 0.36],
    tail: [-1.21, 0.4],
    pillars: [-0.22],
  },
  hatch: {
    len: 2.1,
    width: 0.98,
    axles: [0.66, -0.66],
    wheelR: 0.19,
    tyreW: 0.15,
    body: [[1.04, 0.13], [1.06, 0.3], [1.0, 0.42], [0.42, 0.5], [-1.0, 0.52], [-1.04, 0.3], [-1.02, 0.13]],
    glass: [[0.42, 0.49], [0.02, 0.8], [-0.86, 0.8], [-1.0, 0.51]],
    roof: [[0.04, 0.78], [-0.88, 0.78], [-0.86, 0.84], [0.0, 0.84]],
    head: [1.0, 0.38],
    tail: [-1.0, 0.45],
    pillars: [-0.36],
  },
  suv: {
    len: 2.6,
    width: 1.08,
    axles: [0.86, -0.84],
    wheelR: 0.24,
    tyreW: 0.18,
    body: [[1.28, 0.18], [1.3, 0.42], [1.22, 0.56], [0.62, 0.62], [-1.24, 0.64], [-1.3, 0.42], [-1.28, 0.18]],
    glass: [[0.62, 0.61], [0.26, 0.98], [-1.14, 0.98], [-1.24, 0.63]],
    roof: [[0.28, 0.96], [-1.16, 0.96], [-1.14, 1.03], [0.24, 1.03]],
    head: [1.25, 0.5],
    tail: [-1.26, 0.56],
    pillars: [-0.24, -0.78],
  },
  van: {
    len: 2.9,
    width: 1.1,
    axles: [0.96, -0.98],
    wheelR: 0.22,
    tyreW: 0.17,
    body: [[1.43, 0.16], [1.45, 0.4], [1.36, 0.58], [1.0, 0.66], [-1.43, 0.66], [-1.45, 0.4], [-1.43, 0.16]],
    glass: [[1.0, 0.65], [0.62, 1.12], [0.3, 1.12], [0.3, 0.65]],
    roof: [[0.62, 1.1], [0.3, 1.1], [0.3, 0.65], [-1.43, 0.65], [-1.43, 1.24], [0.5, 1.24]],
    head: [1.4, 0.52],
    tail: [-1.44, 0.58],
    pillars: [],
  },
  bus: {
    len: 5.6,
    width: 1.32,
    axles: [1.85, -1.75],
    wheelR: 0.27,
    tyreW: 0.2,
    body: [[2.79, 0.18], [2.8, 0.7], [-2.8, 0.7], [-2.8, 0.18]],
    glass: [[2.8, 0.69], [2.74, 1.5], [-2.76, 1.5], [-2.8, 0.69]],
    roof: [[2.74, 1.48], [-2.76, 1.48], [-2.72, 1.66], [2.66, 1.66]],
    head: [2.78, 0.44],
    tail: [-2.79, 0.5],
    pillars: [1.6, 0.6, -0.4, -1.4, -2.3],
  },
}

export function vehicleSpec(kind: VehicleKind): VehicleSpec {
  return SPECS[kind]
}

/** Silhouette with the wheel arches cut out of its bottom edge (arches run between the first and last bottom points). */
function bodyShape(s: VehicleSpec): THREE.Shape {
  const pts = s.body
  const shape = new THREE.Shape()
  shape.moveTo(pts[0]![0], pts[0]![1])
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i]![0], pts[i]![1])
  // Bottom edge back to the front, an arch over each axle (rear first).
  const y = pts[pts.length - 1]![1]
  const r = s.wheelR + 0.04
  for (const ax of [...s.axles].sort((a, b) => a - b)) {
    shape.lineTo(ax - r, y)
    shape.absarc(ax, y, r, Math.PI, 0, true)
  }
  shape.lineTo(pts[0]![0], pts[0]![1])
  return shape
}

function polyShape(pts: readonly Pt[]): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(pts[0]![0], pts[0]![1])
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i]![0], pts[i]![1])
  shape.closePath()
  return shape
}

/** Extrudes a silhouette across z (centred), with a rounded bevel of `bevel` on every edge. */
function extrude(shape: THREE.Shape, width: number, bevel: number, segments = 4): THREE.BufferGeometry {
  const depth = Math.max(0.001, width - bevel * 2)
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: segments, curveSegments: 14 })
  g.translate(0, 0, -depth / 2)
  g.computeVertexNormals()
  return g
}

const cache = new Map<string, THREE.BufferGeometry>()
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key)
  if (!g) {
    g = make()
    cache.set(key, g)
  }
  return g
}

export interface VehicleGeos {
  body: THREE.BufferGeometry
  glass: THREE.BufferGeometry
  roof: THREE.BufferGeometry
}

export function vehicleGeos(kind: VehicleKind): VehicleGeos {
  const s = SPECS[kind]
  const big = kind === 'bus'
  return {
    body: cached(`${kind}:body`, () => extrude(bodyShape(s), s.width, big ? 0.06 : 0.07, 5)),
    // Glass sits a touch inside the body sides (tumblehome) and a hair lower into the belt line.
    glass: cached(`${kind}:glass`, () => extrude(polyShape(s.glass), s.width - (big ? 0.03 : 0.1), big ? 0.03 : 0.05, 3)),
    roof: cached(`${kind}:roof`, () => extrude(polyShape(s.roof), s.width - (big ? 0.0 : 0.08), big ? 0.05 : 0.05, 3)),
  }
}

/** Tyre: a cylinder with rounded shoulders (a lathe), axis along z. Rim: a shallow dish. */
export function tyreGeo(r: number, w: number): THREE.BufferGeometry {
  return cached(`tyre:${r}:${w}`, () => {
    const pts: THREE.Vector2[] = []
    const sh = Math.min(0.05, w * 0.3)
    pts.push(new THREE.Vector2(r * 0.62, -w / 2))
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2)
      pts.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, -w / 2 + sh + Math.sin(a) * sh))
    }
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2)
      pts.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, w / 2 - sh + Math.sin(a) * sh))
    }
    pts.push(new THREE.Vector2(r * 0.62, w / 2))
    const g = new THREE.LatheGeometry(pts, 28)
    g.rotateX(Math.PI / 2)
    return g
  })
}

export function rimGeo(r: number): THREE.BufferGeometry {
  return cached(`rim:${r}`, () => {
    const g = new THREE.CylinderGeometry(r * 0.64, r * 0.6, 0.03, 24)
    g.rotateX(Math.PI / 2)
    return g
  })
}
