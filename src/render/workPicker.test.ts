import { describe, expect, it } from 'vitest'
import type { Employee, GameState, Project } from '../engine/types'
import { WorkFloatPicker, projectLine } from './workPicker'

const emp = (id: string, dept: Employee['dept'], projectId?: string): Employee =>
  ({ id, name: `${id} Soyad`, dept, quality: 1, salary: 1, status: 'working', statusSinceDay: 0, hiredDay: 0, deskSlotId: `d-${id}`, projectId, morale: 70 }) as Employee

const proj = (over: Partial<Project> = {}): Project =>
  ({ id: 'p1', name: 'Liman', category: 'web', size: 1, maturity: 0.3, launched: true, createdDay: 0, assignedIds: ['e1', 'e2'], ...over }) as Project

function state(day: number, over: { mpd?: number; organic?: number; sales?: number; ops?: number; mrr?: number; users?: number } = {}): GameState {
  return {
    time: { day, month: 0, speed: 1 },
    founder: {},
    projects: [proj()],
    employees: [emp('e1', 'eng', 'p1'), emp('e2', 'product', 'p1'), emp('m1', 'marketing'), emp('s1', 'sales'), emp('o1', 'ops')],
    stats: { users: over.users ?? 1000, churn: 0.05 },
    finance: { mrr: over.mrr ?? 20_000 },
    derived: {
      maturityPerDay: { p1: over.mpd ?? 0.004 },
      channels: { organic: over.organic ?? 300, paid: 0, manual: 0, enterprise: 0 },
      deptOutput: { eng: 1, product: 1, marketing: 1, sales: over.sales ?? 2, ops: over.ops ?? 20 },
    },
  } as unknown as GameState
}

const all = () => true

describe('work floats (P5): who did what', () => {
  it('nothing shows before any work has piled up, nor after a jump (a loaded save)', () => {
    const k = new WorkFloatPicker()
    k.accrue(state(10))
    expect(k.pick(state(10), all)).toBeNull()
    k.accrue(state(100))
    expect(k.pick(state(100), all)).toBeNull()
  })

  it('lanes take turns and name the effect; a shown pile starts again', () => {
    const k = new WorkFloatPicker()
    k.accrue(state(0))
    k.accrue(state(5))
    const picks = [0, 1, 2, 3].map(() => k.pick(state(5), all))
    expect(picks.map((p) => p?.kind)).toEqual(['project', 'cash', 'users', 'kept'])
    expect(picks[0]!.text).toBe('+%2 proje')
    expect(picks[2]!.text).toBe('+50 kullanıcı')
    expect(picks[1]!.text).toMatch(/^\+\$\d/)
    expect(picks[3]!.text).toMatch(/kullanıcı tuttu$/)
    expect(k.pick(state(5), all)).toBeNull()
  })

  it('tiny ticks never show', () => {
    const k = new WorkFloatPicker()
    k.accrue(state(0, { mpd: 0.0005, organic: 3, sales: 0, ops: 0 }))
    k.accrue(state(2, { mpd: 0.0005, organic: 3, sales: 0, ops: 0 }))
    expect(k.pick(state(2, { mpd: 0.0005, organic: 3, sales: 0, ops: 0 }), all)).toBeNull()
  })

  it('builders take turns, and only someone who can carry a float gets one', () => {
    const k = new WorkFloatPicker()
    const who: string[] = []
    for (let d = 0; d <= 30; d += 5) {
      k.accrue(state(d, { organic: 0, sales: 0, ops: 0 }))
      const p = k.pick(state(d, { organic: 0, sales: 0, ops: 0 }), (id) => id !== 'e2' || d > 10)
      if (p) who.push(p.personId)
    }
    expect(who[0]).toBe('e1')
    expect(new Set(who)).toEqual(new Set(['e1', 'e2']))
    expect(k.pick(state(30), () => false)).toBeNull()
  })

  it('the idle founder carries the project float when no builder is on it', () => {
    const k = new WorkFloatPicker()
    const solo = (d: number) => ({ ...state(d, { organic: 0, sales: 0, ops: 0 }), projects: [proj({ assignedIds: [] })] }) as GameState
    k.accrue(solo(0))
    k.accrue(solo(5))
    expect(k.pick(solo(5), all)).toMatchObject({ personId: 'founder', kind: 'project' })
  })

  it('a finished project reads as the next update, a module build as the module', () => {
    expect(projectLine(proj({ maturity: 1 }), 0.04, 10)?.text).toBe('+%20 sürüm')
    expect(projectLine(proj({ maturity: 1 }), 0.002, 10)).toBeNull()
    expect(projectLine(proj({ maturity: 1, build: { id: 'feedback', progress: 0, startDay: 0 } }), 0.05, 10)?.kind).toBe('module')
  })
})
