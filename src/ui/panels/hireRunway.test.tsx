// N1: the hire offer says what the hire leaves, in words, red under HIRE_RUNWAY_MIN months or a bouncing payday.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t } from '../i18n'
import { HireRunway } from './TeamPanel'

const html = (runwayAfter: number | null, paydayShort = false) =>
  renderToStaticMarkup(createElement(HireRunway, { preview: { runwayNow: 6, runwayAfter, deathDay: null, paydayShort } }))

describe('HireRunway', () => {
  it('"Kasa 5 ay taşır", calm, above the bar', () => {
    const h = html(5.4)
    expect(h).toContain(t('team.runwayAfter', { v: 5 }))
    expect(h).not.toContain('data-danger')
  })
  it('red under 3 months, under one month and on a payday it cannot pay', () => {
    expect(html(2.6)).toContain(t('team.runwayAfter', { v: 2 }))
    expect(html(2.6)).toContain('data-danger')
    expect(html(0.4)).toContain(t('team.runwayUnder1'))
    expect(html(4, true)).toContain(t('team.runwayShort'))
    expect(html(4, true)).toContain('data-danger')
  })
  it('profitable after it: no number', () => {
    expect(html(null)).toContain(t('team.runwayOk'))
  })
})
