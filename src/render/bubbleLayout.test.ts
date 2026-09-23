import { describe, expect, it } from 'vitest'
import { layoutBubbles, type BubbleBox, type Placement, type Viewport } from './bubbleLayout'

const VP: Viewport = { left: 8, top: 8, right: 1432, bottom: 892 }

const P = (dx: number, dy: number): Placement => ({ dx, dy, hidden: false, stem: 0, stemX: 0 })

const box = (key: string, kind: BubbleBox['kind'], left: number, top: number, w = 200, h = 50, speakerId = key): BubbleBox => ({ key, speakerId, kind, left, top, w, h })

type R = { l: number; t: number; r: number; b: number }
const rectOf = (b: BubbleBox, p: Placement): R => ({ l: b.left + p.dx, t: b.top + p.dy, r: b.left + p.dx + b.w, b: b.top + p.dy + b.h })
const hit = (a: R, b: R) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

function noOverlap(items: BubbleBox[], res: Map<string, Placement>): boolean {
  const vis = items.filter((b) => !res.get(b.key)!.hidden)
  for (let i = 0; i < vis.length; i++)
    for (let j = i + 1; j < vis.length; j++) if (hit(rectOf(vis[i]!, res.get(vis[i]!.key)!), rectOf(vis[j]!, res.get(vis[j]!.key)!))) return false
  return true
}

