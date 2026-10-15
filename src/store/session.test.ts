// F5: a reload under a running game resumes it; deliberate exits and game over still land on the start card.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function memStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

async function fresh() {
  vi.resetModules()
  return import('./session')
}

describe('run mark + auto-resume', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', memStorage())
    vi.stubGlobal('localStorage', memStorage())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('a run on screen resumes after a reload; no mark, no resume', async () => {
    const s = await fresh()
    const load = vi.fn(() => true)
    expect(s.resumeAfterReload(load)).toBe(false)
    expect(load).not.toHaveBeenCalled()
    s.markRunOnScreen(765.4)
    expect(s.readRunMark()?.day).toBe(765)
    expect(s.resumeAfterReload(load, 1000)).toBe(true)
    expect(load).toHaveBeenCalledOnce()
  })

  it('sign-in, sign-out and game over clear the mark: the start card shows', async () => {
    const s = await fresh()
    for (const by of ['signIn', 'signOut', 'gameOver']) {
      s.markRunOnScreen(10)
      s.clearRunOnScreen(by)
      expect(s.resumeAfterReload(() => true)).toBe(false)
      expect(s.classifyExit(s.readExitNote())).toBe('deliberate')
    }
  })

  it('no save to load (or one that throws) drops the mark', async () => {
    const s = await fresh()
    s.markRunOnScreen(10)
    expect(s.resumeAfterReload(() => false)).toBe(false)
    expect(s.readRunMark()).toBeNull()
    s.markRunOnScreen(10)
    expect(
      s.resumeAfterReload(() => {
        throw new Error('bad save')
      }),
    ).toBe(false)
    expect(s.readRunMark()).toBeNull()
  })

  it('a save that kills the page cannot loop: the third reload inside a minute shows the start card', async () => {
    const s = await fresh()
    s.markRunOnScreen(10)
    expect(s.resumeAfterReload(() => true, 1_000)).toBe(true)
    expect(s.resumeAfterReload(() => true, 20_000)).toBe(true)
    expect(s.resumeAfterReload(() => true, 40_000)).toBe(false)
    expect(s.readRunMark()).toBeNull()
    // Later on, a fresh run resumes again.
    s.markRunOnScreen(10)
    expect(s.resumeAfterReload(() => true, 40_000 + s.AUTO_RESUME_WINDOW_MS)).toBe(true)
  })

  it('blocked storage never throws', async () => {
    const boom = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    vi.stubGlobal('sessionStorage', boom)
    vi.stubGlobal('localStorage', boom)
    const s = await fresh()
    expect(() => s.markRunOnScreen(1)).not.toThrow()
    expect(() => s.clearRunOnScreen('signIn')).not.toThrow()
    expect(() => s.noteExit({ err: 'x' })).not.toThrow()
    expect(s.resumeAfterReload(() => true)).toBe(false)
    expect(s.previousExit.kind).toBeNull()
  })
})

describe('exit note', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', memStorage())
    vi.stubGlobal('localStorage', memStorage())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('classifies the previous exit: error > background > crash', async () => {
    const s = await fresh()
    expect(s.classifyExit(null)).toBeNull()
    s.startExitNote(700)
    expect(s.classifyExit(s.readExitNote())).toBe('crash')
    s.noteExit({ day: 765, hidden: true })
    expect(s.classifyExit(s.readExitNote())).toBe('background')
    s.noteExit({ glLost: 2 })
    expect(s.readExitNote()).toMatchObject({ day: 765, hidden: true, glLost: 2 })
    s.noteExit({ err: 'x'.repeat(500) })
    expect(s.classifyExit(s.readExitNote())).toBe('error')
    expect(s.readExitNote()!.err!.length).toBeLessThanOrEqual(160)
  })

  it('the next boot reads the previous note once, before the new session writes its own', async () => {
    let s = await fresh()
    s.startExitNote(765)
    s.noteExit({ hidden: true })
    s = await fresh()
    expect(s.previousExit.kind).toBe('background')
    expect(s.previousExit.note?.day).toBe(765)
    s.startExitNote(765)
    expect(s.previousExit.kind).toBe('background')
  })
})
