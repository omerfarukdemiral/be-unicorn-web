// Positions HTML content above a character's head (drei <Html>). Content is supplied by the caller.
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type * as THREE from 'three'
import { speakerPositions } from './sceneRegistry'

export interface BubbleAnchorProps {
  /** Employee id, visitor id or 'founder'. Falls back to the founder, then `fallback`. */
  speakerId: string
  /** Extra height above the head (world units), e.g. to stack icons. */
  offsetY?: number
  /** World XZ used when the speaker has no position yet. */
  fallback?: [number, number]
  /** Clickable content? (sets pointer-events). */
  interactive?: boolean
  children: ReactNode
}

export function BubbleAnchor({ speakerId, offsetY = 0, fallback = [0, 0], interactive = false, children }: BubbleAnchorProps) {
  const group = useRef<THREE.Group>(null)
  const inner = useRef<HTMLDivElement>(null)
  useFrame(() => {
    const p = speakerPositions.get(speakerId) ?? speakerPositions.get('founder')
    const g = group.current
    if (g) {
      if (p) g.position.set(p.x, p.y + 0.35 + offsetY, p.z)
      else g.position.set(fallback[0], 1.4 + offsetY, fallback[1])
    }
    const el = inner.current
    if (el) {
      const show = !p || p.visible
      const v = show ? 'visible' : 'hidden'
      if (el.style.visibility !== v) el.style.visibility = v
    }
  })
  return (
    <group ref={group}>
      <Html center zIndexRange={[30, 10]} pointerEvents={interactive ? 'auto' : 'none'}>
        <div ref={inner} style={{ transform: 'translateY(-50%)' }}>
          {children}
        </div>
      </Html>
    </group>
  )
}
