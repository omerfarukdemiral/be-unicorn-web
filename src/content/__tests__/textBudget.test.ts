// Text diet (GAMEPLAY V2 §3 md.5, §11): word budgets over the flat UI_TEXT + every literal t('key') in src/ui exists.
// `t()` returns the raw key for a missing one and typecheck cannot see it, so the grep below is the only guard.
import { describe, expect, it } from 'vitest'
import { CONTENT, UI_TEXT } from '../index'
import { wordCount } from './fixture'

/** Keys over a budget, as "key (n): text" so a failure reads at a glance. */
function over(entries: [string, string][], max: number): string[] {
  return entries.filter(([, v]) => wordCount(v) > max).map(([k, v]) => `${k} (${wordCount(v)}): ${v}`)
}

const ENTRIES = Object.entries(UI_TEXT)
const matching = (re: RegExp) => ENTRIES.filter(([k]) => re.test(k))

// Leaderboard text lives in the online lane (onlineText.ts), outside this diet.
const EMPTY_EXEMPT = new Set<string>()

/** Buttons with a bare verb (≤ 2 words). Confirm buttons ("Emin misin? Sat") are a question + verb, not listed. */
const BUTTON_KEYS = [
  'time.start',
  'top.roundStart',
  'round.start',
  'move.go',
  'victory.again',
  'gameOver.retry',
  'start.new',
  'start.continue',
  'start.go',
  'start.back',
  'team.refresh',
  'shop.openRing',
  'journal.gotIt',
]

// Deleted with their usage lines (§11); none may come back.
const DELETED = [
  'time.startHint',
  'shop.autoHint',
  'round.moveBody',
  'move.from',
  'metrics.intro',
  'goals.reward',
  'goals.toast',
  'receipt.open',
  'round.takesWeeks',
  'decision.reflection',
  'time.frame.focus',
  'horizon.title',
]

describe('text budgets', () => {
  it('next step chip: step.* ≤ 6 words', () => {
    expect(over(matching(/^step\./), 6)).toEqual([])
  })

  it('tooltips and hints: *Title | *Hint | *note ≤ 8 words', () => {
    expect(over(matching(/(Title|Hint|note)$/), 8)).toEqual([])
  })

  it('no explanation paragraphs: no *.intro / *.reward keys', () => {
    expect(ENTRIES.map(([k]) => k).filter((k) => /\.(intro|reward)$/.test(k))).toEqual([])
  })

  it('horizon items ≤ 6 words', () => {
    expect(over(matching(/^horizon\./), 6)).toEqual([])
  })

  it('empty states ≤ 4 words', () => {
    expect(over(matching(/(\.empty|Empty|\.noCandidates)$/).filter(([k]) => !EMPTY_EXEMPT.has(k)), 4)).toEqual([])
  })

  it('buttons ≤ 2 words', () => {
    expect(over(matching(/^(common|step\.go)\./), 2)).toEqual([])
    for (const k of BUTTON_KEYS) expect(UI_TEXT[k], k).toBeDefined()
    expect(over(BUTTON_KEYS.map((k) => [k, UI_TEXT[k] ?? ''] as [string, string]), 2)).toEqual([])
  })

  it('stage goals: hint ≤ 8 words (kept on the type, never rendered)', () => {
    expect(over((CONTENT.goals ?? []).map((g) => [g.id, g.hint] as [string, string]), 8)).toEqual([])
  })

  it('decision cards: question ≤ 12 words, option label ≤ 5', () => {
    expect(over(CONTENT.decisions.map((d) => [d.id, d.question] as [string, string]), 12)).toEqual([])
    const labels = CONTENT.decisions.flatMap((d) => d.options.map((o, i) => [`${d.id}#${i}`, o.label] as [string, string]))
    expect(over(labels, 5)).toEqual([])
  })

  it('teasers ≤ 6 words (when the table exists)', () => {
    const mods = import.meta.glob<Record<string, unknown>>('../teasers.ts', { eager: true })
    for (const mod of Object.values(mods)) {
      const table = mod.TEASERS
      if (!table) continue
      const texts = Array.isArray(table) ? table : Object.values(table as Record<string, unknown>)
      const entries = texts.flatMap((x, i): [string, string][] => {
        if (typeof x === 'string') return [[String(i), x]]
        if (x && typeof x === 'object' && typeof (x as { text?: unknown }).text === 'string') return [[String(i), (x as { text: string }).text]]
        return []
      })
      expect(over(entries, 6)).toEqual([])
    }
  })

  it('deleted keys stay deleted', () => {
    expect(DELETED.filter((k) => k in UI_TEXT)).toEqual([])
  })
})

describe('t() keys', () => {
  it("every literal t('key') in src/ui exists in UI_TEXT", () => {
    const files = import.meta.glob<string>('../../ui/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
    const missing: string[] = []
    let seen = 0
    for (const [path, src] of Object.entries(files)) {
      if (/\.test\.tsx?$/.test(path)) continue
      for (const m of src.matchAll(/(?<![\w.])t\(\s*(['"])([^'"`$]+?)\1/g)) {
        const key = m[2] ?? ''
        seen++
        if (!(key in UI_TEXT)) missing.push(`${path}: ${key}`)
      }
    }
    expect(seen).toBeGreaterThan(100)
    expect(missing).toEqual([])
  })
})
