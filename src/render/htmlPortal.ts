// A fixed DOM target for drei <Html>. Without `portal`, <Html> appends to `events.connected ?? canvas.parentNode`,
// and R3F connects events only after the scene's first commit: every <Html> mounted in that commit then sees its
// target change, unmounts its React root during a commit ("synchronously unmount a root while React was already
// rendering") and re-creates it on the same element. The content of that first commit was lost (the first desk
// bubble never showed) and React later threw removeChild. Pinning the target to the canvas' parent avoids both.
import { useThree } from '@react-three/fiber'
import { useState, type RefObject } from 'react'

export function useHtmlPortal(): RefObject<HTMLElement> {
  const gl = useThree((s) => s.gl)
  const [ref] = useState(() => ({ current: (gl.domElement.parentNode as HTMLElement | null) ?? document.body }))
  return ref as RefObject<HTMLElement>
}
