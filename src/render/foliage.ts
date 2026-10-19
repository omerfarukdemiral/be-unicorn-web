// Realistic look: tree crowns and bushes as lumpy leaf masses instead of a single cone or ball. Each shape fills the
// same unit box as the primitive it replaces (cone: radius 0.5, height 1, centred), so the instance transforms in
// Surroundings stay as they are. Smooth normals over a welded, displaced mesh: soft clumps, no facets.
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Cheap smooth-ish 3D value noise from sines: deterministic, no table. */
function lump(x: number, y: number, z: number): number {
  return (Math.sin(x * 7.1 + y * 3.3) * Math.sin(y * 6.7 + z * 2.9) * Math.sin(z * 7.9 + x * 4.1) + Math.sin(x * 15.3 + z * 13.1) * 0.35) * 0.5
}

/** Welds, pushes every vertex along its normal by the noise, recomputes smooth normals. */
function displace(g: THREE.BufferGeometry, amount: number): THREE.BufferGeometry {
  const w = mergeVertices(g.deleteAttribute('normal').deleteAttribute('uv'), 1e-4)
  w.computeVertexNormals()
  const p = w.getAttribute('position')
  const n = w.getAttribute('normal')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const d = lump(x, y, z) * amount
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d)
  }
  w.computeVertexNormals()
  return w
}

function ball(r: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(r, 4).translate(x, y, z)
}

let broadleaf: THREE.BufferGeometry | null = null
/** A broadleaf crown: five overlapping clumps inside the unit cone's box. */
export function broadleafGeo(): THREE.BufferGeometry {
  broadleaf ??= displace(
    mergeGeometries([ball(0.3, 0, 0.02, 0), ball(0.22, 0.2, -0.12, 0.06), ball(0.22, -0.18, -0.1, -0.1), ball(0.2, 0.04, -0.14, 0.22), ball(0.2, -0.04, 0.24, -0.04)])!,
    0.06,
  ).scale(1.25, 1, 1.25)
  return broadleaf
}

let conifer: THREE.BufferGeometry | null = null
/** A conifer: three stacked, ragged tiers. */
export function coniferGeo(): THREE.BufferGeometry {
  conifer ??= displace(
    mergeGeometries([
      new THREE.ConeGeometry(0.5, 0.55, 24, 4).translate(0, -0.22, 0),
      new THREE.ConeGeometry(0.4, 0.5, 24, 4).translate(0, 0.06, 0),
      new THREE.ConeGeometry(0.28, 0.42, 24, 4).translate(0, 0.29, 0),
    ])!,
    0.05,
  )
  return conifer
}

let bush: THREE.BufferGeometry | null = null
/** A bush: three clumps in the unit sphere's box. */
export function bushGeo(): THREE.BufferGeometry {
  bush ??= displace(mergeGeometries([ball(0.36, 0, 0, 0), ball(0.26, 0.2, -0.06, 0.08), ball(0.24, -0.18, -0.08, -0.06)])!, 0.05)
  return bush
}

let trunk: THREE.BufferGeometry | null = null
/** A tapered trunk with a flared foot (unit cylinder box). */
export function trunkGeo(): THREE.BufferGeometry {
  trunk ??= new THREE.CylinderGeometry(0.32, 0.5, 1, 12, 1)
  return trunk
}
