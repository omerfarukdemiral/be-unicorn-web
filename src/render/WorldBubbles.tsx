// Decides which world-anchored bubbles exist (ambient lines, concept, minimized concepts, decision)
// and anchors them above their speakers. Content is drawn by the BubbleRenderer (ui) or DefaultBubble.
import { useMemo, useState } from 'react'
import { CONCEPTS, DECISIONS, OFFICE_LINES } from '../content'
import type { ConceptId, Dept, Employee, GameState, NpcRole, Visitor } from '../engine/types'
import { BubbleAnchor, BubbleLayoutRegistry, useBubbleLayoutDriver } from './BubbleAnchor'
import type { BubbleRenderer, WorldBubble } from './bubbles'
import { UI_TONES } from './palette'
import { useLayout } from './sceneRegistry'
import { dispatchAction, storeApi, useGS } from './source'

const ROLE_DEPT: Partial<Record<NpcRole, Dept>> = { engineer: 'eng', accountant: 'ops' }

/** Who says a concept/decision line: a matching visitor, a matching employee, else the founder. */
export function resolveSpeaker(role: NpcRole, refId: string | undefined, visitors: readonly Visitor[], employees: readonly Employee[]): string {
  const byRef = refId ? visitors.find((v) => v.refId === refId) : undefined
  if (byRef) return byRef.id
  const byRole = visitors.find((v) => v.role === role)
  if (byRole) return byRole.id
  const dept = ROLE_DEPT[role]
  if (dept) {
    const e = employees.find((x) => x.dept === dept && x.status !== 'leaving')
    if (e) return e.id
  }
  if (role === 'cofounder' && employees[0]) return employees[0].id
  return 'founder'
}

const conceptRole = (id: string): NpcRole => CONCEPTS.find((x) => x.id === id)?.speaker ?? 'mentor'
const decisionRole = (id: string): NpcRole => DECISIONS.find((d) => d.id === id)?.speaker ?? 'mentor'

/**
 * One primitive key for every bubble on screen (kind|id|speaker per line). The store clones state
 * every tick, so selecting arrays would rebuild all drei <Html> nodes 2–8×/s; a string only changes
 * when a bubble or its speaker does. Expired ambient lines are removed by the engine (expireBubbles).
 */
function selectBubbleKey(s: GameState): string {
  const out: string[] = []
  for (const b of s.bubbles) out.push(`a|${b.id}|${b.speakerId}|${b.lineId}`)
  const ac = s.concepts.active
  if (ac) out.push(`c|${ac.id}|${resolveSpeaker(conceptRole(ac.id), ac.id, s.visitors, s.employees)}`)
  for (const id of s.concepts.minimized) out.push(`i|${id}|${resolveSpeaker(conceptRole(id), id, s.visitors, s.employees)}`)
  const ad = s.decisions.active
  if (ad) {
    const visitorOk = ad.visitorId !== undefined && s.visitors.some((v) => v.id === ad.visitorId)
    out.push(`d|${ad.cardId}|${visitorOk ? ad.visitorId! : resolveSpeaker(decisionRole(ad.cardId), ad.cardId, s.visitors, s.employees)}`)
  }
  return out.join('\n')
}

/** Fallback path (no UI renderer): concept/decision open in the single panel. */
function openConcept(conceptId: ConceptId): void {
  if (!storeApi().state.concepts.learned.includes(conceptId)) dispatchAction({ type: 'openConcept', conceptId })
  storeApi().openPanel({ kind: 'journal', conceptId })
}

