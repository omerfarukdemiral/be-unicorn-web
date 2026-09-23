// Decides which world-anchored bubbles exist (ambient lines, concept, minimized concepts, decision)
// and anchors them above their speakers. Content is drawn by the BubbleRenderer (ui) or DefaultBubble.
import { useEffect, useMemo } from 'react'
import { CONCEPTS, DECISIONS, OFFICE_LINES } from '../content'
import type { ConceptId, Dept, Employee, GameState, NpcRole, Visitor } from '../engine/types'
import { CONCEPT_MINIMIZE_MS } from './constants'
import { BubbleAnchor } from './BubbleAnchor'
import type { BubbleRenderer, WorldBubble } from './bubbles'
import { PASTEL } from './palette'
import { useLayout } from './sceneRegistry'
import { dispatchAction, storeApi, useGS, useMockState } from './source'

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

const selectBubbleInputs = (s: GameState) =>
  [s.bubbles, s.concepts.active, s.concepts.minimized, s.decisions.active, s.visitors, s.employees, Math.floor(s.time.day * 4) / 4] as const

function openConcept(conceptId: ConceptId): void {
  storeApi().openOverlay({ kind: 'conceptCard', conceptId })
  dispatchAction({ type: 'openConcept', conceptId })
}

export function WorldBubbles({ renderBubble }: { renderBubble?: BubbleRenderer }) {
  const [bubbles, activeConcept, minimized, activeDecision, visitors, employees, day] = useGS(selectBubbleInputs)
  const layout = useLayout()
  const mock = useMockState()

  // Shrink an unclicked concept bubble to an icon after 20 s real time (PLAN §6.1).
  const activeId = activeConcept?.id
  useEffect(() => {
    if (!activeId || mock) return
    const t = window.setTimeout(() => {
      if (storeApi().state.concepts.active?.id === activeId) dispatchAction({ type: 'minimizeConcept', conceptId: activeId })
    }, CONCEPT_MINIMIZE_MS)
    return () => window.clearTimeout(t)
  }, [activeId, mock])

  const list = useMemo<WorldBubble[]>(() => {
    const out: WorldBubble[] = []
    for (const b of bubbles) {
      if (day > b.untilDay) continue
      const text = OFFICE_LINES.find((l) => l.id === b.lineId)?.text ?? '…'
      out.push({ kind: 'ambient', key: `amb:${b.id}`, bubbleId: b.id, lineId: b.lineId, speakerId: b.speakerId, text })
    }
    if (activeConcept) {
      const c = CONCEPTS.find((x) => x.id === activeConcept.id)
      const role: NpcRole = c?.speaker ?? 'mentor'
      out.push({
        kind: 'concept',
        key: `concept:${activeConcept.id}`,
        conceptId: activeConcept.id,
        role,
        speakerId: resolveSpeaker(role, activeConcept.id, visitors, employees),
        text: c?.bubble ?? '…',
        onOpen: () => openConcept(activeConcept.id),
      })
    }
    for (const id of minimized) {
      const c = CONCEPTS.find((x) => x.id === id)
      const role: NpcRole = c?.speaker ?? 'mentor'
      out.push({ kind: 'conceptIcon', key: `icon:${id}`, conceptId: id, role, speakerId: resolveSpeaker(role, id, visitors, employees), onOpen: () => openConcept(id) })
    }
    if (activeDecision) {
      const card = DECISIONS.find((d) => d.id === activeDecision.cardId)
      const role: NpcRole = card?.speaker ?? 'mentor'
      const visitorOk = activeDecision.visitorId && visitors.some((v) => v.id === activeDecision.visitorId)
      out.push({
        kind: 'decision',
        key: `decision:${activeDecision.cardId}`,
        cardId: activeDecision.cardId,
        role,
        speakerId: visitorOk ? activeDecision.visitorId! : resolveSpeaker(role, activeDecision.cardId, visitors, employees),
        text: card?.question ?? '…',
        onOpen: () => storeApi().openOverlay({ kind: 'decision', cardId: activeDecision.cardId }),
      })
    }
    return out
  }, [bubbles, activeConcept, minimized, activeDecision, visitors, employees, day])

  // Stack bubbles that share a speaker.
  const stackIndex = new Map<string, number>()
  const render = renderBubble ?? ((b: WorldBubble) => <DefaultBubble bubble={b} />)
  return (
    <group>
      {list.map((b) => {
        const i = stackIndex.get(b.speakerId) ?? 0
        stackIndex.set(b.speakerId, i + 1)
        return (
          <BubbleAnchor key={b.key} speakerId={b.speakerId} offsetY={i * 0.55} fallback={layout.center} interactive={b.kind !== 'ambient'}>
            {render(b)}
          </BubbleAnchor>
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Default look (used until ui passes its own renderer)
// ---------------------------------------------------------------------------

function Tail({ color }: { color: string }) {
  return (
    <svg width="14" height="8" viewBox="0 0 14 8" style={{ display: 'block', margin: '-1px auto 0' }} aria-hidden>
      <path d="M0 0 L7 8 L14 0 Z" fill={color} />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" fill={PASTEL.lilac} stroke="#2b2a33" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 21V5" stroke="#2b2a33" strokeWidth="1.5" />
    </svg>
  )
}

export function DefaultBubble({ bubble }: { bubble: WorldBubble }) {
  if (bubble.kind === 'conceptIcon') {
    return (
      <button
        type="button"
        onClick={bubble.onOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-cream-50 shadow-md transition-transform hover:scale-110"
        style={{ minWidth: 36, minHeight: 36 }}
      >
        <BookIcon />
      </button>
    )
  }
  const fill = PASTEL.cream50
  const accent = bubble.kind === 'concept' ? PASTEL.lilac : bubble.kind === 'decision' ? PASTEL.peach : 'transparent'
  const clickable = bubble.kind !== 'ambient'
  const body = (
    <div
      className="max-w-[220px] rounded-2xl px-3 py-2 text-[13px] leading-snug text-ink-900 shadow-md"
      style={{ background: fill, border: `2px solid ${accent === 'transparent' ? fill : accent}`, whiteSpace: 'normal', width: 'max-content' }}
    >
      {bubble.kind === 'concept' && <span className="mr-1 font-bold" style={{ color: '#8a63d2' }}>?</span>}
      {bubble.kind === 'decision' && <span className="mr-1 font-bold" style={{ color: '#d9774a' }}>!</span>}
      {bubble.text}
    </div>
  )
  return (
    <div className={clickable ? 'cursor-pointer select-none transition-transform hover:scale-[1.03]' : 'select-none opacity-95'} onClick={clickable ? bubble.onOpen : undefined}>
      {body}
      <Tail color={accent === 'transparent' ? fill : accent} />
    </div>
  )
}
