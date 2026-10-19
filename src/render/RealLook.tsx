// Realistic look, tier 1 (look.ts): a soft studio room as the image-based light, and the post pass (ambient
// occlusion, a little bloom on screens and lamps, tone mapping, vignette, SMAA). Full power only.
import { Bloom, BrightnessContrast, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { useThree } from '@react-three/fiber'
import { ToneMappingMode } from 'postprocessing'
import { useEffect } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/** Image-based light: reflections on steel and glass, soft fill on every shaded face (instead of a flat ambient). */
export function RoomLight({ intensity = 0.45 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = intensity
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, intensity])
  return null
}

/** AO radius in world units: a desk leg (0.04 cell) to the gap under a desk (1.5 m cell ≈ 0.5). */
const AO_RADIUS = 1.1

const AO_DEBUG = import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('aodebug')

export function RealPost() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO aoRadius={AO_RADIUS} distanceFalloff={1} intensity={2.4} quality="high" halfRes={false} color="#1d1712" renderMode={AO_DEBUG ? 1 : 0} />
      <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.15} intensity={0.5} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <BrightnessContrast brightness={0.02} contrast={0.05} />
      <Vignette offset={0.4} darkness={0.18} />
      <SMAA />
    </EffectComposer>
  )
}
