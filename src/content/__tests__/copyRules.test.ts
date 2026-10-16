// Copy pass rules (round 3 T1, design §6): glossary words, no em dash, no trailing "…", no aphorism-style
// leftovers in the strings a player reads. One flat list of every player-facing string, then plain regex rules.
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_TEXT,
  CONTENT,
  DECISIONS,
  DEPT_TEXT,
  MODULE_TEXT,
  NPC_TEXT,
  OFFICE_LINES,
  POST_MORTEM_TEXT,
  UI_TEXT,
  FURNITURE,
  ACTION_ERROR_TEXT,
  POST_MORTEM_TITLE,
} from '../index'
import * as C from '../index'

function allStrings(): [string, string][] {
  const out: [string, string][] = []
  const add = (where: string, v: unknown): void => {
    if (typeof v === 'string' && v) out.push([where, v])
  }
  for (const [k, v] of Object.entries(UI_TEXT)) add(`ui:${k}`, v)
  for (const [k, v] of Object.entries(ACTIVITY_TEXT)) add(`activity:${k}`, v)
  for (const [k, v] of Object.entries(POST_MORTEM_TEXT)) add(`pm:${k}`, v)
  for (const [k, v] of Object.entries(POST_MORTEM_TITLE)) add(`pmTitle:${k}`, v)
  for (const [k, v] of Object.entries(ACTION_ERROR_TEXT)) add(`error:${k}`, v)
  for (const [k, v] of Object.entries(DEPT_TEXT)) {
    add(`dept:${k}`, v.name)
    add(`dept:${k}.short`, v.short)
  }
  for (const [k, v] of Object.entries(NPC_TEXT)) {
    add(`npc:${k}`, v.title)
    for (const t of Object.values(v.titleBy ?? {})) add(`npc:${k}.by`, t)
  }
  for (const [k, v] of Object.entries(MODULE_TEXT)) {
    add(`module:${k}`, v.name)
    add(`module:${k}.line`, v.line)
  }
  for (const l of OFFICE_LINES) {
    add(`office:${l.id}`, l.text)
    for (const t of Object.values(l.variants ?? {})) add(`office:${l.id}.v`, t)
  }
  for (const f of FURNITURE) {
    add(`furniture:${f.id}`, f.name)
    add(`furniture:${f.id}.desc`, f.description)
  }
  for (const d of DECISIONS) {
    add(`card:${d.id}`, d.question)
    for (const o of d.options) {
      add(`card:${d.id}.label`, o.label)
      add(`card:${d.id}.reflection`, o.reflection)
      add(`card:${d.id}.gain`, o.tradeoff.gain)
      add(`card:${d.id}.cost`, o.tradeoff.cost)
    }
  }
  return out
}

/** Every string reachable from the content barrel (concepts, goals, crises, names, ...), not just the tables above. */
function everyContentString(): [string, string][] {
  const out: [string, string][] = []
  const seen = new Set<object>()
  const walk = (where: string, v: unknown): void => {
    if (typeof v === 'string') {
      if (v) out.push([where, v])
    } else if (v && typeof v === 'object' && !seen.has(v)) {
      seen.add(v)
      for (const [k, x] of Object.entries(v)) walk(`${where}.${k}`, x)
    }
  }
  for (const [k, v] of Object.entries(C)) walk(k, v)
  return out
}

/** Source of every non-test file under src/, comments stripped: catches copy hard-coded in a component. */
const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
})
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

// "Yakıt" was renamed to burn; "Yakıtı kıs" slipped once. No \b here: JS treats ı as a non-word letter.
const OLD_FUEL = /[Yy]ak[ıi]t/

const STRINGS = allStrings()
const hits = (re: RegExp): string[] => STRINGS.filter(([, v]) => re.test(v)).map(([k, v]) => `${k}: ${v}`)

describe('copy pass rules (T1)', () => {
  it('collects a real corpus', () => {
    expect(STRINGS.length).toBeGreaterThan(1500)
    expect(CONTENT.uiText).toBe(UI_TEXT)
  })

  it('Geliştirici replaces Mühendis everywhere a player reads it', () => {
    expect(hits(/m[üu]hendis/i)).toEqual([])
    expect(DEPT_TEXT.eng.name).toBe('Geliştirici')
    expect(NPC_TEXT.engineer.title).toBe('Geliştirici')
  })

  it('no em dash in running text', () => {
    expect(hits(/ — /)).toEqual([])
  })

  it('no trailing ellipsis', () => {
    // A lone "…" is a symbol (leaderboard "more" row), not a sentence.
    expect(STRINGS.filter(([, v]) => v.length > 1 && /(…|\.\.\.)$/.test(v)).map(([k, v]) => `${k}: ${v}`)).toEqual([])
  })

  it('glossary: old words are gone', () => {
    expect(hits(OLD_FUEL)).toEqual([])
    expect(hits(/Yollarınızı ayır/)).toEqual([])
    expect(hits(/Kuruluyor|\bKur\b/)).toEqual([])
    expect(hits(/Boş yuva|\byuva\b/)).toEqual([])
    expect(hits(/Tükenmiş|Ayrılmak üzere/)).toEqual([])
  })

  it('no Yakıt anywhere: every content string and every literal in src', () => {
    const all = everyContentString()
    expect(all.length).toBeGreaterThan(4000)
    expect(all.filter(([, v]) => OLD_FUEL.test(v) || /m[üu]hendis/i.test(v)).map(([k, v]) => `${k}: ${v}`)).toEqual([])
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100)
    const files = Object.entries(SOURCES).filter(([, src]) => OLD_FUEL.test(stripComments(src)))
    expect(files.map(([f]) => f)).toEqual([])
    expect(UI_TEXT['strip.runwayLowSub']).toBe('Burn’ü kıs ya da tura çık')
  })

  it('error lines name a reason, not one cryptic word', () => {
    expect(ACTION_ERROR_TEXT.noDesk).toBe('Boş masa yok.')
    expect(ACTION_ERROR_TEXT.insufficientCash).toBe('Kasa yetmiyor.')
    expect(ACTION_ERROR_TEXT.noMoves).toBe('Bu haftanın hamleleri bitti.')
  })

  it('card reflections say what happens next, not a moral', () => {
    // The old aphorism shapes: "X, Y'dir." and "… bir … olur/vardır".
    const morals = STRINGS.filter(([k, v]) => k.endsWith('.reflection') && /(dir|dır|dur|dür|tir|tır)\.$/.test(v))
    expect(morals.map(([k, v]) => `${k}: ${v}`)).toEqual([])
  })
})
