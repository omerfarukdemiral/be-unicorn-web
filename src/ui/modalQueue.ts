// At most one blocking overlay (store.ui.overlay). Extra requests wait in this UI-local queue.
import { create } from 'zustand'
import { useGameStore } from '../store/gameStore'
import type { Overlay } from '../store/types'

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

/** Opens now if nothing blocks, otherwise queues. `urgent` replaces a settings overlay. */
export function requestOverlay(o: Overlay): void {
  const { ui, openOverlay } = useGameStore.getState()
  const cur = ui.overlay
  if (!cur || (cur.kind === 'settings' && o.kind !== 'settings')) {
    openOverlay(o)
    return
  }
  if (sameOverlay(cur, o)) return
  useModalQueue.getState().push(o)
}
