// Project module text: every engine module id has a name and a one-liner; the api portal name is a category override.
import { describe, expect, it } from 'vitest'
import { PROJECT_MODULE_IDS } from '../../engine/types'
import { MODULE_TEXT, moduleName } from '../modules'
import { UI_TEXT } from '../index'
import { wordCount } from './fixture'

describe('module text', () => {
  it('has a name and a one-liner for every module id, and no extra ids', () => {
    expect(Object.keys(MODULE_TEXT).sort()).toEqual([...PROJECT_MODULE_IDS].sort())
    for (const id of PROJECT_MODULE_IDS) {
      expect(MODULE_TEXT[id].name, id).toBeTruthy()
      expect(MODULE_TEXT[id].line, id).toBeTruthy()
    }
  })

  it('one-liners are one sentence of ≤ 10 words', () => {
    for (const id of PROJECT_MODULE_IDS) {
      expect(wordCount(MODULE_TEXT[id].line), id).toBeLessThanOrEqual(10)
      expect(MODULE_TEXT[id].line.match(/[.!?]/g)?.length ?? 0, id).toBe(1)
    }
  })

  it('api projects call openApi by the portal name', () => {
    expect(moduleName('openApi', 'api')).toBe('Geliştirici portalı')
    expect(moduleName('openApi', 'web')).toBe('Açık API')
    expect(moduleName('feedback', 'api')).toBe('Geri bildirim döngüsü')
  })

  it('module, ad focus and effort keys are in UI_TEXT with their placeholders', () => {
    for (const k of ['module.build', 'module.stale', 'bubble.module', 'ads.focus', 'activity.moduleShipped', 'pace.calm', 'team.sprint', 'fx.tag.fatigue', 'bubble.leavingBurnout', 'team.teamOf']) {
      expect(UI_TEXT[k], k).toBeDefined()
    }
    expect(UI_TEXT['bubble.leavingBurnout']).toContain('{d}')
    expect(UI_TEXT['module.lockStage']).toContain('{stage}')
  })
})
