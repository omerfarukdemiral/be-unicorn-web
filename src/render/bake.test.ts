import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bakeSkinned, bakeStatic, bakedMat, bucketParts, collectParts } from './bake'
import { GEO, flatMat, glowMat, mat } from './resources'

function part(color: string, pos: [number, number, number], cast = true): THREE.Mesh {
  const m = new THREE.Mesh(GEO.box, mat(color))
  m.position.set(...pos)
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

describe('bakeStatic', () => {
  it('merges plain-coloured parts into one vertex-coloured mesh, hides them, and undoes cleanly', () => {
    const root = new THREE.Group()
    const a = part('#ff0000', [0, 0, 0])
    const b = part('#00ff00', [2, 0, 0])
    root.add(a, b)
    const undo = bakeStatic(root, { shadow: 'all' })
    const baked = root.children.filter((c) => c !== a && c !== b) as THREE.Mesh[]
    expect(baked).toHaveLength(1)
    expect(baked[0]!.material).toBe(bakedMat())
    expect(baked[0]!.castShadow).toBe(true)
    expect(a.visible).toBe(false)
    expect(b.visible).toBe(false)
    // box = 12 triangles = 36 corners per part
    const geo = baked[0]!.geometry
    expect(geo.getAttribute('position').count).toBe(72)
    // colours come from the (linear) material colour; second part is offset by its transform
    const col = geo.getAttribute('color')
    expect(col.getX(0)).toBeCloseTo(mat('#ff0000').color.r)
    expect(col.getY(36)).toBeCloseTo(mat('#00ff00').color.g)
    let maxX = -Infinity
    for (let i = 36; i < 72; i++) maxX = Math.max(maxX, geo.getAttribute('position').getX(i))
    expect(maxX).toBeCloseTo(2.5)
    undo()
    expect(root.children).toEqual([a, b])
    expect(a.visible && b.visible).toBe(true)
  })

  it('keeps glow parts in their own bucket, splits casters in keep mode, and skips hidden or foreign parts', () => {
    const root = new THREE.Group()
    const hiddenGroup = new THREE.Group()
    hiddenGroup.visible = false
    hiddenGroup.add(part('#123456', [0, 1, 0]))
    const skip = new THREE.Group()
    skip.userData.noBake = true
    skip.add(part('#123456', [0, 2, 0]))
    const glass = new THREE.Mesh(GEO.box, flatMat('#ffffff', 0.5))
    root.add(part('#111111', [0, 0, 0]), part('#222222', [1, 0, 0], false), new THREE.Mesh(GEO.box, glowMat('#ffee00')), hiddenGroup, skip, glass)
    const parts = collectParts(root)
    expect(parts).toHaveLength(3)
    const buckets = bucketParts(parts, 'keep')
    expect(buckets).toHaveLength(3)
    expect(buckets.filter((b) => b.material === null).map((b) => b.cast).sort()).toEqual([false, true])
    expect(bucketParts(parts, 'all')).toHaveLength(2)
  })

  it('flips the winding of mirrored parts so they stay front-facing', () => {
    const root = new THREE.Group()
    const a = part('#ff0000', [0, 0, 0])
    const b = part('#ff0000', [0, 0, 0])
    b.scale.set(-1, 1, 1)
    root.add(a, b)
    bakeStatic(root)
    const geo = (root.children.at(-1) as THREE.Mesh).geometry
    const P = geo.getAttribute('position')
    const normalOf = (t: number) => {
      const [p0, p1, p2] = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(P, t * 3 + j))
      return p1!.sub(p0!).cross(p2!.sub(p0!)).normalize()
    }
    // the mirrored box's first triangle faces the same way as the original's (the +x face becomes the −x face,
    // so its outward normal must point to −x)
    expect(normalOf(0).x).toBeCloseTo(1)
    expect(normalOf(12).x).toBeCloseTo(-1)
  })
})

describe('bakeSkinned', () => {
  it('binds every part to its nearest bone and follows the bone when it moves', () => {
    const root = new THREE.Group()
    const arm = new THREE.Group()
    arm.position.set(1, 0, 0)
    arm.add(part('#ff0000', [0, -0.5, 0]))
    root.add(part('#00ff00', [0, 0, 0]), arm)
    bakeSkinned(root, [root, arm], { shadow: 'all' })
    const skinned = root.children.find((c) => (c as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh
    expect(skinned).toBeTruthy()
    const idx = skinned.geometry.getAttribute('skinIndex')
    expect(idx.getX(0)).toBe(0)
    expect(idx.getX(36)).toBe(1)
    // arm part vertices are in the arm's own frame (not offset by the arm's position)
    const P = skinned.geometry.getAttribute('position')
    for (let i = 36; i < 72; i++) {
      expect(Math.abs(P.getX(i))).toBeLessThanOrEqual(0.5 + 1e-6)
      expect(P.getY(i)).toBeLessThanOrEqual(1e-6)
    }
    arm.rotation.z = Math.PI / 2
    root.updateMatrixWorld(true)
    const v = new THREE.Vector3()
    skinned.skeleton.update()
    skinned.getVertexPosition(36, v)
    v.applyMatrix4(skinned.matrixWorld)
    const expected = new THREE.Vector3().fromBufferAttribute(skinned.geometry.getAttribute('position'), 36).applyMatrix4(arm.matrixWorld)
    expect(v.distanceTo(expected)).toBeLessThan(1e-5)
  })
})
