// At most one blocking overlay (store.ui.overlay: move scene, post-mortem, victory). Extra requests wait here.
// A center screen (statistics, Kanun Kitabı, Pazar haritası) never waits and never makes anything wait: a blocking
// modal simply takes its place.
import { create } from 'zustand'
import { blockingOverlay, useGameStore } from '../store/gameStore'
import { CENTER_KINDS, type Overlay } from '../store/types'

interface ModalQueue {
  queue: Overlay[]
  push(o: Overlay): void
  shift(): Overlay | undefined
  clear(): void
}

export const useModalQueue = create<ModalQueue>()((set, get) => ({
  queue: [],
  push: (o) => set((s) => (s.queue.some((q) => sameOverlay(q, o)) ? s : { queue: [...s.queue, o] })),
  shift() {
    const [head, ...rest] = get().queue
    set({ queue: rest })
    return head
  },
  clear: () => set({ queue: [] }),
}))

export function sameOverlay(a: Overlay, b: Overlay): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Opens now if nothing blocks (an open center screen gives way), otherwise queues (post-mortem after a move scene, etc.). */
export function requestOverlay(o: Overlay): void {
  const { ui, openOverlay } = useGameStore.getState()
  const cur = blockingOverlay(ui)
  if (!cur) {
    openOverlay(o)
    return
  }
  if (sameOverlay(cur, o) || CENTER_KINDS.has(o.kind)) return
  useModalQueue.getState().push(o)
}
