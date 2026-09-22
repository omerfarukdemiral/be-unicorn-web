// Scaffold shell: full-screen 3D layer + UI layer on top.
// Integrate lane swaps the placeholder scene for <GameCanvas/> (render) and <GameUI/> (ui).
import { Canvas } from '@react-three/fiber'

function PlaceholderScene() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 4]} intensity={1.2} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#d9d4cc" flatShading />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.2, 0.8, 0.7]} />
        <meshStandardMaterial color="#c9a7f5" flatShading />
      </mesh>
    </>
  )
}

export default function App() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <Canvas
          shadows
          orthographic
          dpr={[1, 2]}
          camera={{ position: [10, 10, 10], zoom: 60, near: 0.1, far: 200 }}
        >
          <color attach="background" args={['#f6efe4']} />
          <PlaceholderScene />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute inset-0 safe-top safe-bottom safe-x">
        <div className="pointer-events-auto m-3 inline-flex items-center gap-2 rounded-[var(--radius-card)] bg-cream-50/90 px-4 py-2 shadow-sm">
          <span className="text-sm font-semibold tracking-tight">Be Unicorn</span>
          <span className="text-xs text-ink-600">Garaj</span>
        </div>
      </div>
    </div>
  )
}
