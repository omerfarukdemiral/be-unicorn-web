// One-line notice cards (2026-10-21): the engine writes what just happened and its price; the UI shows the newest on
// the 'notice' event. Text comes from content/noticeText.ts, numbers formatted the house way.
import { fillTemplate, formatMoney, formatPercent } from '../content/format'
import { NOTICE_DEPT, NOTICE_TEXT } from '../content/noticeText'
import { NOTICES_MAX } from './balance'
import { DEPTS, type Dept, type GameState, type Notice } from './types'
import { nextId, pushEvent } from './util'

export type NoticeTextKey = keyof typeof NOTICE_TEXT

export function pushNotice(s: GameState, n: Omit<Notice, 'id' | 'day'>): Notice {
  const note: Notice = { id: nextId(s), day: s.time.day, ...n }
  const list = (s.notices ??= [])
  list.push(note)
  if (list.length > NOTICES_MAX) list.splice(0, list.length - NOTICES_MAX)
  pushEvent(s, { kind: 'notice', refId: n.kind, value: note.id })
  return note
}

/** A text from the table with the price filled in: cash (+$), equity (%), valuation ($). */
export function noticeText(key: NoticeTextKey, p: { cash?: number; equity?: number; valuation?: number; list?: string } = {}): string {
  return fillTemplate(NOTICE_TEXT[key], {
    cash: formatMoney(Math.round(p.cash ?? 0)),
    equity: formatPercent(p.equity ?? 0),
    valuation: formatMoney(Math.round(p.valuation ?? 0)),
    list: p.list ?? '',
  })
}

/** "Geliştirme +2, Pazarlama +1" (department order). */
export function hiresList(hires: Partial<Record<Dept, number>>): string {
  return DEPTS.filter((d) => (hires[d] ?? 0) > 0)
    .map((d) => `${NOTICE_DEPT[d]} +${hires[d]}`)
    .join(', ')
}
