import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FounderSlot, SLOT } from '../FounderActions'
import { t } from '../i18n'
import { ViewControls } from './ViewControls'
import { dockFits, keepsMenuOpen, slotSizeForRoom, SLOT_NARROW } from './dockFit'
import bottomBar from './BottomBar.tsx?raw'

describe('founder dock on narrow phones', () => {
  it('picks 44px while the row has room, else the 40px key', () => {
    // 390 wide, Pre-seed on: the measured row is ~310px (island 374 - padding - energy/moves column). Seven slots fit.
    expect(slotSizeForRoom(7, 310)).toBe(SLOT_NARROW)
    expect(dockFits(7, slotSizeForRoom(7, 310), 310)).toBe(true)
    // Garage: five slots keep the 44px key.
    expect(slotSizeForRoom(5, 304)).toBe(SLOT)
  })

  it('a row too narrow even for 40px keys reports scrollable (fade shown)', () => {
    // 360 wide: ~280px of row.
    const room = 280
    expect(dockFits(7, slotSizeForRoom(7, room), room)).toBe(false)
    expect(dockFits(6, slotSizeForRoom(6, room), room)).toBe(true)
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