function buildList(key: string, ambient: boolean): WorldBubble[] {
  const out: WorldBubble[] = []
  if (!key) return out
  for (const line of key.split('\n')) {
    const [kind, id, speakerId, extra] = line.split('|') as [string, string, string, string | undefined]
    if (kind === 'a') {
      if (!ambient) continue
      const text = OFFICE_LINES.find((l) => l.id === extra)?.text ?? '…'
      out.push({ kind: 'ambient', key: `amb:${id}`, bubbleId: id, lineId: extra ?? '', speakerId, text })
    } else if (kind === 'c') {
      const cid = id as ConceptId
      out.push({ kind: 'concept', key: `concept:${cid}`, conceptId: cid, role: conceptRole(cid), speakerId, text: CONCEPTS.find((x) => x.id === cid)?.bubble ?? '…', onOpen: () => openConcept(cid) })
    } else if (kind === 'i') {
      const cid = id as ConceptId
      out.push({ kind: 'conceptIcon', key: `icon:${cid}`, conceptId: cid, role: conceptRole(cid), speakerId, onOpen: () => openConcept(cid) })
    } else if (kind === 'd') {
      out.push({
        kind: 'decision',
        key: `decision:${id}`,
        cardId: id,
        role: decisionRole(id),
        speakerId,
        text: DECISIONS.find((d) => d.id === id)?.question ?? '…',
        onOpen: () => storeApi().openPanel({ kind: 'decision', cardId: id }),
      })
    }
  }
  return out
}

export function WorldBubbles({ renderBubble, ambient = true }: { renderBubble?: BubbleRenderer; ambient?: boolean }) {
  const key = useGS(selectBubbleKey)
  const layout = useLayout()
  const list = useMemo(() => buildList(key, ambient), [key, ambient])

  // An unclicked concept bubble shrinks to an icon after CONCEPT_MINIMIZE_DAYS of GAME time: the store does it
  // after each tick (store/gameStore.ts afterStep), so it never shrinks while time is still.

  // Overlaps (same or different speakers) are resolved in screen space by the layout driver.
  const [registry] = useState(() => new BubbleLayoutRegistry())
  useBubbleLayoutDriver(registry)
  const render = renderBubble ?? ((b: WorldBubble) => <DefaultBubble bubble={b} />)
  return (
    <group>
      {list.map((b) => (
        <BubbleAnchor key={b.key} layoutKey={b.key} kind={b.kind} layout={registry} speakerId={b.speakerId} fallback={layout.center} interactive={b.kind !== 'ambient'}>
          {render(b)}
        </BubbleAnchor>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Default look (used until ui passes its own renderer)
// ---------------------------------------------------------------------------

const T = UI_TONES

/** Neutral tail: surface fill, hairline sides (the top edge overlaps the bubble's border). */
function Tail() {
  return (
    <svg width="14" height="8" viewBox="0 0 14 8" style={{ display: 'block', margin: '-1px auto 0' }} aria-hidden>
      <path d="M0 0 L7 7.5 L14 0 Z" fill={T.surface} />
      <path d="M0.5 0.5 L7 7.5 L13.5 0.5" fill="none" stroke={T.border} strokeWidth="1" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" fill={T.surface2} stroke={T.ink} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 21V5" stroke={T.ink} strokeWidth="1.5" />
    </svg>
  )
}

const TEXT_FONT = 'var(--font-text)'
const UI_FONT = 'var(--font-ui)'

export function DefaultBubble({ bubble }: { bubble: WorldBubble }) {
  if (bubble.kind === 'conceptIcon') {
    return (
      <button
        type="button"
        onClick={bubble.onOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
        style={{ minWidth: 36, minHeight: 36, background: T.surface, border: `1px solid ${T.border}`, boxShadow: 'var(--shadow-card)' }}
      >
        <BookIcon />
      </button>
    )
  }
  const clickable = bubble.kind !== 'ambient'
  // Kind is told apart by a small mark, not a coloured frame.
  const mark = bubble.kind === 'concept' ? '?' : bubble.kind === 'decision' ? '!' : null
  const body = (
    <div
      className="max-w-[220px] rounded-[14px] px-3 py-2 text-[13px] leading-snug"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        color: T.ink,
        fontFamily: TEXT_FONT,
        boxShadow: 'var(--shadow-card)',
        whiteSpace: 'normal',
        width: 'max-content',
      }}
    >
      {mark && (
        <span
          className="mr-1.5 inline-grid size-4 place-items-center rounded-full align-[-2px] text-[10px] font-semibold"
          style={{ background: T.ink, color: T.surface, fontFamily: UI_FONT }}
        >
          {mark}
        </span>
      )}
      {bubble.text}
    </div>
  )
  return (
    <div className={clickable ? 'cursor-pointer select-none transition-transform hover:scale-[1.03]' : 'select-none opacity-95'} onClick={clickable ? bubble.onOpen : undefined}>
      {body}
      <Tail />
    </div>
  )
}
