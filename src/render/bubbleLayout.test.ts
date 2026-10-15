import { describe, expect, it } from 'vitest'
import { freeBubbleHeight, layoutBubbles, type BubbleBox, type Placement, type Viewport } from './bubbleLayout'

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

  it('a clickable that would stack on another one goes beside it with a stem to its own head', () => {
    // Two staff pills whose heads are 95px apart: the second one's head is under the first pill, so stacked on top
    // its tail would rest on that pill ("Mira boşta" on "Ebru ayrılıyor").
    const a = box('a', 'staff', 300, 400, 200, 36)
    const b = box('b', 'staff', 395, 405, 200, 36)
    const res = layoutBubbles([a, b], VP)
    expect(noOverlap([a, b], res)).toBe(true)
    const pb = res.get('b')!
    expect(pb.dx).not.toBe(0)
    expect(pb.stem).toBeGreaterThan(0)
    expect(pb.detached).toBeFalsy()
  })

  it('marks a lifted bubble with no stem as detached (its tail would point at the bubble below)', () => {
    // A narrow column: no room beside, so the second pill stacks above the first.
    const vp: Viewport = { left: 290, top: 8, right: 480, bottom: 892 }
    const a = box('a', 'staff', 300, 400, 170, 36)
    const b = box('b', 'staff', 300, 405, 170, 36)
    const res = layoutBubbles([a, b], vp)
    const pb = res.get('b')!
    expect(pb.dy).toBeLessThan(0)
    expect(pb.stem).toBe(0)
    expect(pb.detached).toBe(true)
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

  it('stacks forced bubbles into free gaps from the top when there is no room by the head (never overlapping)', () => {
    // Short free area, three forced bubbles over the same head.
    const vp: Viewport = { left: 8, top: 100, right: 382, bottom: 400 }
    const items = [
      box('dec', 'decision', 60, 200, 300, 90, 'v1'),
      box('desk', 'desk', 70, 210, 300, 80, 'desk'),
      box('s1', 'staff', 80, 220, 300, 80, 'e1'),
    ]
    const res = layoutBubbles(items, vp)
    for (const b of items) {
      const p = res.get(b.key)!
      expect(p.hidden).toBe(false)
      expect(b.top + p.dy).toBeGreaterThanOrEqual(vp.top - 0.5)
      expect(b.top + p.dy + b.h).toBeLessThanOrEqual(vp.bottom + 0.5)
    }
    expect(noOverlap(items, res)).toBe(true)
  })

  it('places the open bubble first and never hides or moves it for a decision', () => {
    const items = [box('dec', 'decision', 100, 300, 220, 60, 'v1'), box('staff:e1', 'staff', 110, 310, 300, 160, 'e1')]
    const res = layoutBubbles(items, VP, undefined, { openKey: 'staff:e1' })
    expect(res.get('staff:e1')).toMatchObject({ dx: 0, dy: 0, hidden: false })
    expect(res.get('dec')!.hidden).toBe(false)
    expect(noOverlap(items, res)).toBe(true)
    // Without it being open the decision keeps its spot.
    expect(layoutBubbles(items, VP).get('dec')).toMatchObject({ dx: 0, dy: 0 })
  })

  it('hides a reflection before a staff bubble when space runs out', () => {
    const vp: Viewport = { left: 8, top: 100, right: 300, bottom: 260 }
    const items = [box('st', 'staff', 20, 120, 270, 120, 'e1'), box('ref', 'reflection', 30, 130, 250, 60, 'desk')]
    const res = layoutBubbles(items, vp)
    expect(res.get('st')).toMatchObject({ hidden: false, dy: 0 })
    expect(res.get('ref')!.hidden).toBe(true)
  })

  it('a sideways-displaced forced bubble keeps a diagonal stem to the head', () => {
    // Above the desk head: a decision (right) and a visitor (bottom left) leave only a lifted slot to the left.
    const vp: Viewport = { left: 8, top: 100, right: 600, bottom: 360 }
    const items = [box('dec', 'decision', 420, 150, 170, 155, 'v1'), box('vis', 'visitor', 150, 290, 150, 69, 'v2'), box('desk', 'desk', 344, 300, 140, 50, 'desk')]
    const res = layoutBubbles(items, vp)
    const d = res.get('desk')!
    // −75: the pill's tail clears the visitor pill by the full gap too.
    expect(d).toMatchObject({ dx: -72, dy: -75, hidden: false })
    expect(noOverlap(items, res)).toBe(true)
    // From the bubble's bottom-right corner (6px in) down to the head at x 414.
    expect(d.stemX).toBeCloseTo(134)
    expect(d.stem).toBeCloseTo(Math.hypot(8, 75))
    expect(d.stemAngle).toBeLessThan(0)
    // A non-forced bubble in the same spot gets no stem.
    const ico = layoutBubbles([items[0]!, items[1]!, { ...items[2]!, kind: 'conceptIcon' }], vp).get('desk')!
    expect(ico.stem).toBe(0)
  })

  it('while an expanded bubble fills the free area, other forced bubbles wait hidden instead of overlapping it', () => {
    const vp: Viewport = { left: 8, top: 120, right: 492, bottom: 540 }
    const items = [box('desk:actions', 'desk', 12, 132, 476, 401, 'desk'), box('staff:e1', 'staff', 119, 138, 177, 38, 'e1')]
    const res = layoutBubbles(items, vp, undefined, { openKey: 'desk:actions' })
    expect(res.get('desk:actions')!.hidden).toBe(false)
    expect(res.get('staff:e1')!.hidden).toBe(true)
    // Not open: both stay on screen (the staff bubble is forced).
    expect(layoutBubbles(items, vp).get('staff:e1')!.hidden).toBe(false)
  })

  it('keeps clear of obstacles (the start call, a strip floating over a sheet)', () => {
    const vp: Viewport = { left: 8, top: 100, right: 600, bottom: 700, obstacles: [{ left: 150, top: 300, right: 450, bottom: 420 }] }
    const items = [box('desk', 'desk', 200, 330, 200, 40), box('amb', 'ambient', 220, 380, 160, 30)]
    const res = layoutBubbles(items, vp)
    const d = res.get('desk')!
    expect(d.hidden).toBe(false)
    expect(hit(rectOf(items[0]!, d), { l: 150, t: 300, r: 450, b: 420 })).toBe(false)
    // An ambient line has nowhere near its speaker to go: it waits hidden.
    expect(res.get('amb')!.hidden).toBe(true)
  })

  // QA round 3: pills touching or stacked with their tail painted on the neighbour, the reflection under an open card,
  // the release banner and "+N" floats under bubble stems.
  describe('min gaps, juice and reflections', () => {
    // BubbleTail hangs ~7px under the box (a 10px square turned 45°).
    const TAIL = 7
    /** Free space between two placed bubbles, counting the upper one's tail (negative = overlap). */
    const gapOf = (a: BubbleBox, pa: Placement, b: BubbleBox, pb: Placement): number => {
      const ra = rectOf(a, pa)
      const rb = rectOf(b, pb)
      const [up, down] = ra.t <= rb.t ? [ra, rb] : [rb, ra]
      return Math.max(rb.l - ra.r, ra.l - rb.r, down.t - (up.b + TAIL))
    }

    it('keeps ≥ 6px between two stacked pills measured from the upper tail tip', () => {
      // Two "ayrılıyor" pills whose heads are 4px apart, no room above: the second is pushed below the first, whose
      // tail still points down at its head (b0-overlap: 0–1px, tail painted on the lower pill).
      const vp: Viewport = { left: 290, top: 390, right: 500, bottom: 892 }
      const a = box('staff:a', 'staff', 300, 400, 186, 38, 'a')
      const b = box('staff:b', 'staff', 302, 404, 186, 38, 'b')
      const res = layoutBubbles([a, b], vp)
      expect(res.get('staff:a')).toMatchObject({ dy: 0, hidden: false })
      expect(res.get('staff:b')!.dy).toBeGreaterThan(0)
      expect(gapOf(a, res.get('staff:a')!, b, res.get('staff:b')!)).toBeGreaterThanOrEqual(6)
      // Lifted instead (room above): the gap holds from the lifted pill's tail too.
      const up = layoutBubbles([a, b], { ...vp, top: 8 })
      expect(gapOf(a, up.get('staff:a')!, b, up.get('staff:b')!)).toBeGreaterThanOrEqual(6)
    })

    it('a decision pill never covers the chevron of the desk pill next to it', () => {
      // "Kurt · Maaş kaçtı." walking in beside "Sen · 3 aday bekliyor" (d/029): heads 120px apart, same height.
      const desk = box('desk:hire', 'desk', 485, 305, 183, 36, 'desk')
      const dec = box('decision:angel-lifeline', 'decision', 600, 312, 165, 36, 'v1')
      const vis = box('visitor:pitch:v2', 'visitor', 432, 345, 244, 36, 'v2')
      const items = [desk, dec, vis]
      let prev: Map<string, Placement> | undefined
      // The walker drifts left a few px per pass: every pass stays clear.
      for (let i = 0; i < 12; i++) {
        const moved = items.map((b) => (b === dec ? { ...b, left: b.left - i * 3 } : b))
        const res = layoutBubbles(moved, VP, prev)
        for (let x = 0; x < moved.length; x++)
          for (let y = x + 1; y < moved.length; y++) expect(gapOf(moved[x]!, res.get(moved[x]!.key)!, moved[y]!, res.get(moved[y]!.key)!)).toBeGreaterThanOrEqual(6)
        prev = res
      }
    })

    it('juice (release banner, floats): read-only bubbles keep off it, an actionable pill keeps its head (the juice yields)', () => {
      const banner = { left: 637, top: 340, right: 803, bottom: 373 }
      const vp: Viewport = { ...VP, juice: [banner] }
      const desk = box('desk:hire', 'desk', 626, 330, 188, 38, 'desk')
      expect(layoutBubbles([desk], vp).get('desk:hire')).toMatchObject({ hidden: false, dx: 0, dy: 0 })
      const ref = box('reflection:x', 'reflection', 616, 335, 208, 56, 'desk')
      const p = layoutBubbles([ref], vp).get('reflection:x')!
      if (!p.hidden) {
        const r = rectOf(ref, p)
        // Clear of the banner by the gap, tail included.
        expect(Math.max(banner.left - r.r, r.l - banner.right, banner.top - (r.b + TAIL), r.t - banner.bottom)).toBeGreaterThanOrEqual(6)
      }
      // A hard obstacle (the start call, a HUD island) still moves the actionable pill.
      const hard = layoutBubbles([desk], { ...VP, obstacles: [banner] }).get('desk:hire')!
      expect(hit(rectOf(desk, hard), { l: banner.left, t: banner.top, r: banner.right, b: banner.bottom })).toBe(false)
    })

    it('a reflection steps out of the way while any bubble is expanded', () => {
      const open = box('desk:round', 'desk', 500, 200, 340, 260, 'desk')
      const ref = box('reflection:x', 'reflection', 560, 420, 220, 56, 'desk')
      const far = box('reflection:y', 'reflection', 100, 600, 220, 56, 'v9')
      const res = layoutBubbles([open, ref, far], VP, undefined, { openKey: 'desk:round' })
      expect(res.get('desk:round')).toMatchObject({ hidden: false, dx: 0, dy: 0 })
      expect(res.get('reflection:x')!.hidden).toBe(true)
      expect(res.get('reflection:y')!.hidden).toBe(true)
      // Nothing open: it shows again.
      expect(layoutBubbles([ref], VP).get('reflection:x')!.hidden).toBe(false)
    })

    it('an actionable bubble keeps its own spot; the reflection on the same head moves, never the other way', () => {
      const pay = box('desk:payday', 'desk', 600, 300, 200, 38, 'desk')
      const ref = box('reflection:x', 'reflection', 590, 290, 220, 56, 'desk')
      const res = layoutBubbles([ref, pay], VP)
      expect(res.get('desk:payday')).toMatchObject({ hidden: false, dx: 0, dy: 0 })
      const r = res.get('reflection:x')!
      if (!r.hidden) expect(gapOf(pay, res.get('desk:payday')!, ref, r)).toBeGreaterThanOrEqual(6)
    })

    it('read-only bubbles never sit on the stem of a lifted bubble', () => {
      // The desk card is lifted over a decision beside its head; its stem runs straight down to the desk head (x 700).
      const dec = box('dec', 'decision', 470, 380, 200, 40, 'v1')
      const card = box('desk:hire', 'desk', 560, 300, 280, 120, 'desk')
      // A reflection of another speaker whose natural spot is right on that stem.
      const ref = box('reflection:x', 'reflection', 680, 392, 120, 26, 'v2')
      const res = layoutBubbles([dec, card, ref], VP)
      const pc = res.get('desk:hire')!
      expect(pc.dy).toBeLessThan(-8)
      expect(pc.stem).toBeGreaterThan(0)
      const stemX = card.left + card.w / 2
      const stem = { l: stemX - 2, t: card.top + pc.dy + card.h, r: stemX + 2, b: card.top + card.h }
      const pr = res.get('reflection:x')!
      if (!pr.hidden) expect(hit(rectOf(ref, pr), stem)).toBe(false)
    })
  })
})

