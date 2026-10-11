import { describe, expect, it } from 'vitest'
import { FURNITURE } from '../content/furniture'

describe('shop thumbnails (T11)', () => {
  it('every catalog item is shot at both scales (scripts/shoot-items.mjs)', () => {
    const shot = new Set(Object.keys(import.meta.glob('../../public/items/*.png')).map((k) => k.replace('../../public/items/', '')))
    for (const f of FURNITURE) for (const s of [1, 2]) expect(shot).toContain(`${f.id}@${s}x.png`)
  })
})
