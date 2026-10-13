// Scene bubbles (scene-first spec §2, §4), rendered to a string (node environment, no DOM): collapsed first, the
// store's open key expands one in place and holds the world, acting resumes it, Esc closes it, chips name their target.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { effectiveSpeed, useGameStore } from '../../store/gameStore'
import { escapeBubble } from '../shortcuts'
import { DecisionWorldBubble, pillLine } from './DecisionWorldBubble'
import { DeskBubble, PAY_ALL } from './DeskBubble'
import { pitchChips } from '../pitch'
import { closeBubble, launch, openBubble } from './Expandable'
import { ReflectionBubble } from './ReflectionBubble'
import { PersonBubble } from './PersonBubble'
import { StaffBubble } from './StaffBubble'
import { renderWorldBubble } from './worldBubble'
import { company } from '../../engine/__tests__/moduleFixtures'
import { moduleAsk } from '../../engine/modules'
import { MODULE_TEXT, moduleName } from '../../content'
import type { Employee } from '../../engine/types'

const store = () => useGameStore.getState()
const CARD = 'remote-vs-office'
const KEY = `decision:${CARD}`

/** Puts the sample card on the table (the engine's own active-card slot). */
function withDecision(): void {
  const st = store().state
  useGameStore.setState({ state: { ...st, decisions: { ...st.decisions, active: { cardId: CARD, shownDay: st.time.day } } } })
}

/** Server render of the CURRENT store: zustand's server snapshot reads the initial state, so it is swapped in. */
function html(el: Parameters<typeof renderToStaticMarkup>[0]): string {
  const initial = useGameStore.getInitialState()
  const keep = { state: initial.state, ui: initial.ui }
  Object.assign(initial, { state: store().state, ui: store().ui })
  try {
    return renderToStaticMarkup(el)
  } finally {
    Object.assign(initial, keep)
  }
}
const decision = () => html(createElement(DecisionWorldBubble, { bubbleKey: KEY, cardId: CARD, role: 'cofounder' }))

beforeEach(() => {
  store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
  store().dispatch({ type: 'setSpeed', speed: 2 })
})

describe('expandable scene bubble', () => {
  it('starts collapsed: one pill with the question, no options', () => {
    const out = decision()
    expect(out).toContain('data-bubble="decision"')
    expect(out).toContain('data-open="false"')
    expect(out).toContain('Ekip uzaktan çalışmak istiyor')
    expect(out).not.toContain('Hibrit çalışalım')
  })

  it('a tap opens it with its key and holds the world without touching time.speed', () => {
    openBubble(KEY)
    expect(store().ui.bubbleOpen).toBe(KEY)
    expect(store().ui.pauseReasons).toContain('bubble')
    expect(effectiveSpeed(store())).toBe(0)
    expect(store().state.time.speed).toBe(2)
  })

  it('on a phone the open bottom sheet closes first', () => {
    store().openPanel({ kind: 'team' })
    openBubble(KEY, true)
    expect(store().ui.panel).toBeNull()
    expect(store().ui.bubbleOpen).toBe(KEY)
  })

  it('expanded: options stacked as rows, each chip names what it moves', () => {
    openBubble(KEY)
    const out = decision()
    expect(out).toContain('data-open="true"')
    expect(out).toContain('Hibrit çalışalım')
    expect(out).toContain('Ofiste kalalım')
    // "Moral +6", "Hız −%5 30g": a one-word target in front of every number.
    expect(out).toContain('Moral')
    expect(out).toContain('Hız')
    expect(out).toContain('30g')
  })

  it('choosing answers the card, closes the bubble and resumes at the previous speed', () => {
    withDecision()
    openBubble(KEY)
    expect(store().dispatch({ type: 'answerDecision', cardId: CARD, optionIndex: 0 }).ok).toBe(true)
    expect(store().ui.bubbleOpen).toBeNull()
    expect(store().ui.pauseReasons).not.toContain('bubble')
    expect(effectiveSpeed(store())).toBe(2)
  })

  it('a manual pause stays paused after the bubble closes', () => {
    store().dispatch({ type: 'setSpeed', speed: 0 })
    openBubble(KEY)
    closeBubble()
    expect(store().ui.bubbleOpen).toBeNull()
    expect(effectiveSpeed(store())).toBe(0)
  })

  it('Esc closes the open bubble first and reports it handled', () => {
    openBubble(KEY)
    expect(escapeBubble()).toBe(true)
    expect(store().ui.bubbleOpen).toBeNull()
    expect(escapeBubble()).toBe(false)
  })

  it('a launcher closes the bubble before the deeper view opens', () => {
    openBubble('desk:hire')
    launch(() => store().openPanel({ kind: 'team' }))
    expect(store().ui.bubbleOpen).toBeNull()
    expect(store().ui.panel?.kind).toBe('team')
  })
})

