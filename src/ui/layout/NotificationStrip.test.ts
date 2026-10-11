import { describe, expect, it } from 'vitest'
import { stripShellShown } from './NotificationStrip'

const base = { visible: true, content: false, horizon: false, more: false, overlay: false }

describe('stripShellShown', () => {
  it('no message, no horizon, no history → no shell (QA: empty white pill / bare ⌃ row)', () => {
    expect(stripShellShown(base)).toBe(false)
  })
  it('a message or the horizon row keeps the shell', () => {
    expect(stripShellShown({ ...base, content: true })).toBe(true)
    expect(stripShellShown({ ...base, horizon: true })).toBe(true)
  })
  it('an empty slot hides even the horizon; the open history stays', () => {
    expect(stripShellShown({ ...base, visible: false, horizon: true })).toBe(false)
    expect(stripShellShown({ ...base, visible: false, more: true })).toBe(true)
  })
  it('a blocking modal (stage-up, move scene) hides everything', () => {
    expect(stripShellShown({ ...base, content: true, overlay: true })).toBe(false)
    expect(stripShellShown({ ...base, more: true, overlay: true })).toBe(false)
  })
})
