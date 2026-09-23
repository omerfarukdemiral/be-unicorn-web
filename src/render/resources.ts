// Shared geometries and materials. Everything is cached so 60 characters + a full office
// reuse a handful of GPU buffers (PLAN §10 performance target).
import * as THREE from 'three'

const geoCache = new Map<string, THREE.BufferGeometry>()

function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    geoCache.set(key, g)
  }
  return g as T
}

/** Unit primitives: scale the mesh to size them. */
export const GEO = {
  get box() {
    return cached('box', () => new THREE.BoxGeometry(1, 1, 1))
  },
  /** Radius 0.5, height 1 → scale [d, h, d]. Low-poly (8 sides). */
  get cyl() {
    return cached('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8))
  },
  get cylSmooth() {
    return cached('cylSmooth', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14))
  },
  /** Radius 0.5 cone, height 1. */
  get cone() {
    return cached('cone', () => new THREE.ConeGeometry(0.5, 1, 8))
  },
  /** Radius 0.5 low-poly sphere. */
  get sphere() {
    return cached('sphere', () => new THREE.IcosahedronGeometry(0.5, 1))
  },
  get sphereSmooth() {
    return cached('sphereSmooth', () => new THREE.SphereGeometry(0.5, 14, 10))
  },
  /** Radius 0.5 half sphere (hair caps, domes). */
  get dome() {
    return cached('dome', () => new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2))
  },
  /** Unit plane lying on XZ. */
  get plane() {
    return cached('plane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2))
  },
  /** Unit ring outline on XZ (inner 0.42, outer 0.5). */
  get ring() {
    return cached('ring', () => new THREE.RingGeometry(0.42, 0.5, 32).rotateX(-Math.PI / 2))
  },
  get disc() {
    return cached('disc', () => new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2))
  },
  /** Square frame outline on XZ, 1×1 outer. */
  get frame() {
    return cached('frame', () => {
      const shape = new THREE.Shape()
      shape.moveTo(-0.5, -0.5).lineTo(0.5, -0.5).lineTo(0.5, 0.5).lineTo(-0.5, 0.5).lineTo(-0.5, -0.5)
      const hole = new THREE.Path()
      hole.moveTo(-0.44, -0.44).lineTo(-0.44, 0.44).lineTo(0.44, 0.44).lineTo(0.44, -0.44).lineTo(-0.44, -0.44)
      shape.holes.push(hole)
      return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2)
    })
  },
  /** Four-point star on XZ (special slots). */
  get star() {
    return cached('star', () => {
      const s = new THREE.Shape()
      const pts = 8
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2
        const r = i % 2 === 0 ? 0.5 : 0.2
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (i === 0) s.moveTo(x, y)
        else s.lineTo(x, y)
      }
      return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2)
    })
  },
}

/** Torus/capsule need their proportions baked in; cached per args. */
export function torusGeo(radius: number, tube: number): THREE.BufferGeometry {
  const r = Math.round(radius * 100) / 100
  const t = Math.round(tube * 100) / 100
  return cached(`torus:${r}:${t}`, () => new THREE.TorusGeometry(r, Math.max(0.005, t), 6, 16))
}

export function capsuleGeo(radius: number, length: number): THREE.BufferGeometry {
  const r = Math.round(radius * 100) / 100
  const l = Math.round(length * 100) / 100
  return cached(`capsule:${r}:${l}`, () => new THREE.CapsuleGeometry(Math.max(0.01, r), Math.max(0, l), 3, 8))
}

const matCache = new Map<string, THREE.Material>()

/** Flat-shaded pastel standard material, cached by colour. */
export function mat(color: string): THREE.MeshStandardMaterial {
  const key = `std:${color}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 })
    matCache.set(key, m)
  }
  return m as THREE.MeshStandardMaterial
}

/** Self-lit material (screens, lamps, LEDs). */
export function glowMat(color: string, intensity = 1): THREE.MeshStandardMaterial {
  const key = `glow:${color}:${intensity}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, flatShading: true, roughness: 0.4 })
    matCache.set(key, m)
  }
  return m as THREE.MeshStandardMaterial
}

/** Transparent unlit material, cached by colour+opacity. Do not mutate: clone for animation. */
export function flatMat(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const key = `basic:${color}:${opacity}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })
    matCache.set(key, m)
  }
  return m as THREE.MeshBasicMaterial
}

/** Glass panes. */
export function glassMat(color = '#cfe8f5', opacity = 0.35): THREE.MeshStandardMaterial {
  const key = `glass:${color}:${opacity}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.1, depthWrite: false })
    matCache.set(key, m)
  }
  return m as THREE.MeshStandardMaterial
}

/** Invisible but raycastable material for hit areas. */
export const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
