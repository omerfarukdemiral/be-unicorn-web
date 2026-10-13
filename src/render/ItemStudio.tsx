// Dev-only photo studio for the shop (?studio=items&size=…&page=…): every furniture item in its own transparent
// canvas, from the office camera's isometric direction, fitted to its own bounds. scripts/shoot-items.mjs writes the
// shots to public/items/{id}@1x.png / @2x.png (T11); the shop draws a locked item as the same PNG in silhouette (CSS).
import { Canvas, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { NeutralToneMapping } from 'three'
import { FURNITURE } from '../content/furniture'
import type { StageBand } from '../content/stageBand'
import { CAMERA_DIR } from './constants'
import { FurnitureModel } from './Furniture'
import { resolveFurniture } from './furnitureCatalog'

/** Ids in shop order (the catalog's). */
export const ITEM_IDS: readonly string[] = FURNITURE.map((f) => f.id)
export const ITEM_SIZES = [128, 256] as const
/** A browser keeps ~16 WebGL contexts: the 30 items are shot in pages of this many. */
export const ITEM_PAGE = 12

/**
 * As placed against the back wall: an item's back (wall side) is −z at rotation 0, the far side from the office camera,
 * so screens, seats and stages already face it, and a room's back wall stays behind its contents.
 */
const YAW = 0
/** Empty share kept round the item's projected bounds. */
const PAD = 0.1

const dir = new THREE.Vector3(...CAMERA_DIR).normalize()

/** Points the orthographic camera along the office direction and zooms it onto the item's projected bounds. */
function Fit({ target }: { target: React.RefObject<THREE.Group | null> }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    const g = target.current
    if (!g) return
    g.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(g)
    const center = box.getCenter(new THREE.Vector3())
    camera.position.copy(center).addScaledVector(dir, 20)
    camera.lookAt(center)
    camera.updateMatrixWorld()
    const inv = camera.matrixWorldInverse
    let w = 0
    let h = 0
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = new THREE.Vector3(x, y, z).applyMatrix4(inv)
          w = Math.max(w, Math.abs(p.x))
          h = Math.max(h, Math.abs(p.y))
        }
    camera.zoom = (Math.min(size.width, size.height) / 2 / Math.max(w, h)) * (1 - PAD)
    camera.updateProjectionMatrix()
  }, [camera, size, target])
  return null
}

function Shot({ id, size, band }: { id: string; size: number; band: StageBand }) {
  const g = useRef<THREE.Group>(null)
  const resolved = resolveFurniture(id, 'desk', band)
  return (
    <div data-item={id} style={{ width: size, height: size }}>
      <Canvas
        orthographic
        dpr={1}
        shadows
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping
          gl.setClearColor(0x000000, 0)
        }}
        camera={{ position: [10, 10, 10], zoom: 50, near: 0.1, far: 100 }}
        style={{ width: size, height: size }}
      >
        <hemisphereLight args={['#fff4e4', '#e6d2b8', 1.35]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[-3, 6, 4]} intensity={1.6} color="#fff0dc" />
        <group ref={g} rotation={[0, YAW, 0]}>
          <FurnitureModel resolved={resolved} span={resolved.size === 2} />
        </group>
        <Fit target={g} />
      </Canvas>
    </div>
  )
}

/** `band` (dev, ?band=0..3) shows the items as a bigger company's office would; the shop shots are band 1 (the default). */
export function ItemStudio({ size = ITEM_SIZES[0], page = 0, band = 1 }: { size?: number; page?: number; band?: StageBand }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16, background: 'transparent' }}>
      {ITEM_IDS.slice(page * ITEM_PAGE, (page + 1) * ITEM_PAGE).map((id) => (
        <Shot key={id} id={id} size={size} band={band} />
      ))}
    </div>
  )
}
