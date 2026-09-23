import { describe, expect, it } from 'vitest'
import { CONCEPT_IDS, HUD_WIDGETS, TOOL_IDS } from '../../engine/types'
import { CONCEPTS } from '../concepts'
import { CONCEPT_TITLE } from '../strings'
import { makeBusyState, makeState, wordCount } from './fixture'

// PLAN §6.2 bubble texts, verbatim.
const PLAN_BUBBLES: Record<string, string> = {
  runway: 'Bu parayla kaç ay dayanırız, hiç hesapladın mı?',
  burn: 'Her yeni kişi aylık yakıtı artırıyor, fark ettin mi?',
  'dont-scale': 'İlk kullanıcılar tek tek kazanılır, reklamla değil.',
  pmf: 'Geliyorlar ama kalmıyorlar, ürün henüz tutmuyor.',
  focus: 'İki işi yarım yapmak, bir işi bitirmekten yavaş.',
  'default-alive': 'Yatırım almasak bu gidişle kâra geçer miyiz?',
  dilution: 'Para güzel ama o yüzde bir daha geri gelmez.',
  safe: 'Değerlemeyi şimdi değil sonraki turda konuşuruz diyor.',
  'fundraise-time': 'Tur haftalar sürer, kasa beklemez.',
  'hire-bar': 'Hızlı almak kolay, yanlış kişiyi çıkarmak zor.',
  'morale-compounds': 'Ekip yorgun, bu hız kendini yiyor.',
  churn: 'Her ay giden kullanıcılar sessizce büyümeyi yiyor.',
  pricing: 'Ürün değerli ama fiyatı korkarak koymuşuz.',
  'feature-vs-product': 'Bu ayrı bir ürün mü, mevcut ürüne özellik mi?',
  'premature-scaling': 'Kalabalıklaştık ama kimse ne yapacağını bilmiyor.',
  'ltv-cac': 'Bir kullanıcıyı kaça alıyoruz, bize kaç kazandırıyor?',
  'organic-vs-paid': 'Reklamı kesersek büyüme de duruyor mu?',
  'tech-debt': 'Hızlı yazdık, şimdi her şey yavaşlıyor.',
  'ten-x-myth': 'Tek bir dahi, sistemin yerini tutmaz.',
  'culture-freezes': 'İlk 20 kişide kültür donar.',
  concentration: 'Bu müşteri giderse gelirin üçte biri gider.',
  compliance: 'Büyük müşteri önce güvenlik belgesi soruyor.',
  trough: 'Heyecan bitti, sonuç henüz yok.',
  'cap-table-health': 'Kontrol kimde, hiç baktın mı?',
  'no-single-path': 'Senin yolun belli oldu, tek doğru yol bu değil.',
  'founder-burnout': 'Sen tükenirsen şirket de tükenir.',
  'failure-is-data': 'Bu bir veri noktası, kimlik değil.',
}

const states = [makeState(), makeBusyState()]

describe('concepts', () => {
  it('covers exactly the 27 PLAN concept ids, in order', () => {
    expect(CONCEPTS.map((c) => c.id)).toEqual([...CONCEPT_IDS])
    expect(CONCEPTS).toHaveLength(27)
  })

  it('has one Defter title per concept', () => {
    for (const id of CONCEPT_IDS) expect(CONCEPT_TITLE[id]).toBeTruthy()
  })

  it.each(CONCEPTS.map((c) => [c.id, c] as const))('%s: bubble matches PLAN and is ≤ 12 words', (id, c) => {
    expect(c.bubble).toBe(PLAN_BUBBLES[id])
    expect(wordCount(c.bubble)).toBeLessThanOrEqual(12)
  })

  it.each(CONCEPTS.map((c) => [c.id, c] as const))('%s: card is ≤ 50 words with player data', (_id, c) => {
    for (const s of states) {
      const where = c.card.where(s)
      expect(where.length).toBeGreaterThan(0)
      expect(where).not.toMatch(/undefined|NaN|Infinity/)
      const total = wordCount(c.card.what) + wordCount(where) + wordCount(c.card.rule)
      expect(total).toBeLessThanOrEqual(50)
    }
  })

  it('triggers are pure boolean functions that tolerate empty and busy states', () => {
    for (const c of CONCEPTS) {
      for (const s of states) {
        const snapshot = JSON.stringify(s)
        expect(typeof c.trigger(s)).toBe('boolean')
        expect(JSON.stringify(s)).toBe(snapshot)
      }
    }
  })

  it('does not fire anything on a fresh garage state', () => {
    const fired = CONCEPTS.filter((c) => c.trigger(makeState())).map((c) => c.id)
    expect(fired).toEqual([])
  })

  it('fires runway on day 10 and burn a month after the first hire', () => {
    const runway = CONCEPTS.find((c) => c.id === 'runway')!
    const burn = CONCEPTS.find((c) => c.id === 'burn')!
    expect(runway.trigger(makeState((s) => (s.time.day = 10)))).toBe(true)
    expect(burn.trigger(makeState((s) => ((s.flags.firstHireDay = 5), (s.time.day = 20))))).toBe(false)
    expect(burn.trigger(makeState((s) => ((s.flags.firstHireDay = 5), (s.time.day = 36))))).toBe(true)
  })

  it('unlocks only valid widgets or tools, and shelf colors are hex', () => {
    const valid = new Set<string>([...HUD_WIDGETS, ...TOOL_IDS])
    for (const c of CONCEPTS) {
      for (const u of c.unlocks === undefined ? [] : typeof c.unlocks === 'string' ? [c.unlocks] : c.unlocks) expect(valid.has(u)).toBe(true)
      expect(c.shelfColor).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

// Defter shelf (docs/DESIGN.md): learned spines are one pastel-saturated family with ink text on top,
// so every shelfColor must be light enough for ink (#1f1d24) at AA (>= 4.5:1). No greys, no near-black.
describe('shelfColor', () => {
  const lum = (hex: string) => {
    const h = hex.replace('#', '')
    const [r, g, b] = [0, 2, 4].map((i) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const INK = lum('#1f1d24')
  it.each(CONCEPTS.map((c) => [c.id, c.shelfColor] as const))('%s spine %s reads with ink text (AA)', (_id, color) => {
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect((lum(color) + 0.05) / (INK + 0.05)).toBeGreaterThanOrEqual(4.5)
    const h = color.slice(1)
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    // Saturation proxy: a spine is a colour, not a grey.
    expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeGreaterThanOrEqual(40)
  })
})
