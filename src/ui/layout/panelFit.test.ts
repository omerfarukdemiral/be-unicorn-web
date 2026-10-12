import { describe, expect, it } from 'vitest'
import { CARD_HEADER_H, CARD_SLACK, expandableLimits, sidePanelHeight, sidePanelOffsets } from './panelFit'
import { BAR_H, EDGE, GAP } from './tokens'

// The head row of a phone panel: 3px stripe + 44px buttons + 8px padding + the hairline.
const PHONE_HEAD_H = 3 + 44 + 8 + 1

describe('side panel on a landscape phone', () => {
  it('starts at the top edge and leaves a body of 300px or more at 844x390', () => {
    expect(sidePanelOffsets('landscape').top).toBe(EDGE)
    expect(sidePanelHeight('landscape', 390) - PHONE_HEAD_H).toBeGreaterThanOrEqual(300)
  })

  it('desktop keeps its place between the bars', () => {
    expect(sidePanelOffsets('desktop')).toEqual({ top: EDGE + BAR_H + GAP, bottom: BAR_H + GAP })
    expect(sidePanelHeight('desktop', 800)).toBe(800 - 72 - 72)
  })
})

describe('expandableLimits', () => {
  // Typical insets: top bar bottom + GAP, strip / bar stack from the bottom.
  const cases = [
    { name: '844x390', vw: 844, vh: 390, inset: { top: 68, right: 0, bottom: 60 }, mode: 'landscape' as const },
    { name: '375x667', vw: 375, vh: 667, inset: { top: 68, right: 0, bottom: 120 }, mode: 'portrait' as const },
    { name: '390x844', vw: 390, vh: 844, inset: { top: 68, right: 0, bottom: 120 }, mode: 'portrait' as const },
    { name: '1440x900', vw: 1440, vh: 900, inset: { top: 72, right: 0, bottom: 72 }, mode: 'desktop' as const },
  ]
  for (const c of cases) {
    it(`${c.name}: header + scroll area fit the free height`, () => {
      const { maxH } = expandableLimits({ w: c.vw, h: c.vh }, c.inset, c.mode)
      const free = c.vh - c.inset.top - c.inset.bottom
      // (a floor of 120px keeps the card usable when the free area is tiny)
      expect(maxH + CARD_HEADER_H + CARD_SLACK).toBeLessThanOrEqual(Math.max(free, 120 + CARD_HEADER_H + CARD_SLACK))
      expect(maxH).toBeLessThanOrEqual(420)
    })
  }

  it('a landscape card is at most 420px wide, also beside the side panel', () => {
    expect(expandableLimits({ w: 844, h: 390 }, { top: 68, right: 0, bottom: 60 }, 'landscape').maxW).toBe(420)
    expect(expandableLimits({ w: 844, h: 390 }, { top: 68, right: 376, bottom: 60 }, 'landscape').maxW).toBe(420)
    expect(expandableLimits({ w: 600, h: 390 }, { top: 68, right: 376, bottom: 60 }, 'landscape').maxW).toBe(200)
  })

  it('portrait and desktop widths are untouched', () => {
    expect(expandableLimits({ w: 390, h: 844 }, { top: 68, right: 0, bottom: 120 }, 'portrait').maxW).toBe(366)
  })
})
