import { describe, expect, it } from 'vitest'
import { AMBIENT_VISIBLE_MS, AMBIENT_WAIT_MS, applyFrame, BubbleLayoutRegistry, CENTER_ANCHOR, createEntry, measure, resolveAnchor, runLayout, shiftBubble, type AnchorPos, type BubbleEl, type MeasuredEl } from './bubbleDriver'
import { layoutBubbles, type BubbleBox, type BubbleKind, type Viewport } from './bubbleLayout'

const VP: Viewport = { left: 8, top: 8, right: 1432, bottom: 892 }

/** Fake bubble element: natural box + whatever translate the driver wrote into style.transform. */
function fakeEl(left: number, top: number, w: number, h: number) {
  const restarts = { n: 0 }
  const el: MeasuredEl & { natural: { left: number; top: number } } = {
    natural: { left, top },
    style: {},
    offsetWidth: w,
    offsetHeight: h,
    getBoundingClientRect() {
      const m = /translate\(([-\d.]+)px, calc\(-50% \+ ([-\d.]+)px\)\)/.exec(el.style.transform ?? '')
      const dx = m ? Number(m[1]) : 0
      const dy = m ? Number(m[2]) : 0
      return { left: el.natural.left + dx, top: el.natural.top + dy, width: w, height: h }
    },
    getAnimations: () => [{ currentTime: 1234, play: () => void restarts.n++ }],
  }
  return { el, restarts }
}

function add(reg: BubbleLayoutRegistry, key: string, kind: BubbleKind, left: number, top: number, w: number, h: number, now = 0, speakerId = key) {
  const f = fakeEl(left, top, w, h)
  const stem: BubbleEl = { style: {} }
  const wraps: BubbleEl[] = [{ style: {} }, { style: {} }]
  const e = createEntry({ key, kind, speakerId, el: f.el, stem, wraps, interactive: kind !== 'ambient' }, now)
  reg.entries.set(key, e)
  return { e, ...f, stem, wraps }
}

/** Runs n frames of 16ms starting at `t`; returns the end time. */
function frames(reg: BubbleLayoutRegistry, n: number, t: number): number {
  for (let i = 0; i < n; i++) {
    t += 16
    runLayout(reg, () => VP, t)
    applyFrame(reg, 0.016, t)
  }
  return t
}