describe('routed bubbles', () => {
  it('reflection: "Seçtin" + the chosen option chips, never a button', () => {
    const out = html(createElement(ReflectionBubble, { cardId: CARD, optionIndex: 1 }))
    expect(out).toContain('Seçtin: Ofiste kalalım')
    expect(out).toContain('Moral')
    expect(out).not.toContain('<button')
  })

  it('desk hire: candidates as rows with a Maaş chip', () => {
    const c = store().state.candidates[0]
    if (!c) return
    openBubble('desk:hire')
    const out = html(createElement(DeskBubble, { bubbleKey: 'desk:hire', topic: 'hire' }))
    expect(out).toContain(c.name)
    expect(out).toContain('Maaş')
  })

  it('desk project: one tile per category', () => {
    openBubble('desk:project')
    const out = html(createElement(DeskBubble, { bubbleKey: 'desk:project', topic: 'project' }))
    expect(out.match(/<button/g)?.length ?? 0).toBeGreaterThanOrEqual(6 + 1)
  })

  it('desk founder actions: rows with an energy chip', () => {
    openBubble('desk:actions')
    const out = html(createElement(DeskBubble, { bubbleKey: 'desk:actions', topic: 'actions' }))
    expect(out).toContain('Enerji')
  })

  it('a pitch reads Teklif / Süre / Hisse / Enerji', () => {
    const chips = pitchChips({ pitch: 'coinvestor', delta: 0, weeks: 2, equity: 0.05, energy: 10, ok: true })
    expect(chips.map((c) => c.label)).toEqual(['Süre', 'Hisse', 'Enerji'])
    const story = pitchChips({ pitch: 'story', delta: 0.02, min: -0.05, max: 0.1, weeks: 0, equity: 0, energy: 0, ok: true })
    // The story's gamble as two whole-percent chips (a "−%3.4…+%6.6" range read as noise).
    expect(story.map((c) => [c.label, c.text])).toEqual([['Teklif', '+%10'], ['Risk', '−%5']])
    const odd = pitchChips({ pitch: 'story', delta: 0.016, min: -0.034, max: 0.066, weeks: 0, equity: 0, energy: 0, ok: true })
    expect(odd.map((c) => c.text)).toEqual(['+%7', '−%3'])
  })

  it('a renewal with no moves left says why in the bubble and keeps a working close', () => {
    const st = store().state
    const renewals = [{ id: 'ent1', name: 'Acme', mrr: 1000, untilDay: st.time.day + 20, holdChance: 0.7, holdMrr: 1150, discountMrr: 850, error: 'noMoves' as const }]
    useGameStore.setState({ state: { ...st, derived: { ...st.derived, renewals, moves: { left: 0, total: 4, resetDay: st.time.day + 3 } } } })
    const key = 'desk:renewal:ent1'
    openBubble(key)
    const out = html(createElement(DeskBubble, { bubbleKey: key, topic: 'renewal', refId: 'ent1' }))
    expect(out).toContain('Hamle yok · yeni hafta 3g')
    expect(out).toContain('Kapat')
    closeBubble()
    expect(store().ui.pauseReasons).not.toContain('bubble')
  })

  it('"Hepsini öde" is every line paid', () => {
    expect(PAY_ALL).toEqual({ salaries: 'full', rent: 'pay', infra: 'pay', ads: 'pay', founder: 'pay' })
  })

  it('a short payday answers in the scene: the default order, the cash-keeping answer and the desk', () => {
    const st = store().state
    useGameStore.setState({
      state: {
        ...st,
        stats: { ...st.stats, cash: 1_000 },
        finance: { ...st.finance, pendingPayday: { day: 30, ledger: { revenue: 0, salaries: 3_000, rent: 500, infra: 200, ads: 300, founder: 400 }, deferredBefore: 0 } },
      },
    })
    openBubble('desk:payday')
    const out = html(createElement(DeskBubble, { bubbleKey: 'desk:payday', topic: 'payday' }))
    expect(out).toContain('Sırayla öde')
    expect(out).toContain('Kasayı koru')
    // The desk is the header's (i) only, not a third answer row nor a second "Detay" link.
    expect(out).toContain('aria-label="Detay"')
    expect(out).not.toContain('>Detay<')
    expect(out).not.toContain('>Masa<')
    expect(out).not.toContain('Hepsini öde')
    // Every answer says what it leaves: cash left and what stays owed.
    expect(out.match(/Kalan/g)?.length).toBe(2)
    expect(out).toContain('Borç')
  })

  it('open, a desk bubble keeps its line as the header topic; a decision names only its speaker', () => {
    const c = store().state.candidates[0]
    if (c) {
      openBubble('desk:hire')
      const out = html(createElement(DeskBubble, { bubbleKey: 'desk:hire', topic: 'hire' }))
      expect(out).toContain('aday bekliyor')
    }
    openBubble(KEY)
    // The question is the body's first line; the header does not repeat it.
    expect(decision().match(/>Ekip uzaktan çalışmak istiyor/g)?.length).toBe(1)
  })

  it('a collapsed pill grows to 44px under a thumb', () => {
    expect(decision()).toContain('pointer-coarse:min-h-11')
  })

  it('a reflection with nothing visible shows no lone "?"', () => {
    const out = html(createElement(ReflectionBubble, { cardId: 'angel-lifeline', optionIndex: 1 }))
    expect(out).toContain('Seçtin: Kendi yolunu bul')
    expect(out).not.toContain('>?<')
  })

  it('round window: a down round adds a launcher row into the panel', () => {
    const st = store().state
    const sizes = [{ size: 'target' as const, months: 12, amount: 1e6, offer: 1e6, equity: 0.1 }]
    const round = { ...(st.derived.round ?? {}), sizes, downRound: true } as typeof st.derived.round
    useGameStore.setState({ state: { ...st, derived: { ...st.derived, round, canStartRound: true } } })
    openBubble('desk:round')
    const out = html(createElement(DeskBubble, { bubbleKey: 'desk:round', topic: 'round' }))
    expect(out).toContain('Hedef')
    expect(out).toContain('Down round')
    // Window shut: the down round alone keeps its row (sizes need the window).
    useGameStore.setState({ state: { ...st, derived: { ...st.derived, round, canStartRound: false } } })
    const shut = html(createElement(DeskBubble, { bubbleKey: 'desk:round', topic: 'round' }))
    expect(shut).not.toContain('Hedef')
    expect(shut).toContain('Down round')
  })

  it('idle staff: one "Projeye ata" caption over the open projects', () => {
    store().dispatch({ type: 'startProject', category: 'web' })
    const st = store().state
    const p = st.projects[0]
    const e = { ...(st.employees[0] ?? st.candidates[0]!), id: 'e-test', status: 'working' } as unknown as (typeof st.employees)[number]
    useGameStore.setState({ state: { ...st, employees: [...st.employees, e] } })
    openBubble('staff:e-test')
    const out = html(createElement(StaffBubble, { bubbleKey: 'staff:e-test', employeeId: 'e-test', need: 'idle' }))
    expect(out).toContain('Projeye ata')
    expect(out).toContain(p?.name ?? '')
  })

  it('a missing payday / round draws nothing; concepts draw nothing', () => {
    expect(html(createElement(DeskBubble, { bubbleKey: 'desk:payday', topic: 'payday' }))).toBe('')
    expect(renderWorldBubble({ kind: 'conceptIcon', key: 'c', speakerId: 'v', conceptId: 'burn', role: 'mentor', onOpen: () => {} })).toBeNull()
  })

  it('a collapsed decision pill reads one sentence, not the whole question cut mid-word', () => {
    expect(pillLine('İki fikir birden cazip geliyor. Hangisine odaklanalım?')).toBe('İki fikir birden cazip geliyor.')
    expect(pillLine('Yıldız çalışanımız rakipten teklif aldı. Ne yapalım, maaşı eşitleyelim mi yoksa bırakalım mı?')).toBe('Yıldız çalışanımız rakipten teklif aldı.')
    expect(pillLine('Tek cümle')).toBe('Tek cümle')
  })
})

