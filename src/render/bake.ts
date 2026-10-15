// Draw-call batching for the procedural models. Furniture, walls and people are built from dozens of tiny primitive
// meshes (one draw call each, twice with the shadow pass). bakeStatic merges every plain-coloured part under a root
// into one vertex-coloured mesh; bakeSkinned does the same for a rigged person, binding each part rigidly to its rig
// group (a SkinnedMesh whose "bones" are those groups), so the walk/sit animation keeps working on one draw call.
// The source meshes stay in the tree, hidden: React still owns them, and the cleanup shows them again.
import { useLayoutEffect, type DependencyList, type RefObject } from 'react'
import * as THREE from 'three'
import { BAKE_KIND } from './resources'

export type ShadowMode = 'keep' | 'all' | 'none'

export interface BakeOptions {
  /** 'keep': a caster bucket and a non-caster bucket; 'all': one mesh casts; 'none': nothing casts. */
  shadow?: ShadowMode
  /** Merge glass panes too (one transparent mesh per glass material, never casting). */
  glass?: boolean
  /** Name for the dev bake counter (bakeStats.byTag). */
  tag?: string
}

/** Dev counter: how many bakes ran, per tag (QA: a hire must not rebake the office shell). */
export const bakeStats = { count: 0, byTag: {} as Record<string, number> }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __bakes: typeof bakeStats }).__bakes = bakeStats

interface Part {
  mesh: THREE.Mesh
  /** Part transform in its bone's frame (root frame for a static bake). */
  matrix: THREE.Matrix4
  bone: number
}

interface Bucket {
  key: string
  /** null: vertex colours on the shared baked material. */
  material: THREE.Material | null
  cast: boolean
  receive: boolean
  parts: Part[]
}

const BAKED = 'baked'

/** The shared material of every vertex-coloured bake: mat() with the colour moved into the vertices. */
let bakedMaterial: THREE.MeshStandardMaterial | null = null
export function bakedMat(): THREE.MeshStandardMaterial {
  bakedMaterial ??= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 })
  return bakedMaterial
}

