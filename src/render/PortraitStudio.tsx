// Dev-only photo studio (?studio=portraits): every portrait id in its own transparent canvas, shot by
// scripts/shoot-portraits.mjs into public/portraits. Same CharacterModel, materials and tone mapping as the scene, a
// 3/4 head-and-shoulders view with a warm key light, so a portrait reads as the person walking in the office.
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { NeutralToneMapping } from 'three'
import { CharacterModel } from './CharacterModel'
import { PORTRAIT_IDS, PORTRAIT_SIZES, portraitLook, type PortraitId } from './portraits'

/**
 * Bust framing from above, ~28° like the scene's camera (the headphone band reads as a band, not a halo round the
 * face), a little to the right for a 3/4 face.
 */
const LOOK_AT: [number, number, number] = [0, 0.83, 0]
const CAM_POS: [number, number, number] = [0.7, 2.05, 2.45]
const FOV = 12.5

function Aim() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.lookAt(...LOOK_AT)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function Shot({ id, size }: { id: PortraitId; size: number }) {
  const look = portraitLook(id)
  // Founder is 6% taller in the scene: framed on the same body proportions here.
  const s = 1 / (look.scale ?? 1)
  return (
    <div data-portrait={id} style={{ width: size, height: size }}>
      <Canvas
        dpr={1}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping
          gl.setClearColor(0x000000, 0)
        }}
        camera={{ position: CAM_POS, fov: FOV, near: 0.1, far: 20 }}
        style={{ width: size, height: size }}
      >
        <Aim />
        <hemisphereLight args={['#fff4e4', '#e6d2b8', 1.5]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[2.5, 3, 3]} intensity={1.7} color="#fff0dc" />
        <directionalLight position={[-2, 1.5, -1.5]} intensity={0.5} color="#e9e4ff" />
        <group scale={s} rotation={[0, 0.12, 0]}>
          <CharacterModel look={look} />
        </group>
      </Canvas>
    </div>
  )
}

/** One size per page load (`&size=`): a browser keeps ~16 WebGL contexts, the set has 14 ids. */
export function PortraitStudio({ size = PORTRAIT_SIZES[0] }: { size?: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16, background: 'transparent' }}>
      {PORTRAIT_IDS.map((id) => (
        <Shot key={id} id={id} size={size} />
      ))}
    </div>
  )
}
