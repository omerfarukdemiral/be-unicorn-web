// State access for render components. Reads the zustand store (src/store/gameStore.ts),
// unless a mock GameState is provided via <RenderStateProvider> (previews / no engine yet).
import { createContext, useContext, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Action, ActionResult, GameState } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import type { UiState } from '../store/types'

const MockStateContext = createContext<GameState | null>(null)

export function RenderStateProvider(props: { state: GameState | null | undefined; children: ReactNode }) {
  return <MockStateContext.Provider value={props.state ?? null}>{props.children}</MockStateContext.Provider>
}

export function useMockState(): GameState | null {
  return useContext(MockStateContext)
}

/** Select from GameState. Selector results are shallow-compared (arrays/objects OK). */
export function useGS<T>(selector: (s: GameState) => T): T {
  const mock = useContext(MockStateContext)
  const live = useGameStore(useShallow((s) => selector(s.state)))
  return mock ? selector(mock) : live
}

/** Select from the UI slice of the store. */
export function useUi<T>(selector: (u: UiState) => T): T {
  return useGameStore(useShallow((s) => selector(s.ui)))
}

/** Non-reactive snapshot (inside event handlers / useFrame). */
export function getGS(mock: GameState | null): GameState {
  return mock ?? useGameStore.getState().state
}

export function dispatchAction(action: Action): ActionResult {
  return useGameStore.getState().dispatch(action)
}

export function storeApi() {
  return useGameStore.getState()
}
