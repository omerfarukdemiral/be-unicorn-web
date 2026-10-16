// F5: a throwing engine step never freezes or kills the run; three in a row pause the world.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './gameStore'
import { MAX_TICK_ERRORS, runFrame } from './loop'
import { readExitNote } from './session'

function memStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('loop: runFrame', () => {
  const realTick = useGameStore.getState().tick
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', memStorage())
    vi.stubGlobal('localStorage', memStorage())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useGameStore.getState().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    useGameStore.getState().dispatch({ type: 'setSpeed', speed: 4 })
  })
  afterEach(() => {
    useGameStore.setState({ tick: realTick })
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('a throwing tick is caught and noted; the speed holds until the limit, then the world pauses', () => {
    useGameStore.setState({
      tick: () => {
        throw new Error('step blew up')
      },
    })
    for (let i = 1; i < MAX_TICK_ERRORS; i++) {
      expect(() => runFrame(0.1, 0)).not.toThrow()
      expect(useGameStore.getState().state.time.speed).toBe(4)
    }
    expect(readExitNote()?.err).toContain('step blew up')
    runFrame(0.1, 0)
    expect(useGameStore.getState().state.time.speed).toBe(0)
  })

  it('a good tick in between resets the count', () => {
    let fail = true
    useGameStore.setState({
      tick: () => {
        if (fail) throw new Error('flaky')
      },
    })
    for (let i = 0; i < 5; i++) {
      fail = i % 2 === 0
      runFrame(0.1, 0)
    }
    expect(useGameStore.getState().state.time.speed).toBe(4)
  })

  it('the autosave refreshes the run mark (a reload resumes this run)', () => {
    runFrame(0.1, 1e9)
    expect(sessionStorage.getItem('be-unicorn:on-screen')).not.toBeNull()
  })
})
