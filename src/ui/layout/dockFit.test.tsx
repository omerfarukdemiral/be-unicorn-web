import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FounderSlot, SLOT } from '../FounderActions'
import { t } from '../i18n'
import { ViewControls } from './ViewControls'
import { dockFits, keepsMenuOpen, NARROW_PHONE_W, slotSizeFor, SLOT_NARROW } from './dockFit'
import bottomBar from './BottomBar.tsx?raw'

describe('founder dock on narrow phones', () => {
  it('shrinks the slot to 40px at <= 375 wide, 44px above', () => {
    expect(slotSizeFor(360)).toBe(SLOT_NARROW)
    expect(slotSizeFor(NARROW_PHONE_W)).toBe(40)
    expect(slotSizeFor(390)).toBe(SLOT)
  })

  it('at 360 wide every slot fits or the row reports scrollable (fade shown)', () => {
    // Pill 360 - 16 (island padding) - energy/moves/divider (~120) leaves ~224 for the row.
    const room = 224
    for (let n = 1; n <= 10; n++) {
      const fits = dockFits(n, slotSizeFor(360), room)
      // Not fitting == scrollable; the 40px slot fits at least one more than the 44px one.
      expect(fits || n * 40 + (n - 1) * 4 > room).toBe(true)
      if (dockFits(n, 44, room)) expect(fits).toBe(true)
    }
    expect(dockFits(5, 40, room)).toBe(true)
    expect(dockFits(7, 40, room)).toBe(false)
  })

  it('a 40px slot keeps a 44px hit area', () => {
    const view = { kind: 'rest', name: 'x', label: 'x', locked: false, disabled: false, running: false, moves: 0 } as never
    const small = renderToStaticMarkup(createElement(FounderSlot, { a: view, size: 40 }))
    expect(small).toContain('width:40px;height:40px')
    expect(small).toContain('before:-inset-0.5')
    expect(renderToStaticMarkup(createElement(FounderSlot, { a: view }))).not.toContain('before:-inset-0.5')
  })
})

describe('phone More menu zoom', () => {
  it('ViewControls with showZoom renders zoom out / in, without it does not', () => {
    const on = renderToStaticMarkup(createElement(ViewControls, { size: 44, showZoom: true }))
    expect(on).toContain(t('view.zoomOut'))
    expect(on).toContain(t('view.zoomIn'))
    expect(renderToStaticMarkup(createElement(ViewControls, { size: 44, showZoom: false }))).not.toContain(t('view.zoomIn'))
  })

  it('zoom steppers keep the More menu open, other picks close it', () => {
    const labels = [t('view.zoomOut'), t('view.zoomIn')]
    const mk = (l: string) => ({ closest: () => ({ getAttribute: () => l }) }) as unknown as EventTarget
    expect(keepsMenuOpen(mk(t('view.zoomIn')), labels)).toBe(true)
    expect(keepsMenuOpen(mk(t('view.zoomOut')), labels)).toBe(true)
    expect(keepsMenuOpen(mk(t('settings.title')), labels)).toBe(false)
    expect(keepsMenuOpen(null, labels)).toBe(false)
  })

  it('the phone MoreMenu uses the same ViewControls with zoom on', () => {
    expect(bottomBar).toMatch(/<ViewControls size=\{44\} showZoom \/>/)
  })
})