describe('freeBubbleHeight (landscape phone 844 x 390)', () => {
  // The runway strip (y 279..321) and the dock (y 330..) sit under the scene; the card's option list scrolls above them.
  const vp: Viewport = {
    left: 8,
    top: 76,
    right: 836,
    bottom: 382,
    obstacles: [
      { left: 49, top: 277, right: 747, bottom: 323 },
      { left: 13, top: 328, right: 448, bottom: 384 },
    ],
  }
  it('stops at the first obstacle below the top, not at the screen bottom', () => {
    expect(freeBubbleHeight(vp)).toBe(277 - 4 - 76)
  })
  it('with nothing below it is the whole free area', () => {
    expect(freeBubbleHeight({ ...vp, obstacles: [] })).toBe(382 - 76)
  })
})

describe('freeBubbleHeight (portrait phone 375 x 667)', () => {
  // The stage goal card hangs under the top bar (y 68..125); the dock starts at y 540.
  const vp: Viewport = {
    left: 8,
    top: 76,
    right: 367,
    bottom: 659,
    obstacles: [
      { left: 6, top: 66, right: 162, bottom: 127 },
      { left: 8, top: 538, right: 367, bottom: 660 },
    ],
  }
  it('starts under a HUD card hanging off the top bar', () => {
    expect(freeBubbleHeight(vp)).toBe(538 - 4 - (127 + 4))
  })
  it('a wide viewport (desktop, landscape) is not narrowed by a card beside the bubble', () => {
    expect(freeBubbleHeight({ ...vp, right: 836 })).toBe(538 - 4 - 76)
  })
})
