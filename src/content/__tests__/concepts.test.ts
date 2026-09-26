import { describe, expect, it } from 'vitest'
import { CONCEPT_IDS, HUD_WIDGETS, TOOL_IDS } from '../../engine/types'
import { CONCEPTS } from '../concepts'
import { CONCEPT_TITLE } from '../strings'
import { makeBusyState, makeState, wordCount } from './fixture'
import planMd from '../../../docs/PLAN.md?raw'

// PLAN §6.2 bubble texts, verbatim (rewritten per docs/VOICE.md).
const PLAN_BUBBLES: Record<string, string> = {
  runway: 'Bu parayla kaç ay dayanırız, hiç hesapladın mı?',
  burn: 'Geçen ay bu kadar para yakmıyorduk. Ne değişti?',
  'dont-scale': 'Onları tek tek kendin buldun. Neden geldiklerini sordun mu?',
  pmf: 'Denedim, fena değil ama bir daha açmadım açıkçası.',
  focus: 'Yeni projeye mi geçiyoruz abi? Öbürü ne olacak?',
  'default-alive': 'Yatırımcı hiç gelmese, bu gidişle kâra geçer misin?',
  dilution: 'Parayı getiririm, karşılığında şirketinden biraz isterim. Adil, değil mi?',
  safe: 'Parayı bugün vereyim, fiyatı sonraki turda konuşuruz. Anlaştık mı?',
  'fundraise-time': 'Tur başladı. Para gelene kadar kasa dayanır mı, baktın mı?',
  'hire-bar': 'Ekip büyüyor abi. Hepsi gerçekten iyi mi, yoksa acele mi ettik?',
  'morale-compounds': 'Ekip bitik abi, bu tempoyla daha ne kadar gideriz?',
  churn: 'Bir ay kullandım, sonra bıraktım. Neden diye soran olmadı.',
  pricing: 'Bu fiyata mı? Açıkçası iki katını da verirdim.',
  'feature-vs-product': 'Yeni proje mi açtın? Elimizdekine eklesek olmaz mıydı?',
  'premature-scaling': 'Masalar doldu, maaşlar arttı, kullanıcı hâlâ bir avuç, abi.',
  'ltv-cac': 'Her kullanıcıya reklam parası saydık. Gidene kadar bunu çıkarır mı?',
  'organic-vs-paid': 'Reklamı bir hafta kapatsan kaç kişi yine gelir?',
  'tech-debt': 'Aceleyle yazdığımız kod şimdi her işte ayağıma dolanıyor.',
  'ten-x-myth': 'Yıldızımız yarın giderse bu işi başka bilen var mı?',
  'culture-freezes': 'Kalabalıklaştık abi, yeni gelenler bizi taklit ediyor.',
  concentration: 'En büyük müşterinin sözleşmesi bittiği gün gelir bir kalemde düşer.',
  compliance: 'Verilerim nerede duruyor? Belgeyi görmeden imza atmam.',
  trough: 'İki aydır grafik dümdüz. Şimdi neyi değiştireceksin?',
  'cap-table-health': 'Şirketin kaçta kaçı hâlâ senin, en son ne zaman baktın?',
  'no-single-path': 'Tarzın belli oldu. Rakibin başka yoldan gidiyor, sence kim yanlış?',
  'founder-burnout': 'Hiç durmadın. Bir gün de biz bakalım şirkete.',
  'failure-is-data': 'Kapandı. Otur bakalım, neyi farklı yapardın?',
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

// docs/VOICE.md §3 budgets and §4 forbidden patterns, locked.
describe('concept cards follow docs/VOICE.md', () => {
  // A spread of states so every where() branch is exercised with realistic numbers.
  const voiceStates = [
    makeState(),
    makeBusyState(),
    makeState((s) => (s.time.day = 10)),
    // Profitable, cash not burning.
    makeState((s) => {
      s.stats.users = 800
      s.stats.arpu = 6
      s.finance.mrr = 4800
      s.finance.burn = 3000
      s.finance.net = 1800
      s.finance.runway = null
      s.archetype = 'bootstrap'
    }),
    // Nearly broke, revenue coming in.
    makeState((s) => {
      s.stats.cash = 900
      s.finance.mrr = 1200
      s.finance.burn = 6000
      s.finance.net = -4800
      s.finance.runway = 0.19
      s.archetype = 'bootstrap'
    }),
    // Tight round: cash runs out before the round closes, customer contract with an end date.
    makeState((s) => {
      Object.assign(s, makeBusyState())
      s.finance.runway = 2.1
      s.round = { ...s.round!, weeksLeft: 7 }
      s.finance.enterpriseCustomers = [
        { id: 'c1', name: 'Karadeniz Denizcilik', mrr: 900_000, sinceDay: 700, untilDay: 900 },
        { id: 'c2', name: 'Anadolu Lojistik', mrr: 300_000, sinceDay: 720, untilDay: 1000 },
      ]
      s.archetype = 'platform'
      s.gameOver = { kind: 'teamLost', day: 845.5, reasons: ['burn', 'churn'] as never, xpEarned: 1 }
      s.decisions.history = []
      s.decisions.pending = [{ id: 'd1', applyDay: 900, effects: {}, sourceCardId: 'angel-1' } as never]
    }),
    // Round with a comfortable margin, niche founder, unicorn end.
    makeState((s) => {
      Object.assign(s, makeBusyState())
      s.finance.runway = 9
      s.stats.morale = 78
      s.derived.moraleTarget = 64
      s.archetype = 'niche'
      s.employees = []
      s.flags = { starHire: true }
      s.gameOver = { kind: 'unicorn', day: 1200, reasons: [], xpEarned: 9 }
      s.counters = { manualFinds: 3, userTalks: 2, roundsClosed: 3 }
    }),
    // Two parallel projects in the garage, morale recovering.
    makeState((s) => {
      s.stats.morale = 35
      s.derived.moraleTarget = 55
      s.derived.teamSize = 3
      s.counters = { userTalks: 4, lowGrowthMonths: 0 }
      s.gameOver = undefined
      s.concepts.learned = []
      s.projects = [
        { id: 'p1', name: 'Pusula', category: 'web', size: 1, maturity: 0.3, launched: false, createdDay: 1, assignedIds: [] },
        { id: 'p2', name: 'Kovan', category: 'ai', size: 1, maturity: 0.1, launched: false, createdDay: 9, assignedIds: [] },
      ]
    }),
  ]

  const title = (id: string) => CONCEPT_TITLE[id as keyof typeof CONCEPT_TITLE]

  it.each(CONCEPTS.map((c) => [c.id, c] as const))('%s: title ≤ 4, bubble ≤ 12, Ne? ≤ 16, Kural ≤ 10 words', (id, c) => {
    expect(wordCount(title(id))).toBeLessThanOrEqual(4)
    expect(wordCount(c.bubble)).toBeLessThanOrEqual(12)
    expect(wordCount(c.card.what)).toBeLessThanOrEqual(16)
    expect(wordCount(c.card.rule)).toBeLessThanOrEqual(10)
  })

  it.each(CONCEPTS.map((c) => [c.id, c] as const))('%s: "Sen nerede gördün?" ≤ 18 words, total ≤ 50, no broken values', (_id, c) => {
    for (const s of voiceStates) {
      const where = c.card.where(s)
      expect(where.trim().length).toBeGreaterThan(0)
      expect(where).not.toMatch(/undefined|NaN|Infinity|null|\[object/)
      expect(wordCount(where), where).toBeLessThanOrEqual(18)
      expect(wordCount(c.card.what) + wordCount(where) + wordCount(c.card.rule)).toBeLessThanOrEqual(50)
    }
  })

  // VOICE §4. Matched on Turkish-lowercased text; letters around a stem are Unicode-aware.
  const L = '\\p{L}'
  const stem = (w: string) => new RegExp(`(?<!${L})${w}`, 'u')
  const word = (w: string) => new RegExp(`(?<!${L})${w}(?!${L})`, 'u')
  const FORBIDDEN: readonly [string, RegExp][] = [
    ['"… en iyi öğretmendir"', /en iyi öğretmen/u],
    ['"… her şeydir"', /her şeydir/u],
    ['"Unutma ki"', stem('unutma ki')],
    ['"Önemli olan"', stem('önemli olan')],
    ['"… anahtarıdır"', stem('anahtar')],
    ['"kilit rol"', /kilit rol/u],
    ['"altın kural"', /altın kural/u],
    ['"-e sahip"', stem('sahip ol')],
    ['"… açısından"', stem('açısından')],
    ['"bir … olarak"', word('olarak')],
    ['"… tarafından"', word('tarafından')],
    ['pasif ders dili', word('(kazanılır|edilir|denir|yapılır|bilinir)')],
    ['genel özne', stem('(şirketler|girişimci|insanlar?)(?!' + L + ')')],
    ['"olmadan … olmaz"', word('olmadan')],
    ['okul havası', stem('(ders(?!' + L + ')|dersler|öğrendin|kazanım)')],
    ['metafor / oyunda olmayan şey', stem('(tasma|pusula|patika|vadi|tedarikçi|masada bırak)')],
    ['kitap hükmü "… bileşik getiri"', /bileşik getiri/u],
    ['"…, … de öyle"', /de öyle\b/u],
  ]
  const lines = CONCEPTS.flatMap((c) => [
    [c.id, 'title', title(c.id)],
    [c.id, 'bubble', c.bubble],
    [c.id, 'what', c.card.what],
    [c.id, 'rule', c.card.rule],
    ...voiceStates.map((s, i) => [c.id, `where#${i}`, c.card.where(s)]),
  ]) as [string, string, string][]

  it.each(FORBIDDEN)('never uses %s', (_label, re) => {
    const hits = lines.filter(([, , t]) => re.test(t.toLocaleLowerCase('tr'))).map(([id, f, t]) => `${id}.${f}: ${t}`)
    expect(hits).toEqual([])
  })

  it('Ne? is not a dictionary entry ("Terim: açıklama.")', () => {
    for (const c of CONCEPTS) expect(c.card.what, c.id).not.toMatch(/^\S+(\s\S+)?:\s/u)
  })

  it('Kural ends with an action or a threshold, not an aphorism', () => {
    for (const c of CONCEPTS) {
      expect(c.card.rule, c.id).toMatch(/\.$/)
      expect(c.card.rule, c.id).not.toMatch(/(normaldir|görevdir|yakalamaktır|gücüdür|kırıktır|anahtarıdır|birikir)\.$/u)
    }
  })

  it('PLAN.md §6.2 carries the same bubble and rule for every concept', () => {
    const rows = new Map<string, [string, string]>()
    for (const line of planMd.split('\n')) {
      const m = line.match(/^\| `([a-z0-9-]+)` \| [^|]+ \| "([^"]+)" \| ([^|]+?) \|/)
      if (m) rows.set(m[1]!, [m[2]!, m[3]!])
    }
    for (const c of CONCEPTS) expect(rows.get(c.id), c.id).toEqual([c.bubble, c.card.rule])
  })
})