describe('layoutBubbles', () => {
  it('leaves separate bubbles where they are', () => {
    const items = [box('a', 'concept', 100, 300), box('b', 'ambient', 600, 300)]
    const res = layoutBubbles(items, VP)
    expect(res.get('a')).toMatchObject({ dx: 0, dy: 0, hidden: false })
    expect(res.get('b')).toMatchObject({ dx: 0, dy: 0, hidden: false })
  })

  it('lifts the lower-priority bubble above the higher one on overlap', () => {
    const items = [box('amb', 'ambient', 120, 320, 200, 40), box('con', 'concept', 100, 300, 220, 60)]
    // Ambient slightly overlapping near the top: small lift is enough.
    const small = [box('amb', 'ambient', 120, 280, 200, 30), box('con', 'concept', 100, 300, 220, 60)]
    const r1 = layoutBubbles(small, VP)
    expect(r1.get('con')).toMatchObject({ dx: 0, dy: 0, hidden: false })
    expect(r1.get('amb')!.hidden).toBe(false)
    expect(r1.get('amb')!.dy).toBeLessThan(0)
    expect(noOverlap(small, r1)).toBe(true)
    // Fully covered ambient would need a big lift → hidden instead.
    const r2 = layoutBubbles(items, VP)
    expect(r2.get('con')!.dy).toBe(0)
    expect(r2.get('amb')!.hidden).toBe(true)
  })

  it('never moves a decision for a concept; stacks clickable bubbles vertically', () => {
    const items = [box('con', 'concept', 100, 300, 220, 60), box('dec', 'decision', 110, 310, 220, 60), box('ico', 'conceptIcon', 150, 320, 44, 44)]
    const res = layoutBubbles(items, VP)
    expect(res.get('dec')).toMatchObject({ dx: 0, dy: 0, hidden: false })
    for (const k of ['con', 'ico']) expect(res.get(k)!.hidden).toBe(false)
    expect(res.get('con')!.dy).toBeLessThan(0)
    expect(res.get('ico')!.dy).toBeLessThan(res.get('con')!.dy)
    expect(noOverlap(items, res)).toBe(true)
  })

  it('pushes a clickable bubble down when there is no room above', () => {
    const items = [box('dec', 'decision', 100, 10, 220, 60), box('con', 'concept', 100, 20, 220, 60)]
    const res = layoutBubbles(items, VP)
    expect(res.get('con')!.hidden).toBe(false)
    expect(res.get('con')!.dy).toBeGreaterThan(0)
    expect(noOverlap(items, res)).toBe(true)
  })

  it('hides the ambient line of a speaker that has a clickable bubble', () => {
    const items = [box('con', 'concept', 100, 300, 200, 60, 'e1'), box('amb', 'ambient', 900, 300, 200, 40, 'e1')]
    const res = layoutBubbles(items, VP)
    expect(res.get('amb')!.hidden).toBe(true)
    expect(res.get('con')!.hidden).toBe(false)
  })

  it('clamps bubbles into the viewport and the area left of the side panel', () => {
    const vp: Viewport = { left: 8, top: 60, right: 1000, bottom: 892 }
    const items = [box('r', 'concept', 950, 300, 200, 50), box('l', 'decision', -80, 300, 200, 50), box('t', 'conceptIcon', 500, 20, 44, 44)]
    const res = layoutBubbles(items, vp)
    expect(950 + res.get('r')!.dx + 200).toBeLessThanOrEqual(1000)
    expect(-80 + res.get('l')!.dx).toBeGreaterThanOrEqual(8)
    expect(20 + res.get('t')!.dy).toBeGreaterThanOrEqual(60)
  })

  it('hides ambient lines whose speaker is outside the free area (behind the panel)', () => {
    const vp: Viewport = { left: 8, top: 8, right: 1000, bottom: 892 }
    const res = layoutBubbles([box('amb', 'ambient', 1100, 300, 200, 40)], vp)
    expect(res.get('amb')!.hidden).toBe(true)
  })

  it('fits a mobile screen (390px): wide bubbles are left-aligned inside', () => {
    const vp: Viewport = { left: 8, top: 120, right: 382, bottom: 500 }
    const items = [box('d', 'decision', 250, 300, 234, 64), box('a', 'ambient', 200, 290, 200, 30)]
    const res = layoutBubbles(items, vp)
    const d = res.get('d')!
    expect(250 + d.dx).toBeGreaterThanOrEqual(8)
    expect(250 + d.dx + 234).toBeLessThanOrEqual(382)
    // The ambient line is lifted just clear of the decision (new line: gap 6 + show pad 10).
    const a = res.get('a')!
    expect(a.hidden).toBe(false)
    expect(290 + a.dy + 30).toBeLessThanOrEqual(300 - 16)
    expect(a.dy).toBeGreaterThanOrEqual(-56)
    expect(noOverlap(items, res)).toBe(true)
  })

  it('is stable: small movements keep the previous slot (hysteresis)', () => {
    const at = (y: number) => [box('con', 'concept', 100, 300, 220, 60), box('amb', 'ambient', 130, y, 200, 30)]
    let prev = layoutBubbles(at(290), VP)
    const dy0 = prev.get('amb')!.dy
    expect(prev.get('amb')!.hidden).toBe(false)
    // The ambient speaker walks down 4px: the ideal lift changes, the placement does not.
    for (const y of [292, 294, 291, 293]) {
      const next = layoutBubbles(at(y), VP, prev)
      expect(next.get('amb')!.dy).toBe(dy0)
      expect(noOverlap(at(y), next)).toBe(true)
      prev = next
    }
    // Once the conflict is gone it returns to its natural place.
    const far = [box('con', 'concept', 100, 300, 220, 60), box('amb', 'ambient', 700, 290, 200, 30)]
    expect(layoutBubbles(far, VP, prev).get('amb')!.dy).toBe(0)
  })

  it('needs extra clearance before a hidden ambient line reappears', () => {
    const con = box('con', 'concept', 100, 300, 220, 60)
    const hiddenPrev = new Map<string, Placement>([['con', P(0, 0)], ['amb', { ...P(0, 0), hidden: true }]])
    // 8px to the right of the concept: fine for a visible line (gap 6), too close to reappear.
    const amb = box('amb', 'ambient', 328, 300, 200, 30)
    expect(layoutBubbles([con, amb], VP, new Map([['con', hiddenPrev.get('con')!], ['amb', P(0, 0)]])).get('amb')).toMatchObject({ dx: 0, dy: 0, hidden: false })
    expect(layoutBubbles([con, amb], VP, hiddenPrev).get('amb')!.dy).toBeLessThan(0)
  })

  it('stays overlap-free with many bubbles', () => {
    const items: BubbleBox[] = []
    for (let i = 0; i < 60; i++) items.push(box(`b${i}`, i % 7 === 0 ? 'concept' : 'ambient', (i * 97) % 1200, 200 + ((i * 53) % 500), 180, 36))
    const res = layoutBubbles(items, VP)
    expect(noOverlap(items, res)).toBe(true)
    for (const b of items) if (b.kind === 'concept') expect(res.get(b.key)!.hidden).toBe(false)
  })

  it('hides ambient lines whose speaker is below the free area (mobile bottom sheet)', () => {
    const vp: Viewport = { left: 8, top: 128, right: 382, bottom: 333 }
    // Head 10px below the sheet edge: hidden like the other three edges (no one-bubble tolerance).
    const res = layoutBubbles([box('amb', 'ambient', 100, 313, 180, 30)], vp)
    expect(res.get('amb')!.hidden).toBe(true)
    // Head just inside: shown in place.
    expect(layoutBubbles([box('amb', 'ambient', 100, 290, 180, 30)], vp).get('amb')!.hidden).toBe(false)
  })

  it('hides a concept icon that has no free slot instead of stacking it under the decision (sheet open)', () => {
    const vp: Viewport = { left: 8, top: 128, right: 382, bottom: 333 }
    const items = [
      box('dec', 'decision', 20, 200, 350, 91, 'nevin'),
      box('con', 'concept', 30, 190, 340, 94, 'can'),
      box('ico1', 'conceptIcon', 150, 250, 44, 44, 'can'),
      box('ico2', 'conceptIcon', 60, 240, 44, 44, 'hakan'),
    ]
    const res = layoutBubbles(items, vp)
    expect(res.get('dec')).toMatchObject({ hidden: false })
    expect(res.get('con')).toMatchObject({ hidden: false })
    expect(noOverlap(items.filter((b) => b.kind === 'conceptIcon' || b.key === 'dec'), res)).toBe(true)
    expect(noOverlap(items.filter((b) => b.kind === 'conceptIcon' || b.key === 'con'), res)).toBe(true)
  })

  it('moves a concept icon sideways when above and below are full', () => {
    const vp: Viewport = { left: 8, top: 100, right: 800, bottom: 300 }
    const items = [box('dec', 'decision', 300, 110, 200, 180), box('ico', 'conceptIcon', 380, 200, 44, 44)]
    const res = layoutBubbles(items, vp)
    const ico = res.get('ico')!
    expect(ico.hidden).toBe(false)
    expect(ico.dx).not.toBe(0)
    expect(noOverlap(items, res)).toBe(true)
  })

  it('drops the previous slot once a higher-priority bubble takes it', () => {
    const con = box('con', 'concept', 100, 300, 220, 60)
    const amb = box('amb', 'ambient', 130, 290, 200, 30)
    const prev = layoutBubbles([con, amb], VP)
    const kept = prev.get('amb')!
    expect(kept.hidden).toBe(false)
    // A decision now sits exactly where the ambient line was lifted to.
    const dec = box('dec', 'decision', 120, 290 + kept.dy - 10, 220, 50)
    const items = [con, amb, dec]
    const res = layoutBubbles(items, VP, prev)
    expect(res.get('dec')).toMatchObject({ dx: 0, dy: 0, hidden: false })
    expect(res.get('amb')!.hidden || res.get('amb')!.dy !== kept.dy).toBe(true)
    expect(noOverlap(items, res)).toBe(true)
  })

  it('keeps a pushed-down bubble below while that side stays valid (no flipping)', () => {
    const vp: Viewport = { left: 8, top: 8, right: 1432, bottom: 892 }
    const dec = box('dec', 'decision', 100, 300, 220, 60)
    const con = box('con', 'concept', 110, 310, 220, 60)
    // Last time the concept was pushed below the decision; lifting it above would also fit now.
    const prev = new Map<string, Placement>([['dec', P(0, 0)], ['con', P(0, 56)]])
    const res = layoutBubbles([dec, con], vp, prev)
    expect(res.get('con')!.dy).toBeGreaterThan(0)
    expect(noOverlap([dec, con], res)).toBe(true)
    // Without history it goes up (the default side).
    expect(layoutBubbles([dec, con], vp).get('con')!.dy).toBeLessThan(0)
  })

  it('draws a stem for a lifted bubble, but not through another bubble', () => {
    const items = [box('con', 'concept', 100, 300, 220, 60), box('ico', 'conceptIcon', 188, 316, 44, 44)]
    const res = layoutBubbles(items, VP)
    const ico = res.get('ico')!
    expect(ico.dy).toBeLessThan(0)
    // The icon's stem would cross the concept bubble between it and the speaker: none.
    expect(ico.stem).toBe(0)
    // Clear path: an ambient line lifted over a bubble that is off to the side of its head.
    const side = [box('con', 'concept', 100, 300, 220, 60), box('amb', 'ambient', 300, 290, 200, 30)]
    const r2 = layoutBubbles(side, VP)
    const a = r2.get('amb')!
    expect(a.dy).toBeLessThan(-8)
    expect(a.stem).toBeCloseTo(-a.dy)
    expect(a.stemX).toBeCloseTo(100)
  })

  it('does not swap two mirror-image sideways slots on float noise', () => {
    const vp: Viewport = { left: 8, top: 128, right: 382, bottom: 333 }
    const at = (e: number) => [
      box('dec', 'decision', 72, 131, 234, 91, 'f'),
      box('con', 'concept', 21, 127 + 100, 335, 94, 'f'),
      box('pmf', 'conceptIcon', 167 + e, 177, 44, 44, 'f'),
      box('run', 'conceptIcon', 167 - e, 177, 44, 44, 'f'),
    ]
    let prev = layoutBubbles(at(0.00001), vp)
    const side = Math.sign(prev.get('pmf')!.dx)
    expect(side).not.toBe(0)
    for (const e of [-0.00001, 0.00002, -0.00003, 0.00001]) {
      const next = layoutBubbles(at(e), vp, prev)
      expect(Math.sign(next.get('pmf')!.dx)).toBe(side)
      expect(noOverlap(at(e), next)).toBe(true)
      prev = next
    }
  })
})
