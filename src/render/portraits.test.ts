import { describe, expect, it } from 'vitest'
import { DEPTS } from '../engine/types'
import { PORTRAIT_IDS, portraitLook, portraitPath } from './portraits'

describe('portrait set (T16)', () => {
  it('has the founder, every visitor role, the buyer and a face per dept', () => {
    expect(new Set(PORTRAIT_IDS).size).toBe(PORTRAIT_IDS.length)
    expect(PORTRAIT_IDS.length).toBeGreaterThanOrEqual(6)
    for (const id of ['founder', 'accountant', 'investor', 'buyer', 'team-eng'] as const) expect(PORTRAIT_IDS).toContain(id)
  })

  it('team faces wear their dept accessory (ops has none in the scene either)', () => {
    for (const d of DEPTS) if (d !== 'ops') expect(portraitLook(`team-${d}`).accessories.length).toBeGreaterThan(0)
  })

  it('every id is shot at both scales (scripts/shoot-portraits.mjs)', () => {
    const shot = new Set(Object.keys(import.meta.glob('../../public/portraits/*.png')).map((k) => k.replace('../../public', '')))
    for (const id of PORTRAIT_IDS) for (const s of [1, 2] as const) expect(shot).toContain(portraitPath(id, s))
  })
})