describe('module question at the desk (W2c)', () => {
  function withCompany(): string {
    const c = company(['web'], 2)
    useGameStore.setState({ state: c })
    return c.projects[0]!.id
  }

  it('collapsed: one sentence naming the project and the module; open: one tile with icon, name, 2+ chips, Kur and Diğerleri', () => {
    const id = withCompany()
    const key = `desk:module:${id}`
    const st = store().state
    const ask = moduleAsk(st)!
    const name = moduleName(ask.moduleId, 'web')
    const pill = html(createElement(DeskBubble, { bubbleKey: key, topic: 'module', refId: id }))
    expect(pill).toContain('data-open="false"')
    expect(pill).toContain(`${st.projects[0]!.name} için sıradaki modül: ${name}?`)
    expect(pill).not.toContain('Diğerleri')
    openBubble(key)
    const out = html(createElement(DeskBubble, { bubbleKey: key, topic: 'module', refId: id }))
    expect(out).toContain(MODULE_TEXT[ask.moduleId].line)
    expect(out).toContain('>Kur<')
    expect(out).toContain('Diğerleri')
    // gain + (minus or upkeep) + cost: three chips at most, one move on the button.
    const chips = (out.match(/data-chip=""/g) ?? []).length
    expect(chips).toBeGreaterThanOrEqual(2)
    expect(chips).toBeLessThanOrEqual(3)
  })

  it('opening it holds the world; Kur starts the build, closes the bubble and silences the question', () => {
    const id = withCompany()
    const key = `desk:module:${id}`
    openBubble(key)
    expect(store().ui.pauseReasons).toContain('bubble')
    expect(effectiveSpeed(store())).toBe(0)
    const ask = moduleAsk(store().state)!
    const r = store().dispatch({ type: 'buildModule', projectId: id, moduleId: ask.moduleId })
    expect(r.ok).toBe(true)
    expect(store().ui.bubbleOpen).toBeNull()
    expect(moduleAsk(store().state)).toBeNull()
    expect(html(createElement(DeskBubble, { bubbleKey: key, topic: 'module', refId: id }))).toBe('')
  })

  it('the stale variant: "eskidi, yenileyelim mi?" with Yenile, then never twice for the same age', () => {
    const c = company(['web'], 2)
    c.projects[0]!.modules = [{ id: 'feedback', day: c.time.day - 600 }]
    useGameStore.setState({ state: c })
    const id = c.projects[0]!.id
    const key = `desk:module:${id}`
    openBubble(key)
    const out = html(createElement(DeskBubble, { bubbleKey: key, topic: 'module', refId: id }))
    expect(out).toContain(`${moduleName('feedback', 'web')} eskidi, yenileyelim mi?`)
    expect(out).toContain('>Yenile<')
    expect(store().dispatch({ type: 'refreshModule', projectId: id, moduleId: 'feedback' }).ok).toBe(true)
    expect(moduleAsk(store().state)).toBeNull()
  })
})