describe('bubble layout driver', () => {
  it('makes drei wrappers click-through; only clickable content takes pointer events', () => {
    const reg = new BubbleLayoutRegistry()
    const con = add(reg, 'con', 'concept', 100, 300, 220, 60)
    const amb = add(reg, 'amb', 'ambient', 700, 300, 200, 30)
    for (const w of [...con.wraps, ...amb.wraps]) expect(w.style.pointerEvents).toBe('none')
    expect(con.el.style.pointerEvents).toBe('auto')
    expect(amb.el.style.pointerEvents).toBe('none')
  })

  it('shows bubbles after the first layout pass and recovers the natural box from its own offset', () => {
    const reg = new BubbleLayoutRegistry()
    add(reg, 'con', 'concept', 100, 300, 220, 60)
    const ico = add(reg, 'ico', 'conceptIcon', 188, 316, 44, 44)
    let t = frames(reg, 1, 0)
    expect(ico.el.style.visibility).toBeUndefined() // not measured yet (drei positions on frame 1)
    t = frames(reg, 3, t)
    expect(ico.el.style.visibility).toBe('visible')
    for (const w of ico.wraps) expect(w.style.visibility).toBe('visible')
    const dy = reg.placements.get('ico')!.dy
    expect(dy).toBeLessThan(0)
    expect(ico.el.style.transform).toBe(`translate(0px, calc(-50% + ${dy}px))`)
    // The measured box now includes our offset; measure() must still report the natural one.
    const box = measure(reg).find((b) => b.key === 'ico')!
    expect(box.top).toBeCloseTo(316)
    expect(box.left).toBeCloseTo(188)
    // Re-layout with the same input keeps the placement (no drift from our own transform).
    frames(reg, 10, t + 200)
    expect(reg.placements.get('ico')!.dy).toBe(dy)
  })

  it('hides the wrappers too when a bubble is hidden, and eases moves instead of jumping', () => {
    const reg = new BubbleLayoutRegistry()
    add(reg, 'con', 'concept', 100, 300, 220, 60)
    const amb = add(reg, 'amb', 'ambient', 700, 300, 200, 30)
    let t = frames(reg, 4, 0)
    expect(amb.el.style.visibility).toBe('visible')
    // A decision appears right on top of the ambient line: it gets hidden, wrappers included.
    add(reg, 'dec', 'decision', 690, 250, 220, 80, t)
    reg.dirty = true
    t = frames(reg, 4, t)
    expect(amb.el.style.visibility).toBe('hidden')
    for (const w of amb.wraps) expect(w.style.visibility).toBe('hidden')
    // The decision's speaker walks onto the concept: the concept (lower priority) must glide, not
    // snap, to its new slot.
    const dec = reg.entries.get('dec')!.el as ReturnType<typeof fakeEl>['el']
    dec.natural = { left: 100, top: 310 }
    reg.dirty = true
    t = frames(reg, 2, t)
    const target = reg.placements.get('con')!.dy
    expect(target).toBeLessThan(-40)
    const cur = reg.entries.get('con')!.cur.dy
    expect(cur).toBeLessThan(0)
    expect(cur).toBeGreaterThan(target)
    frames(reg, 60, t)
    expect(reg.entries.get('con')!.cur.dy).toBe(target)
  })

  it('draws the stem from the eased position down to the head', () => {
    const reg = new BubbleLayoutRegistry()
    add(reg, 'con', 'concept', 100, 300, 220, 60)
    const amb = add(reg, 'amb', 'ambient', 300, 290, 200, 30)
    frames(reg, 40, 0)
    const p = reg.placements.get('amb')!
    expect(p.stem).toBeGreaterThan(0)
    expect(amb.stem.style.display).toBe('block')
    expect(amb.stem.style.height).toBe(`${Math.round(-p.dy)}px`)
    expect(amb.stem.style.left).toBe(`${Math.round(p.stemX)}px`)
  })

  it('restarts the ambient fade when a waiting line is shown, and drops it after its 3 s', () => {
    const reg = new BubbleLayoutRegistry()
    const amb = add(reg, 'amb', 'ambient', 700, 300, 200, 30)
    let t = frames(reg, 4, 0)
    expect(amb.el.style.visibility).toBe('visible')
    expect(amb.restarts.n).toBe(1)
    t = frames(reg, Math.ceil(AMBIENT_VISIBLE_MS / 16) + 2, t)
    expect(amb.el.style.visibility).toBe('hidden')
    expect(reg.entries.get('amb')!.done).toBe(true)
    // A faded line no longer reserves space.
    expect(measure(reg).some((b) => b.key === 'amb')).toBe(false)
  })

  it('drops an ambient line that could not find space within the wait limit', () => {
    const reg = new BubbleLayoutRegistry()
    add(reg, 'con', 'concept', 100, 300, 220, 60)
    const amb = add(reg, 'amb', 'ambient', 120, 320, 200, 40)
    let t = frames(reg, 4, 0)
    expect(amb.el.style.visibility).not.toBe('visible')
    t = frames(reg, Math.ceil(AMBIENT_WAIT_MS / 16) + 2, t)
    expect(reg.entries.get('amb')!.done).toBe(true)
    // The concept leaves; the old line must not pop back with a half-played animation.
    reg.entries.delete('con')
    reg.dirty = true
    frames(reg, 10, t)
    expect(amb.el.style.visibility).not.toBe('visible')
    expect(amb.restarts.n).toBe(0)
  })

  it('glides instead of snapping when the bubble moves to another speaker', () => {
    const reg = new BubbleLayoutRegistry()
    const con = add(reg, 'con', 'concept', 100, 300, 220, 60)
    let t = frames(reg, 4, 0)
    expect(con.el.getBoundingClientRect().top).toBe(300)
    // A visitor walks in and says the line now: the anchor jumps 300px to the right.
    con.el.natural = { left: 400, top: 250 }
    shiftBubble(reg.entries.get('con')!, 300, -50)
    reg.dirty = true
    // Same frame: still exactly where it was on screen.
    expect(con.el.getBoundingClientRect()).toMatchObject({ left: 100, top: 300 })
    t = frames(reg, 1, t)
    const r1 = con.el.getBoundingClientRect()
    // Then it eases over to the new speaker instead of snapping.
    expect(r1.left).toBeGreaterThan(100)
    expect(r1.left).toBeLessThan(400)
    frames(reg, 60, t)
    const r2 = con.el.getBoundingClientRect()
    expect(r2.left).toBeCloseTo(400)
    expect(r2.top).toBeCloseTo(250)
  })

  it('never hides a decision/concept bubble whose speaker is outside (question stays readable)', () => {
    const reg = new BubbleLayoutRegistry()
    const dec = add(reg, 'dec', 'decision', 300, 300, 260, 70)
    const con = add(reg, 'con', 'concept', 700, 300, 220, 60)
    const amb = add(reg, 'amb', 'ambient', 1000, 300, 200, 30)
    // Every speaker already walked out before the first layout pass.
    for (const e of reg.entries.values()) e.speakerVisible = false
    let t = frames(reg, 4, 0)
    expect(dec.el.style.visibility).toBe('visible')
    expect(dec.el.style.opacity).toBe('1')
    expect(con.el.style.visibility).toBe('visible')
    expect(amb.el.style.visibility).not.toBe('visible')
    expect(measure(reg).map((b) => b.key).sort()).toEqual(['con', 'dec'])
    // Speaker leaves while the decision is already on screen: it stays.
    reg.entries.get('dec')!.speakerVisible = true
    t = frames(reg, 4, t)
    reg.entries.get('dec')!.speakerVisible = false
    reg.dirty = true
    frames(reg, 10, t)
    expect(dec.el.style.visibility).toBe('visible')
  })
})

