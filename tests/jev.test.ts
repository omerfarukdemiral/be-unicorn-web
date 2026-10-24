// Jev (tools/jev): the legal move list is engine-true and the model's answer parser is forgiving.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../src/content/index'
import { createEngine, openDecision } from '../src/engine/index'
import { fallbackMove, legalMoves, observe } from '../tools/jev/legal'
import { parseAnswer } from '../tools/jev/llm'

describe('jev legal moves', () => {
  it('every listed move applies, ids are unique, "bekle" is always there, decisions list only their answers', () => {
    const api = createEngine(CONTENT)
    let s = api.createGame({ seed: 7 })
    let sawDecision = false
    let sawChip = false
    while (!s.gameOver && s.time.day < 240) {
      const moves = legalMoves(s, CONTENT, api)
      expect(new Set(moves.map((m) => m.id)).size).toBe(moves.length)
      expect(moves[0]?.id).toBe('bekle')
      for (const m of moves) if (m.action) expect(api.applyAction(s, m.action).ok, `${m.id} on day ${s.time.day}`).toBe(true)
      const open = openDecision(s)
      if (open) {
        sawDecision = true
        for (const m of moves.slice(1)) expect(['answerDecision', 'resolvePayday', 'roundPitch', 'respondResignation', 'assign']).toContain(m.action?.type)
      }
      if (moves.some((m) => m.chip)) sawChip = true
      const pick = fallbackMove(s, CONTENT, moves)
      if (pick.action) s = api.applyAction(s, pick.action).state
      for (let i = 0; i < 20; i++) s = api.step(s, 0.5)
    }
    expect(sawDecision).toBe(true)
    expect(sawChip).toBe(true)
    expect(JSON.stringify(observe(s, CONTENT)).length).toBeLessThan(2500)
  }, 300_000)
})

describe('jev answer parser', () => {
  it('reads plain, fenced and wrapped JSON and refuses junk', () => {
    expect(parseAnswer('{"action":"bekle","why":"Kasa ince."}')).toEqual({ action: 'bekle', why: 'Kasa ince.' })
    expect(parseAnswer('Tamam:\n```json\n{"action": "kart1", "why": "Ucuz."}\n```')).toEqual({ action: 'kart1', why: 'Ucuz.' })
    expect(parseAnswer('{"action":"x"}')).toEqual({ action: 'x', why: '' })
    expect(parseAnswer('bekle')).toBeNull()
    expect(parseAnswer('{"why":"no action"}')).toBeNull()
  })
})