describe('effort bubbles (E3)', () => {
  /** A stage 2 company; `fatigue` on its first engineer, whose id and name come back. */
  function withTired(fatigue: number, extra: Partial<Employee> = {}): { id: string; name: string } {
    const c = company(['web'], 2)
    const e = c.employees.find((x) => x.dept === 'eng')!
    Object.assign(e, { fatigue, status: 'working', ...extra })
    useGameStore.setState({ state: c })
    return { id: e.id, name: e.name }
  }
  const staff = (id: string, need: 'tired' | 'burnout' | 'bored') => html(createElement(StaffBubble, { bubbleKey: `staff:${id}`, employeeId: id, need }))

  it('tired: one sentence collapsed; open: slow down, leave, carry on', () => {
    const { id, name } = withTired(70)
    const closed = staff(id, 'tired')
    expect(closed).toContain(`${name} yoruldu.`)
    expect(closed).not.toContain('Yavaşlat')
    openBubble(`staff:${id}`)
    const out = staff(id, 'tired')
    for (const label of ['Yavaşlat', 'İzin ver', 'Devam']) expect(out).toContain(label)
    expect(out).toContain('−%15')
    expect(out).toContain('−%20')
  })

  it('burnout: leave is the main move, then slow down and let go', () => {
    const { id, name } = withTired(90)
    expect(staff(id, 'burnout')).toContain(`${name} tükendi.`)
    openBubble(`staff:${id}`)
    const out = staff(id, 'burnout')
    expect(out.indexOf('İzin ver')).toBeGreaterThan(-1)
    expect(out.indexOf('İzin ver')).toBeLessThan(out.indexOf('Yavaşlat'))
    expect(out.indexOf('Yavaşlat')).toBeLessThan(out.indexOf('Bırak'))
    expect(out).toContain('−60')
  })

  it('bored: the busiest project with its load, and a wave-off', () => {
    const { id, name } = withTired(0, { projectId: undefined })
    expect(staff(id, 'bored')).toContain(`${name} boşa harcanıyor.`)
    useGameStore.setState({ state: { ...store().state, projects: store().state.projects.map((p) => ({ ...p, maturity: 0.4 })) } })
    openBubble(`staff:${id}`)
    const out = staff(id, 'bored')
    expect(out).toContain(store().state.projects[0]!.name)
    expect(out).toContain('Yük')
    expect(out).toContain('Devam')
  })

  it('a resignation by burnout names its cause and promises rest', () => {
    const { id, name } = withTired(90, { status: 'leaving', leaveCause: 'burnout', leaveDay: store().state.time.day + 7 })
    const out = html(createElement(StaffBubble, { bubbleKey: `staff:${id}`, employeeId: id, need: 'leaving' }))
    expect(out).toContain(`${name} tükendi, 7g içinde gidiyor.`)
  })

  const person = (id: string) => html(createElement(PersonBubble, { bubbleKey: `person:${id}`, employeeId: id }))

  it('the person card: battery number, load, pace pill that flips with the pace, leave only when worn out', () => {
    const { id } = withTired(20)
    openBubble(`person:${id}`)
    let out = person(id)
    expect(out).toContain('Yük')
    expect(out).toContain('Tempo: Normal')
    expect(out).not.toContain('İzin ver')
    store().dispatch({ type: 'setPace', employeeId: id, pace: 'calm' })
    openBubble(`person:${id}`)
    expect(person(id)).toContain('Tempo: Rahat')
    store().dispatch({ type: 'setPace', employeeId: id, pace: 'normal' })
    openBubble(`person:${id}`)
    expect(person(id)).toContain('Tempo: Normal')
    withTired(55)
    openBubble(`person:${id}`)
    out = person(id)
    expect(out).toContain('İzin ver · 5g')
  })

  it('the Garage has none of it', () => {
    const e = store().state.employees[0] ?? store().state.candidates[0]
    expect(e).toBeDefined()
    const st = store().state
    const emp = { ...(st.employees[0] ?? st.candidates[0]!), id: 'e-g', status: 'working', fatigue: 90 } as unknown as Employee
    useGameStore.setState({ state: { ...st, employees: [...st.employees, emp] } })
    openBubble('person:e-g')
    const out = person('e-g')
    expect(out).not.toContain('Tempo')
    expect(out).not.toContain('Yük')
  })
})