/** Mesh that a bake may take: a plain Mesh with one bakeable material, drawn normally. */
function bakeable(o: THREE.Object3D, glass: boolean): o is THREE.Mesh {
  if (!(o as THREE.Mesh).isMesh) return false
  const m = o as THREE.Mesh
  if ((m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return false
  if (m.userData[BAKED] || m.renderOrder !== 0 || Array.isArray(m.material)) return false
  if (m.morphTargetInfluences?.length) return false
  const kind = BAKE_KIND.get(m.material as THREE.Material)
  return kind === 'glass' ? glass : !!kind
}

/** Collects the visible bakeable parts under root, each in the frame of its nearest bone (root is bone 0). */
export function collectParts(root: THREE.Object3D, bones: readonly THREE.Object3D[] = [root], glass = false): Part[] {
  const out: Part[] = []
  const boneIndex = new Map<THREE.Object3D, number>(bones.map((b, i) => [b, i]))
  const visit = (o: THREE.Object3D, toBone: THREE.Matrix4, bone: number) => {
    if (o !== root && (!o.visible || o.userData.noBake || o.userData[BAKED])) return
    let m = toBone
    let b = bone
    if (o !== root) {
      o.updateMatrix()
      const i = boneIndex.get(o)
      if (i !== undefined) {
        m = new THREE.Matrix4()
        b = i
      } else m = toBone.clone().multiply(o.matrix)
    }
    if (o !== root && bakeable(o, glass)) out.push({ mesh: o, matrix: m, bone: b })
    for (const c of o.children) visit(c, m, b)
  }
  visit(root, new THREE.Matrix4(), boneIndex.get(root) ?? 0)
  return out
}

/** Groups parts into draw calls: vertex-coloured parts share one, a glow material keeps its own. */
export function bucketParts(parts: readonly Part[], shadow: ShadowMode = 'keep'): Bucket[] {
  const map = new Map<string, Bucket>()
  for (const p of parts) {
    const material = p.mesh.material as THREE.Material
    const kind = BAKE_KIND.get(material)
    // Glass never casts (a pane's shadow would be a solid slab).
    const cast = kind === 'glass' ? false : shadow === 'all' ? true : shadow === 'none' ? false : p.mesh.castShadow
    const receive = kind === 'glass' ? false : p.mesh.receiveShadow
    const own = kind === 'same' || kind === 'glass' ? material : null
    const key = `${own ? own.uuid : 'vc'}|${cast ? 1 : 0}|${receive ? 1 : 0}`
    let b = map.get(key)
    if (!b) {
      b = { key, material: own, cast, receive, parts: [] }
      map.set(key, b)
    }
    b.parts.push(p)
  }
  return [...map.values()]
}

const v = new THREE.Vector3()
const n = new THREE.Vector3()
const nm = new THREE.Matrix3()

/** One non-indexed geometry for a bucket: positions, normals, colours (vertex-colour buckets), skin attributes. */
export function mergeBucket(b: Bucket, skinned: boolean): THREE.BufferGeometry {
  let count = 0
  for (const p of b.parts) {
    const g = p.mesh.geometry
    count += g.index ? g.index.count : g.getAttribute('position').count
  }
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  const col = b.material ? null : new Float32Array(count * 3)
  const skinIndex = skinned ? new Uint16Array(count * 4) : null
  const skinWeight = skinned ? new Float32Array(count * 4) : null
  let k = 0
  for (const p of b.parts) {
    const g = p.mesh.geometry
    const P = g.getAttribute('position')
    const N = g.getAttribute('normal')
    const idx = g.index
    const tris = (idx ? idx.count : P.count) / 3
    nm.getNormalMatrix(p.matrix)
    // A mirrored part flips its winding: swap two corners so front faces stay front faces.
    const flip = p.matrix.determinant() < 0
    const c = (p.mesh.material as THREE.MeshStandardMaterial).color
    for (let t = 0; t < tris; t++) {
      for (let j = 0; j < 3; j++) {
        const corner = flip && j > 0 ? 3 - j : j
        const s = idx ? idx.getX(t * 3 + corner) : t * 3 + corner
        v.fromBufferAttribute(P, s).applyMatrix4(p.matrix)
        pos[k * 3] = v.x
        pos[k * 3 + 1] = v.y
        pos[k * 3 + 2] = v.z
        if (N) {
          n.fromBufferAttribute(N, s).applyMatrix3(nm).normalize()
          nor[k * 3] = n.x
          nor[k * 3 + 1] = n.y
          nor[k * 3 + 2] = n.z
        }
        if (col) {
          col[k * 3] = c.r
          col[k * 3 + 1] = c.g
          col[k * 3 + 2] = c.b
        }
        if (skinIndex && skinWeight) {
          skinIndex[k * 4] = p.bone
          skinWeight[k * 4] = 1
        }
        k++
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  if (skinIndex && skinWeight) {
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4))
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))
  }
  return geo
}

function finish(root: THREE.Object3D, parts: readonly Part[], meshes: THREE.Mesh[]): () => void {
  for (const p of parts) p.mesh.visible = false
  for (const m of meshes) {
    m.userData[BAKED] = true
    root.add(m)
  }
  return () => {
    for (const m of meshes) {
      root.remove(m)
      m.geometry.dispose()
    }
    for (const p of parts) p.mesh.visible = true
  }
}

/**
 * Merges the static plain-coloured parts under `root` (which must not move relative to them) into one mesh per
 * material bucket, added under root. Returns the undo (dispose the merge, show the parts again).
 */
export function bakeStatic(root: THREE.Object3D, { shadow = 'keep', glass = false, tag }: BakeOptions = {}): () => void {
  bakeStats.count++
  if (tag) bakeStats.byTag[tag] = (bakeStats.byTag[tag] ?? 0) + 1
  const parts = collectParts(root, [root], glass)
  if (parts.length < 2) return () => {}
  const meshes = bucketParts(parts, shadow).map((b) => {
    const m = new THREE.Mesh(mergeBucket(b, false), b.material ?? bakedMat())
    m.castShadow = b.cast
    m.receiveShadow = b.receive
    m.geometry.computeBoundingSphere()
    m.raycast = () => {}
    return m
  })
  return finish(root, parts, meshes)
}

const IDENTITY = new THREE.Matrix4()

/**
 * Merges a rigged model into skinned meshes: each part rides on its nearest bone (`bones[0]` should be root). The
 * bones are the existing animated groups, so whatever moves them moves the merged mesh.
 */
export function bakeSkinned(root: THREE.Object3D, bones: readonly THREE.Object3D[], { shadow = 'keep' }: BakeOptions = {}): () => void {
  const parts = collectParts(root, bones)
  if (parts.length < 2) return () => {}
  const skeletons: THREE.Skeleton[] = []
  const meshes = bucketParts(parts, shadow).map((b) => {
    const m = new THREE.SkinnedMesh(mergeBucket(b, true), b.material ?? bakedMat())
    // Vertices sit in their bone's own frame: identity bind and inverse bind matrices, so the skinned position is
    // bone.matrixWorld · vertex. Rig groups are plain Object3Ds; the skeleton only reads their matrixWorld.
    const skeleton = new THREE.Skeleton(bones as THREE.Bone[], bones.map(() => new THREE.Matrix4()))
    skeletons.push(skeleton)
    m.bind(skeleton, IDENTITY)
    m.castShadow = b.cast
    m.receiveShadow = b.receive
    // The bounds of bone-local vertices mean nothing: never cull a person (they are small and few).
    m.frustumCulled = false
    m.raycast = () => {}
    return m
  })
  const undo = finish(root, parts, meshes)
  // Each skeleton may own a bone texture: free it with the merge, or every rebake (hire, leave, look) leaks one.
  return () => {
    undo()
    for (const sk of skeletons) sk.dispose()
  }
}

/**
 * Bakes the subtree under `ref` after every commit that changes `deps` (which must cover everything the children
 * draw from). Children's layout effects run first, so the parts are in place. `enabled` false leaves it unbaked.
 */
export function useBake(ref: RefObject<THREE.Object3D | null>, deps: DependencyList, opts: BakeOptions & { enabled?: boolean } = {}): void {
  const { shadow, glass, tag, enabled = true } = opts
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !enabled) return
    return bakeStatic(root, { shadow, glass, tag })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, enabled, shadow, glass, ...deps])
}
