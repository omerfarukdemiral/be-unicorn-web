// Round 6 (strategy freedom): the chip acts on small reversible moves and only points at big or irreversible ones.
import { afterEach, describe, expect, it } from 'vitest'
import { NEXT_MOVES, type Action, type NextMove, type NextStep } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { chipTarget, markChipTarget } from './chipTarget'
import { CONFIRM_MOVES, confirmPlace, followStep } from './loopUi'
import { onDeclined, pendingConfirm } from './chipConfirm'

const step = (move: NextMove): NextStep => ({ id: 'grow', index: 6, total: 6, move })

/** followStep with a dispatch that records what it was asked to do. */
function tap(move: NextMove): Action[] {
  const st = useGameStore.getState()
  const orig = st.dispatch
  const calls: Action[] = []
  useGameStore.setState({ dispatch: (a: Action) => (calls.push(a), orig(a)) })
  try {
    followStep(step(move))
  } finally {
    useGameStore.setState({ dispatch: orig })
  }
  return calls
}

afterEach(() => markChipTarget(null))

describe('chip move split', () => {
  it('big or irreversible moves only open their place: acquire, newProduct, openSegment, signLaw, serverRoom, openRing, cutBurn, hires', () => {
    expect([...CONFIRM_MOVES].sort()).toEqual(['acquire', 'cutBurn', 'hireEng', 'hireGrowth', 'hireMarketing', 'moraleLost', 'newProduct', 'openRing', 'openSegment', 'serverRoom', 'signLaw'])
    for (const m of CONFIRM_MOVES) {
      useGameStore.getState().newGame({ seed: 4, founderXp: 0, runIndex: 0 })
      expect(tap(m), m).toEqual([])
      const ui = useGameStore.getState().ui
      expect(ui.panel !== null || ui.overlay !== null, m).toBe(true)
    }
  })

  it('small reversible moves act on the tap', () => {
    const direct: NextMove[] = ['adsCut', 'focusUsers', 'focusTalk', 'salesCall', 'salesGrow', 'restFounder', 'easeLoad', 'refactor', 'morale', 'startRound', 'price', 'priceUp', 'ads', 'adsUp', 'adsTune']
    for (const m of direct) expect(CONFIRM_MOVES.has(m), m).toBe(false)
    useGameStore.getState().newGame({ seed: 4, founderXp: 0, runIndex: 0 })
    expect(tap('adsCut')).toEqual([{ type: 'setAdBudget', amount: 0 }])
    expect(tap('focusTalk')).toEqual([{ type: 'setFounderFocus', focus: 'talk' }])
    // Every move is one or the other (or a place of its own: the meeting, the round road).
    for (const m of NEXT_MOVES) expect(CONFIRM_MOVES.has(m) || direct.includes(m) || ['pitch', 'progress', 'growthAsk', 'module', 'keepStaff', 'hireGrowth'].includes(m), m).toBe(true)
  })

  it('a confirm move marks the engine pick in its place (a hire marks the candidate in Ekip)', () => {
    useGameStore.getState().newGame({ seed: 4, founderXp: 0, runIndex: 0 })
    const s = useGameStore.getState().state
    const place = confirmPlace(s, 'hireEng')
    expect(place.place).toEqual({ panel: { kind: 'team' } })
    tap('hireEng')
    expect(chipTarget()).toBe(place.key)
  })

  it('round 8: closing the place without confirming is heard as declined; confirming is not', () => {
    const heard: NextMove[] = []
    const off = onDeclined((m) => heard.push(m))
    try {
      useGameStore.getState().newGame({ seed: 4, founderXp: 0, runIndex: 0 })
      tap('newProduct')
      expect(pendingConfirm()?.move).toBe('newProduct')
      useGameStore.getState().closePanel()
      expect(heard).toEqual(['newProduct'])
      // Confirmed in the place: the watch ends, closing says nothing.
      tap('newProduct')
      const pick = confirmPlace(useGameStore.getState().state, 'newProduct').key?.split(':')[1]
      if (pick) {
        expect(useGameStore.getState().dispatch({ type: 'startProject', category: pick as never }).ok).toBe(true)
        useGameStore.getState().closePanel()
        expect(heard).toEqual(['newProduct'])
      }
    } finally {
      off()
    }
  })
})
