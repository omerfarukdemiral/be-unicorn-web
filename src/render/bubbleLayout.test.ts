import { describe, expect, it } from 'vitest'
import { layoutBubbles, type BubbleBox, type Placement, type Viewport } from './bubbleLayout'

const VP: Viewport = { left: 8, top: 8, right: 1432, bottom: 892 }

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
    expect(res.get('a')).toEqual({ dx: 0, dy: 0, hidden: false })
    expect(res.get('b')).toEqual({ dx: 0, dy: 0, hidden: false })
  })

  it('lifts the lower-priority bubble above the higher one on overlap', () => {
    const items = [box('amb', 'ambient', 120, 320, 200, 40), box('con', 'concept', 100, 300, 220, 60)]
    // Ambient slightly overlapping near the top: small lift is enough.
    const small = [box('amb', 'ambient', 120, 280, 200, 30), box('con', 'concept', 100, 300, 220, 60)]
    const r1 = layoutBubbles(small, VP)
    expect(r1.get('con')).toEqual({ dx: 0, dy: 0, hidden: false })
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
    expect(res.get('dec')).toEqual({ dx: 0, dy: 0, hidden: false })
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
    const hiddenPrev = new Map<string, Placement>([['con', { dx: 0, dy: 0, hidden: false }], ['amb', { dx: 0, dy: 0, hidden: true }]])
    // 8px to the right of the concept: fine for a visible line (gap 6), too close to reappear.
    const amb = box('amb', 'ambient', 328, 300, 200, 30)
    expect(layoutBubbles([con, amb], VP, new Map([['con', hiddenPrev.get('con')!], ['amb', { dx: 0, dy: 0, hidden: false }]])).get('amb')).toEqual({ dx: 0, dy: 0, hidden: false })
    expect(layoutBubbles([con, amb], VP, hiddenPrev).get('amb')!.dy).toBeLessThan(0)
  })

  it('stays cheap and overlap-free with many bubbles', () => {
    const items: BubbleBox[] = []
    for (let i = 0; i < 60; i++) items.push(box(`b${i}`, i % 7 === 0 ? 'concept' : 'ambient', (i * 97) % 1200, 200 + ((i * 53) % 500), 180, 36))
    const t0 = performance.now()
    const res = layoutBubbles(items, VP)
    expect(performance.now() - t0).toBeLessThan(50)
    expect(noOverlap(items, res)).toBe(true)
    for (const b of items) if (b.kind === 'concept') expect(res.get(b.key)!.hidden).toBe(false)
  })
})
