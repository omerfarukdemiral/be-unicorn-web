// Project module text: every engine module id has a name and a one-liner; the api portal name is a category override.
import { describe, expect, it } from 'vitest'
import { PROJECT_CATEGORIES, PROJECT_MODULE_IDS } from '../../engine/types'
import { categoryModules } from '../../engine/modules'
import { CATEGORY_MODULE_NAME, MODULE_TEXT, moduleName } from '../modules'
import { UI_TEXT } from '../index'
import { ACTIVITY_TEXT } from '../text'
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
    expect(moduleName('openApi', 'web')).toBe('Public API')
    expect(moduleName('feedback', 'api')).toBe('Geri bildirim')
  })

  it('module, ad focus and effort keys are in UI_TEXT with their placeholders', () => {
    for (const k of ['module.build', 'module.stale', 'bubble.module', 'ads.focus', 'activity.moduleShipped', 'pace.calm', 'team.sprint', 'fx.tag.fatigue', 'bubble.leavingBurnout', 'team.teamOf']) {
      expect(UI_TEXT[k], k).toBeDefined()
    }
    expect(UI_TEXT['bubble.leavingBurnout']).toContain('{d}')
    expect(UI_TEXT['module.lockStage']).toContain('{stage}')
  })

  it('lines have no semicolon, em dash or trailing ellipsis, and names are not lessons', () => {
    for (const id of PROJECT_MODULE_IDS) {
      expect(MODULE_TEXT[id].line, id).not.toMatch(/[;—…]|\.\.\./)
      expect(MODULE_TEXT[id].line.endsWith('.'), id).toBe(true)
      expect(MODULE_TEXT[id].name.length, id).toBeLessThanOrEqual(30)
    }
  })

  it('no two modules share a name inside one category (overrides included)', () => {
    for (const cat of PROJECT_CATEGORIES) {
      const names = categoryModules(cat).map((d) => moduleName(d.id, cat))
      expect(new Set(names).size, `${cat}: ${names.join(', ')}`).toBe(names.length)
    }
  })

  it('category overrides name only ids that exist in that category', () => {
    for (const cat of PROJECT_CATEGORIES) {
      const ids = new Set(categoryModules(cat).map((d) => d.id))
      for (const id of Object.keys(CATEGORY_MODULE_NAME[cat] ?? {})) expect(ids.has(id as never), `${cat}.${id}`).toBe(true)
    }
    expect(moduleName('onboarding', 'game')).toBe('Eğitim bölümü')
    expect(moduleName('referral', 'marketplace')).toBe('Arkadaşını getir')
  })

  it('uses the glossary: Geliştirici, Ekle, Geliştiriliyor, Slot, Churn/CAC/ARPU chips', () => {
    expect(UI_TEXT['module.build']).toBe('Ekle')
    expect(UI_TEXT['module.building']).toBe('Geliştiriliyor')
    expect(UI_TEXT['module.empty']).toBe('Boş slot')
    expect([UI_TEXT['module.tag.churn'], UI_TEXT['module.tag.cac'], UI_TEXT['module.tag.arpu']]).toEqual(['Churn', 'CAC', 'ARPU'])
    expect(ACTIVITY_TEXT.moduleStarted).toContain('geliştiriliyor')
  })

  it('every version / slot / estimate / measured / lock / relation key exists with its params, none empty', () => {
    const need: Record<string, string[]> = {
      'module.version': ['{v}'], 'module.toVersion': ['{v}', '{p}'], 'module.slots': ['{used}', '{total}'],
      'module.slotsOpen': ['{v}'], 'module.slotsPreview': ['{p}'], 'module.buildingEta': ['{module}', '{d}'],
      'module.allTier': ['{v}'], 'module.est.users': ['{n}'], 'module.est.money': ['{v}'], 'module.est.tam': ['{n}'],
      'module.est.wave': ['{n}'], 'module.est.fast': ['{p}'], 'module.est.talk': ['{n}'], 'module.est.rent': ['{v}'],
      'module.rel.synergy': ['{module}', '{p}'], 'module.rel.requires': ['{module}'], 'module.rel.excluded': ['{module}'],
      'module.rel.tier': ['{v}'], 'module.lockRequires': ['{module}'], 'module.lockExcluded': ['{module}'],
      'module.measured.acq': ['{d}', '{x}', '{y}'], 'module.measured.acqDone': ['{x}', '{y}'], 'module.measured.acqNew': ['{d}', '{x}'],
      'module.measured.lost': ['{d}', '{x}', '{y}'], 'module.measured.lostDone': ['{x}', '{y}'], 'module.measured.lostNew': ['{d}', '{x}'],
      'module.measured.rev': ['{d}', '{x}', '{y}'], 'module.measured.revDone': ['{x}', '{y}'], 'module.measured.revNew': ['{d}', '{x}'],
      'module.measured.infra': ['{x}'], 'module.measured.every': ['{a}', '{b}'], 'module.measured.every1': ['{a}'],
      'release.moduleUsers': ['{module}', '{u}'], 'release.version': ['{project}', '{v}'], 'bubble.moduleVersion': ['{project}', '{v}', '{module}'],
      'module.est.rentBig': [], 'module.est.none': [],
    }
    for (const k of ['organicZero', 'noAds', 'capped', 'noUsers', 'gapBound']) need[`module.est.why.${k}`] = []
    for (const [k, params] of Object.entries(need)) {
      expect(UI_TEXT[k], k).toBeTruthy()
      for (const p of params) expect(UI_TEXT[k], `${k} ${p}`).toContain(p)
    }
    expect(UI_TEXT['module.est.rentBig']).toBe('Kira kazançtan büyük')
    expect(UI_TEXT['module.est.none']).toBe('Şu an etkisi yok')
  })

  it('measured lines stay short (≤ 8 words with numbers)', () => {
    for (const k of Object.keys(UI_TEXT).filter((x) => x.startsWith('module.measured.'))) {
      expect(wordCount(UI_TEXT[k]!), k).toBeLessThanOrEqual(8)
    }
  })
})