describe('resolveAnchor', () => {
  const at = (x: number, visible = true): AnchorPos => ({ x, y: 1, z: 0, visible })

  it('follows a visible speaker', () => {
    const pos = new Map([['v1', at(3)], ['founder', at(0)]])
    expect(resolveAnchor('v1', 'decision', pos)).toEqual({ pos: pos.get('v1'), visible: true, anchorId: 'v1' })
    expect(resolveAnchor('v1', 'ambient', pos)).toEqual({ pos: pos.get('v1'), visible: true, anchorId: 'v1' })
  })

  it('moves a clickable bubble to the founder when its speaker left or walked out', () => {
    const founder = at(0)
    const gone = new Map([['founder', founder]])
    const outside = new Map([['v1', at(9, false)], ['founder', founder]])
    for (const kind of ['decision', 'concept', 'conceptIcon'] as const) {
      expect(resolveAnchor('v1', kind, gone)).toEqual({ pos: founder, visible: true, anchorId: 'founder' })
      expect(resolveAnchor('v1', kind, outside)).toEqual({ pos: founder, visible: true, anchorId: 'founder' })
    }
  })

  it('falls back to the scene centre (pos null) when the founder is outside too, still visible', () => {
    const pos = new Map([['v1', at(9, false)], ['founder', at(0, false)]])
    expect(resolveAnchor('v1', 'decision', pos)).toEqual({ pos: null, visible: true, anchorId: CENTER_ANCHOR })
    expect(resolveAnchor('v1', 'concept', new Map())).toEqual({ pos: null, visible: true, anchorId: CENTER_ANCHOR })
  })

  it('still hides ambient lines of a speaker who is outside', () => {
    const pos = new Map([['v1', at(9, false)], ['founder', at(0)]])
    expect(resolveAnchor('v1', 'ambient', pos).visible).toBe(false)
    expect(resolveAnchor('nobody', 'ambient', new Map()).visible).toBe(true)
  })

  it("hides the founder's ambient line while a decision moved from an absent visitor sits above the founder", () => {
    const pos = new Map([['v1', at(9, false)], ['founder', at(0)]])
    const dec = resolveAnchor('v1', 'decision', pos)
    const amb = resolveAnchor('founder', 'ambient', pos)
    expect(dec.anchorId).toBe('founder')
    const items: BubbleBox[] = [
      { key: 'dec', speakerId: dec.anchorId, kind: 'decision', left: 100, top: 100, w: 120, h: 60 },
      { key: 'amb', speakerId: amb.anchorId, kind: 'ambient', left: 400, top: 100, w: 100, h: 30 },
    ]
    const res = layoutBubbles(items, { left: 0, top: 0, right: 800, bottom: 600 })
    expect(res.get('amb')?.hidden).toBe(true)
    expect(res.get('dec')?.hidden).toBeFalsy()
  })
})
