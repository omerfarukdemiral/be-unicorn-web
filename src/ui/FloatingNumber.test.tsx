// Floating numbers and ability slots (docs/GAMEPLAY_V2.md §10.4), rendered to a string (node environment, no DOM).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FOUNDER_ACTIONS } from '../engine/types'
import { ACTION_ERROR_TEXT, TEASERS } from '../content'
import { FLOAT_MAX, FLOAT_MS, FloatingNumbers, floatText, liveFloats, pushFloat, type FloatItem } from './FloatingNumber'
import { FounderSlot, SLOT, type FounderActionView } from './FounderActions'
import { t } from './i18n'

const item = (id: number, at: number): FloatItem => ({ id, kind: 'findUsers', text: `+${id} kullanıcı`, at })

function view(over: Partial<FounderActionView> = {}): FounderActionView {
  return {
    kind: 'findUsers',
    locked: false,
    disabled: false,
    running: false,
    runFrac: 0,
    cdFrac: 0,
    saturated: false,
    moves: 1,
    outOfMoves: false,
    guided: false,
    stageName: '',
    name: t('slot.findUsers'),
    label: 'Kullanıcı bul: +3–6 kullanıcı',
    tip: '+3–6 kullanıcı',
    run: () => {},
    ...over,
  }
}

/** Text a player sees without hovering: the markup minus the tooltip, tags stripped. */
function visibleText(html: string): string {
  return html
    .replace(/<span role="tooltip"[\s\S]*?<\/span><\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('floating number queue', () => {
  it('keeps at most three in the air (a 4× burst drops the oldest)', () => {
    let q: FloatItem[] = []
    for (let i = 1; i <= 6; i++) q = pushFloat(q, item(i, 1000 + i), 1000 + i)
    expect(FLOAT_MAX).toBe(3)
    expect(q.map((x) => x.id)).toEqual([4, 5, 6])
  })

  it('lives 700 ms', () => {
    expect(FLOAT_MS).toBe(700)
    const q = [item(1, 0), item(2, 300)]
    expect(liveFloats(q, 699).map((x) => x.id)).toEqual([1, 2])
    expect(liveFloats(q, 700).map((x) => x.id)).toEqual([2])
    expect(liveFloats(q, 1000)).toEqual([])
  })

  it('renders at most three numbers, each animated for 700 ms', () => {
    const html = renderToStaticMarkup(<FloatingNumbers items={[1, 2, 3, 4, 5].map((i) => item(i, 0))} />)
    expect(html.match(/data-float/g)).toHaveLength(3)
    expect(html).toContain('animation-duration:700ms')
    expect(html).not.toContain('+1 kullanıcı')
    expect(renderToStaticMarkup(<FloatingNumbers items={[]} />)).toBe('')
  })

  it('counts only actions with a return', () => {
    expect(floatText('findUsers', 3)).toBe('+3 kullanıcı')
    expect(floatText('salesCall', 1200)).toBe('+$1.2K/ay')
    expect(floatText('rest', undefined)).toBeNull()
    expect(floatText('motivateTeam', 5)).toBeNull()
  })
})

describe('ability slot', () => {
  it('is a 44px square with no visible label (the name lives in the tooltip)', () => {
    const html = renderToStaticMarkup(<FounderSlot a={view()} />)
    expect(SLOT).toBeGreaterThanOrEqual(44)
    expect(html).toContain('width:44px;height:44px')
    expect(html).toContain('role="tooltip"')
    // Only the move cost figure is on the face of the slot.
    expect(visibleText(html)).toBe('1')
  })

  it('names every slot in two words at most', () => {
    for (const k of FOUNDER_ACTIONS) {
      const name = t(`slot.${k}`)
      expect(name, k).not.toBe(`slot.${k}`)
      expect(name.split(/\s+/).length, k).toBeLessThanOrEqual(2)
    }
  })

  it('locked: grey silhouette + lock + stage code pill, the teaser in the tooltip, nothing that opens a panel', () => {
    const tip = TEASERS[1]
    const html = renderToStaticMarkup(<FounderSlot a={view({ kind: 'salesCall', locked: true, disabled: true, moves: 0, stageName: 'Seed', tip })} />)
    expect(html).not.toContain('border-dashed')
    expect(html).toContain('aria-disabled="true"')
    expect(visibleText(html)).toBe('S')
    expect(html).toContain(tip)
  })

  it('out of moves stays tappable (the engine answers with one word)', () => {
    const html = renderToStaticMarkup(<FounderSlot a={view({ disabled: true, outOfMoves: true })} />)
    expect(html).not.toMatch(/\sdisabled=""/)
    expect(t('error.noMoves').replace(/[.!]$/, '').split(/\s+/)).toHaveLength(1)
  })

  it('every precondition error is one word (§11)', () => {
    for (const [code, text] of Object.entries(ACTION_ERROR_TEXT)) {
      expect(text.replace(/[.!]$/, '').split(/\s+/), code).toHaveLength(1)
    }
  })
})
