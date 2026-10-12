// 44px touch targets key off the POINTER, not the viewport: an 844px landscape phone is wider than Tailwind's md
// breakpoint but still a thumb, so `max-md:min-h-11` left it with 32-36px targets. (Node environment, server render.)
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InfoTip } from './InfoTip'
import { Button, Chip, Segmented } from './primitives'

// Every non-test component under src/ui, as text.
const files = import.meta.glob(['./**/*.tsx', '!./**/*.test.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('touch targets', () => {
  it('no viewport-keyed 44px rule is left in src/ui', () => {
    const bad = Object.keys(files).filter((f) => /max-md:min-[hw]-11/.test(files[f]!))
    expect(bad).toEqual([])
  })

  it('a small Button grows to 44px on a coarse pointer', () => {
    const out = renderToStaticMarkup(createElement(Button, { tone: 'routine', size: 'sm' }, 'Ata'))
    expect(out).toContain('pointer-coarse:min-h-11')
  })

  it('Segmented chips grow to 44px on a coarse pointer', () => {
    const out = renderToStaticMarkup(createElement(Segmented, { label: 'x', children: createElement(Chip, { segment: true, active: true }, 'A') }))
    expect(out).toContain('pointer-coarse:min-h-11')
    expect(renderToStaticMarkup(createElement(Chip, null, 'B'))).toContain('pointer-coarse:min-h-11')
  })

  it('the InfoTip keeps its 14px glyph and gets a 44px hit area on a coarse pointer', () => {
    const out = renderToStaticMarkup(createElement(InfoTip, null, 'x'))
    expect(out).toContain('pointer-coarse:before:-inset-4')
    expect(out).toContain('width="14"')
  })
})
