import { describe, expect, it } from 'vitest'
import { breakMode } from './Character'

describe('a break away from the desk (E3)', () => {
  it('goes to the lounge when there is a common area, else out of the door (a leave in a bare office)', () => {
    expect(breakMode(true)).toBe('lounge')
    expect(breakMode(false)).toBe('away')
  })
})
