// Office edit mode entry (grid step 3, owner decision): PC only. A phone, a tablet or any touch-first screen gets no
// entry at all: no button in the view controls (top bar or the phone's more menu), the O key does nothing.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UI_TEXT } from '../content'
import { applyAction, createGame } from '../engine'
import { buildOffice } from '../engine/office'
import type { GameState } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { ViewControls } from './layout/ViewControls'
import { FINE_POINTER_QUERY, layoutEditAllowed, readPointerEnv, tryBeginLayoutEdit } from './layoutEditGate'
import { MOBILE_QUERY } from './hooks'
import { LAYOUT_KEY, layoutEditKey } from './shortcuts'

/** A window whose media queries answer like the given device. */
function device(kind: 'pc' | 'phone' | 'tablet' | 'touchLaptop') {
  const answers: Record<string, boolean> = {
    pc: { [MOBILE_QUERY]: false, [FINE_POINTER_QUERY]: true },
    phone: { [MOBILE_QUERY]: true, [FINE_POINTER_QUERY]: false },
    // iPad landscape: wide, but the primary pointer is a finger.
    tablet: { [MOBILE_QUERY]: false, [FINE_POINTER_QUERY]: false },
    touchLaptop: { [MOBILE_QUERY]: false, [FINE_POINTER_QUERY]: false },
  }[kind]
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({ matches: answers[q] ?? false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  })
}

const LABEL = UI_TEXT['layout.openTitle']!
const store = () => useGameStore.getState()

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({ key: k, code: k === ' ' ? 'Space' : `Key${k.toUpperCase()}`, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, preventDefault() {}, ...mods })

beforeEach(() => {
  store().newGame({ seed: 3, founderXp: 0, runIndex: 0 })
  let s: GameState = { ...createGame({ seed: 3 }), stage: 1, office: buildOffice(1, 2) }
  s = { ...s, stats: { ...s.stats, cash: 1e9 } }
  for (const id of ['r1-s0', 'r1-s1']) s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: id }).state
  useGameStore.setState({ state: s })
})
afterEach(() => vi.unstubAllGlobals())

describe('edit mode gate', () => {
  it('PC only: a fine pointer on the wide layout', () => {
    expect(layoutEditAllowed({ mobile: false, fine: true })).toBe(true)
    expect(layoutEditAllowed({ mobile: true, fine: false })).toBe(false)
    expect(layoutEditAllowed({ mobile: true, fine: true })).toBe(false)
    expect(layoutEditAllowed({ mobile: false, fine: false })).toBe(false)
    // No window (server render): no entry.
    expect(layoutEditAllowed(readPointerEnv())).toBe(false)
  })

  it.each(['phone', 'tablet', 'touchLaptop'] as const)('%s: no edit button in the view controls, O does nothing', (kind) => {
    device(kind)
    expect(renderToStaticMarkup(createElement(ViewControls, { size: 44, showZoom: true }))).not.toContain(LABEL)
    expect(tryBeginLayoutEdit()).toBe(false)
    expect(store().ui.layoutEdit).toBeNull()
    expect(store().ui.pauseReasons).toEqual([])
  })

  it('PC: the button is there and O opens the edit mode', () => {
    device('pc')
    expect(renderToStaticMarkup(createElement(ViewControls, { size: 36, showZoom: true }))).toContain(LABEL)
    expect(LAYOUT_KEY).toBe('o')
    expect(tryBeginLayoutEdit()).toBe(true)
    expect(store().ui.layoutEdit).not.toBeNull()
  })
})

describe('edit mode keys', () => {
  beforeEach(() => {
    device('pc')
    tryBeginLayoutEdit()
  })

  it('outside the edit mode the keys are not its own', () => {
    store().cancelLayoutEdit()
    expect(layoutEditKey(key('r'))).toBe(false)
  })

  it('Ctrl/Cmd+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo, R turns, 1–5 label the desk', () => {
    store().layoutEditOp({ kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    const moved = store().ui.layoutEdit!.draft
    expect(layoutEditKey(key('z', { ctrlKey: true }))).toBe(true)
    expect(store().ui.layoutEdit!.draft.slots).toEqual({})
    expect(layoutEditKey(key('z', { metaKey: true, shiftKey: true }))).toBe(true)
    expect(store().ui.layoutEdit!.draft).toBe(moved)
    layoutEditKey(key('z', { metaKey: true }))
    layoutEditKey(key('y', { ctrlKey: true }))
    expect(store().ui.layoutEdit!.draft).toBe(moved)
    layoutEditKey(key('r'))
    expect(store().ui.layoutEdit!.draft.slots['r1-s0']!.r).not.toBe(moved.slots['r1-s0']!.r)
    layoutEditKey(key('4'))
    expect(store().ui.layoutEdit!.draft.slots['r1-s0']!.team).toBe('sales')
    // Speed and panel keys are swallowed: time stays held, no panel opens over the draft.
    expect(layoutEditKey(key('3'))).toBe(true)
    expect(layoutEditKey(key('b'))).toBe(true)
    expect(store().ui.panel).toEqual({ kind: 'layout' })
    // Browser combos stay the browser's.
    expect(layoutEditKey(key('r', { metaKey: true }))).toBe(false)
  })

  it('Esc: the selection, then one armed press with changes, then Vazgeç; Enter is Bitti', () => {
    store().layoutEditOp({ kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    layoutEditKey(key('Escape'))
    expect(store().ui.layoutEdit!.selected).toBeNull()
    layoutEditKey(key('Escape'))
    expect(store().ui.layoutEdit!.armedCancel).toBe(true)
    layoutEditKey(key('Escape'))
    expect(store().ui.layoutEdit).toBeNull()
    expect(store().state.office.slots.find((s) => s.id === 'r1-s0')!.itemId).toBe('desk-basic')

    tryBeginLayoutEdit()
    store().layoutEditOp({ kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    layoutEditKey(key('Enter'))
    expect(store().ui.layoutEdit).toBeNull()
    expect(store().state.office.slots.find((s) => s.id === 'r1-s0')!.itemId).toBeUndefined()
  })
})
