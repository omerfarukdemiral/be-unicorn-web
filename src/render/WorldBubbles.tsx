// Decides which world-anchored bubbles exist and anchors them above whoever they concern (spec "scene-first"):
// the founder's own calls at the central desk ('desk'), people above the employee, visitors' asks above that NPC.
// Content is drawn by the BubbleRenderer (ui) or DefaultBubble. Concepts have no scene bubble since GAMEPLAY_V2 A2:
// they go to the Kazanımlar icon, and tapping the visitor who brought one opens its card.
// Pipeline: routeCandidates (pure, from GameState) → BubbleTimeline (real-time delays, linger, reflection, exits)
// → capBubbles (≤ MAX_ACTIONABLE, one per anchor, priority order) → BubbleAnchor (layout + fade).
import { useEffect, useMemo, useState } from 'react'
import { DECISIONS, OFFICE_LINES } from '../content'
import { cardQuestion, lineText } from '../content/stageBand'
import * as B from '../engine/balance'
import type { DecisionCardId, GameState, NpcRole } from '../engine/types'
import { BubbleAnchor, BubbleLayoutRegistry, useBubbleLayoutDriver } from './BubbleAnchor'
import type { BubbleRenderer, DeskTopic, StaffNeed, VisitorTopic, WorldBubble } from './bubbles'
import { hireIsRed, staffAttention } from '../engine/loopSelectors'
import { moduleAsk } from '../engine/modules'
import { firstFreeDesk } from '../engine/office'
import { UI_TONES } from './palette'
import { speakerWalking, useLayout } from './sceneRegistry'
import { getGS, storeApi, useGS, useMockState, useSceneCovered, useUi } from './source'

// ---------------------------------------------------------------------------
// Routing (pure)
// ---------------------------------------------------------------------------

/** Card speakers who stand in the scene as themselves; every other card is the founder's own call (desk). */
export const NPC_SPEAKS: ReadonlySet<NpcRole> = new Set<NpcRole>(['investor', 'customer', 'journalist'])

/**
 * At most this many bubbles ask for the player at once, so the office never turns into a notification wall (fix round
 * 5: 4+ bubbles and notes at once on PC read as a busy screen). The rest queue and ask as one closes.
 */
export const MAX_ACTIONABLE = 2
/** Bubbles of any kind in the scene at once: a reflection or an ambient line only fills a slot the asks leave free. */
export const MAX_WORLD = 2
/** Ambient office lines at once (they are live notes too: one at a time). */
export const MAX_AMBIENT = 1

/** The central desk: the founder's own calls and projects. */
export const DESK = 'desk'

const decisionRole = (id: string): NpcRole => DECISIONS.find((d) => d.id === id)?.speaker ?? 'mentor'

/**
 * Who asks a decision card: its investor / customer / journalist visitor while that visitor is in the state,
 * otherwise the desk (cofounder, mentor, accountant, engineer cards are the founder's own call; the visitor stands by).
 */
export function resolveSpeaker(cardId: DecisionCardId, visitorId: string | undefined, s: Pick<GameState, 'visitors'>): string {
  if (NPC_SPEAKS.has(decisionRole(cardId)) && visitorId !== undefined && s.visitors.some((v) => v.id === visitorId)) return visitorId
  return DESK
}

/** One routed bubble, flat so a list of them serialises into the cheap selector string. */
export interface RoutedLine {
  kind: 'ambient' | 'decision' | 'staff' | 'person' | 'desk' | 'visitor' | 'reflection'
  /** Stable key (also the ui.bubbleOpen value). */
  key: string
  speakerId: string
  /** ambient: bubbleId · decision / reflection: cardId · staff: need · desk / visitor: topic. */
  ref: string
  /** ambient: lineId · desk: refId · visitor: visitorId · reflection: optionIndex. */
  extra?: string
  /** Changes when the same key starts over (reflection: a new answer). */
  stamp?: string
}

/**
 * Who needs the player in the scene: people walking out first, then (E3, from Pre-seed) the burnt out, one tired or
 * bored person, then builders with nothing to build. The engine decides (staffAttention); the caps are its too.
 */
export function staffNeeds(s: GameState): [string, StaffNeed][] {
  return staffAttention(s)
}

const roundVisitor = (s: GameState): string | undefined => s.visitors.find((v) => v.purpose === 'round')?.id

const deskKey = (topic: DeskTopic, refId?: string): string => (refId ? `desk:${topic}:${refId}` : `desk:${topic}`)

/** Every desk topic that applies now, in priority order (the desk asks one at a time via capBubbles; the open one wins). */
export function deskTopics(s: GameState, bubbleOpen: string | null): { topic: DeskTopic; refId?: string }[] {
  const out: { topic: DeskTopic; refId?: string }[] = []
  if (s.finance.pendingPayday) out.push({ topic: 'payday' })
  // The down round needs no valuation window, only its retry wait: the way out when the numbers fell asks here too.
  const r = s.derived.round
  if ((s.derived.canStartRound || (r?.downRound && !r.retryIn)) && !s.round?.active && !s.gameOver) out.push({ topic: 'round' })
  if (s.round?.active && s.round.pitchDue != null && roundVisitor(s) === undefined) out.push({ topic: 'pitch' })
  const renewal = s.derived.renewals?.[0]
  if (renewal) out.push({ topic: 'renewal', refId: renewal.id })
  // Hiring asks while someone waits and a desk stands free (nextStep never names 'hire' any more; a free desk does).
  // NEW-4: not when every offer is in the red (it stays reachable from the Ekip tab), never after the run ended.
  if (!s.gameOver && s.candidates.length > 0 && firstFreeDesk(s.office) !== undefined && s.candidates.some((c) => !hireIsRed(s, c.salary))) out.push({ topic: 'hire' })
  // A finished product with room for a module (or a stale one): the desk asks about ONE project at a time, oldest first.
  const ask = moduleAsk(s)
  if (ask) out.push({ topic: 'module', refId: ask.projectId })
  if (s.derived.nextStep?.id === 'idea') out.push({ topic: 'project' })
  if (bubbleOpen === deskKey('actions')) out.push({ topic: 'actions' })
  return out
}

/**
 * Every bubble that wants to be in the scene right now, actionable ones in priority order (decision > visitor
 * > desk > staff leaving > staff idle), then the reflection and ambient lines. No caps and no timing here.
 */
export function routeCandidates(s: GameState, opts: { bubbleOpen: string | null }): RoutedLine[] {
  const out: RoutedLine[] = []
  const ad = s.decisions.active
  if (ad) out.push({ kind: 'decision', key: `decision:${ad.cardId}`, speakerId: resolveSpeaker(ad.cardId, ad.visitorId, s), ref: ad.cardId })

  const rv = roundVisitor(s)
  if (s.round?.active && s.round.pitchDue != null && rv !== undefined) {
    const topic: VisitorTopic = 'pitch'
    out.push({ kind: 'visitor', key: `visitor:${topic}:${rv}`, speakerId: rv, ref: topic, extra: rv })
  }

  // Every topic is a candidate (one per anchor is capBubbles' job): a snoozed round pill lets the next one ask.
  for (const d of deskTopics(s, opts.bubbleOpen)) out.push({ kind: 'desk', key: deskKey(d.topic, d.refId), speakerId: DESK, ref: d.topic, extra: d.refId })

  for (const [id, need] of staffNeeds(s)) out.push({ kind: 'staff', key: `staff:${id}`, speakerId: id, ref: need })
  // A tapped employee's card (T14): only while open; as the open bubble it takes their anchor (capBubbles).
  const ob = opts.bubbleOpen
  if (ob?.startsWith('person:') && s.employees.some((e) => `person:${e.id}` === ob)) out.push({ kind: 'person', key: ob, speakerId: ob.slice(7), ref: '' })

  // Only a fresh answer reflects (a save loaded days later does not replay it); the 4 s are timed by BubbleTimeline.
  const la = s.decisions.lastAnswer
  if (la && ad?.cardId !== la.cardId && s.time.day - la.day <= REFLECTION_FRESH_DAYS) {
    const v = s.visitors.find((x) => x.purpose === 'decision' && x.refId === la.cardId)
    out.push({
      kind: 'reflection',
      key: `reflection:${la.cardId}`,
      speakerId: resolveSpeaker(la.cardId, v?.id, s),
      ref: la.cardId,
      extra: String(la.optionIndex),
      stamp: `${la.optionIndex}@${la.day}`,
    })
  }

  for (const b of s.bubbles) out.push({ kind: 'ambient', key: `amb:${b.id}`, speakerId: b.speakerId, ref: b.id, extra: b.lineId })
  return out
}

/** An answer older than this (game days) gets no reflection; covers 4 s real time at the fastest speed. */
export const REFLECTION_FRESH_DAYS = 10

/** Counts against MAX_ACTIONABLE (reflections and ambient lines only take a free MAX_WORLD slot). */
export const isActionable = (l: Pick<RoutedLine, 'kind'>): boolean => l.kind === 'decision' || l.kind === 'visitor' || l.kind === 'desk' || l.kind === 'staff' || l.kind === 'person'

/** Burnout and a resignation notice cost the player a person: their bubbles are pinned (E1 round 3). */
export const isPinned = (l: Pick<RoutedLine, 'kind' | 'ref'>): boolean => l.kind === 'staff' && (l.ref === 'leaving' || l.ref === 'burnout')

/** Tired, bored and "Normale dön?" share one slot. */
const isTiredBoredKind = (l: Pick<RoutedLine, 'kind' | 'ref'>): boolean => l.kind === 'staff' && (l.ref === 'tired' || l.ref === 'bored' || l.ref === 'calmBack')

/** Decision > visitor > pinned staff (leaving, then burnout) > desk > the rest. */
const rankOf = (l: RoutedLine): number =>
  l.kind === 'decision' ? 0 : l.kind === 'visitor' ? 1 : isPinned(l) ? (l.ref === 'leaving' ? 1.5 : 1.6) : l.kind === 'desk' ? 2 : l.kind === 'staff' ? 4 : 5

/** Idle builders ask one at a time: a late office full of "boşta" pills reads as a notification wall. */
export const MAX_IDLE = 1

/** Effort bubbles (E3): tired, bored and "Normale dön?" together (the engine's own cap, held again for the open one). Pinned ones have none. */
export const MAX_TIRED_BORED = B.STAFF_TIRED_BORED_MAX

/**
 * ≤ MAX_ACTIONABLE actionable bubbles (≤ MAX_WORLD of every kind), one per anchor, ≤ MAX_IDLE idle builders, ≤ MAX_TIRED_BORED tired / bored, the
 * open one first, then by priority. Pinned staff bubbles (burnout, notice) are never dropped and take slots only from
 * the others (at least one other still fits). Others pass through.
 */
export function capBubbles(lines: readonly RoutedLine[], bubbleOpen: string | null): RoutedLine[] {
  const act = lines.filter(isActionable)
  const ranked = act
    .map((l, i) => ({ l, i }))
    .sort((a, b) => Number(b.l.key === bubbleOpen) - Number(a.l.key === bubbleOpen) || rankOf(a.l) - rankOf(b.l) || a.i - b.i)
  const anchors = new Set<string>()
  const out: RoutedLine[] = []
  let idle = 0
  let tiredBored = 0
  let others = 0
  const pinned = new Set(ranked.filter(({ l }) => isPinned(l)).map(({ l }) => l.speakerId))
  const room = Math.max(1, MAX_ACTIONABLE - pinned.size)
  for (const { l } of ranked) {
    const pin = isPinned(l)
    if (!pin && others >= room && l.key !== bubbleOpen) continue
    if (anchors.has(l.speakerId)) continue
    const isIdle = l.kind === 'staff' && l.ref === 'idle'
    const isTiredBored = isTiredBoredKind(l)
    const mine = l.key === bubbleOpen
    if (isIdle && idle >= MAX_IDLE && !mine) continue
    if (isTiredBored && tiredBored >= MAX_TIRED_BORED && !mine) continue
    if (isIdle) idle++
    if (isTiredBored) tiredBored++
    if (!pin) others++
    anchors.add(l.speakerId)
    out.push(l)
  }
  // Reflection ("Seçtin: …") first, then one ambient line, only into slots the asks left free.
  const rest = lines.filter((l) => !isActionable(l)).sort((a, b) => Number(b.kind === 'reflection') - Number(a.kind === 'reflection'))
  let ambient = 0
  for (const l of rest) {
    if (l.key !== bubbleOpen && out.length >= MAX_WORLD) continue
    if (l.kind === 'ambient') {
      if (ambient >= MAX_AMBIENT) continue
      ambient++
    }
    out.push(l)
  }
  return out
}

/** Which bubbles the scene shows for this state (no real-time delays): routeCandidates → capBubbles. */
export function routeBubbles(s: GameState, opts: { bubbleOpen: string | null }): RoutedLine[] {
  // NEW-4: the run is over: no bubble asks anything behind the end screen.
  if (s.gameOver) return []
  return capBubbles(routeCandidates(s, opts), opts.bubbleOpen)
}

const SEP = '|'
const lineToString = (l: RoutedLine): string => [l.kind, l.key, l.speakerId, l.ref, l.extra ?? '', l.stamp ?? ''].join(SEP)

function lineFromString(str: string): RoutedLine {
  const [kind, key, speakerId, ref, extra, stamp] = str.split(SEP) as [RoutedLine['kind'], string, string, string, string, string]
  return { kind, key, speakerId, ref, extra: extra || undefined, stamp: stamp || undefined }
}

/**
 * One primitive key for every candidate bubble (one line each). The store clones state every tick, so selecting
 * arrays would rebuild all drei <Html> nodes 2–8×/s; a string only changes when a bubble or its speaker does.
 * Expired ambient lines are removed by the engine (expireBubbles).
 */
function selectBubbleKey(s: GameState, bubbleOpen: string | null): string {
  return routeCandidates(s, { bubbleOpen }).map(lineToString).join('\n')
}

// ---------------------------------------------------------------------------
// Timeline (real time): nothing pops in or out
// ---------------------------------------------------------------------------

/** A decision appears this long after its card (its visitor is on the way in), ms. */
export const DECISION_DELAY_MS = 600
/** An idle builder must stay idle this long before asking (no flicker between two projects), ms. */
export const IDLE_DELAY_MS = 800
/** …and their bubble stays this long after the need clears on its own, ms. */
export const IDLE_LINGER_MS = 1_500
/** An idle builder's (or the round window's) pill nobody opens steps back after this long (a "boşta" pill stood for hundreds of days, QA)… */
export const IDLE_SHOW_MS = 20_000
/** …and asks again after this long, ms. */
export const IDLE_SNOOZE_MS = 40_000
/** "Seçtin: …" stays this long after an answer, ms. */
export const REFLECTION_MS = 4_000
/** A removed bubble stays mounted (fading out) this long, ms. */
export const EXIT_MS = 200
/** A pill above someone walking in waits for them to stand still (a moving 44px target slides under the thumb), at most this long, ms. */
export const ARRIVE_MAX_MS = 5_000
/** How often a pill waiting for its speaker to arrive checks again, ms. */
const ARRIVE_POLL_MS = 250

export type ShownLine = RoutedLine & { exiting?: boolean }

interface Seen {
  first: number
  stamp: string
  line: RoutedLine
  /** When the need cleared (idle linger), ms. */
  clearedAt: number | null
  /** Was expanded by the player: resolved on purpose, so it leaves without lingering. */
  wasOpen: boolean
  /** Passed the arrival gate once: never hidden again because its speaker walks (a visitor leaving, a resigner pacing). */
  arrived: boolean
}

/**
 * Pills that ride a person (not the desk, never ambient / reflection lines): they wait for the speaker to arrive.
 * A decision never waits: the card is already running, so it asks above its visitor at the door at once
 * (QA: a decision active > 4.5 s with no bubble while the visitor queued in the doorway, or never under a manual pause).
 */
const waitsForArrival = (l: RoutedLine): boolean => (l.kind === 'visitor' || l.kind === 'staff') && l.speakerId !== DESK && !isPinned(l)

/** Pills that may wait for long (a builder with nothing to build, someone tired or bored, a round window or a module question the player sits out) step back unopened. */
const snoozes = (l: RoutedLine): boolean => (l.kind === 'staff' && (l.ref === 'idle' || isTiredBoredKind(l))) || (l.kind === 'desk' && (l.ref === 'round' || l.ref === 'module'))

const delayOf = (l: RoutedLine): number => (l.kind === 'decision' ? DECISION_DELAY_MS : l.kind === 'staff' && (l.ref === 'idle' || isTiredBoredKind(l)) ? IDLE_DELAY_MS : 0)

/**
 * Real-time gate between routing and the scene: delays (decision, idle builder), linger (idle builder), the
 * reflection's 4 s, the global cap, and a short keep-alive (`exiting`) for removed bubbles so they fade out.
 * `step` returns the lines to mount and when it needs to run again (nextAt, ms; null = only on change).
 */
export class BubbleTimeline {
  private seen = new Map<string, Seen>()
  private shown = new Map<string, RoutedLine>()
  private exits = new Map<string, { line: RoutedLine; until: number }>()
  private primed = false

  step(
    cands: readonly RoutedLine[],
    open: string | null,
    now: number,
    isAlive: (speakerId: string) => boolean = () => true,
    isWalking: (speakerId: string) => boolean = () => false,
  ): { lines: ShownLine[]; nextAt: number | null } {
    let nextAt = Infinity
    const wake = (t: number) => {
      if (t > now && t < nextAt) nextAt = t
    }
    const present = new Set<string>()
    for (const c of cands) {
      present.add(c.key)
      let e = this.seen.get(c.key)
      if (!e || e.stamp !== (c.stamp ?? '')) {
        // A reflection already on record when the scene mounts (a loaded save) is old news.
        e = { first: !this.primed && c.kind === 'reflection' ? -Infinity : now, stamp: c.stamp ?? '', line: c, clearedAt: null, wasOpen: false, arrived: false }
        this.seen.set(c.key, e)
      }
      e.line = c
      e.clearedAt = null
      if (c.key === open) e.wasOpen = true
    }
    this.primed = true

    const live: RoutedLine[] = []
    for (const [key, e] of this.seen) {
      if (!present.has(key)) {
        const l = e.line
        const wasShown = now - e.first >= IDLE_DELAY_MS
        if (l.kind === 'staff' && l.ref === 'idle' && wasShown && !e.wasOpen && isAlive(l.speakerId)) {
          e.clearedAt ??= now
          if (now - e.clearedAt < IDLE_LINGER_MS) {
            live.push(l)
            wake(e.clearedAt + IDLE_LINGER_MS)
            continue
          }
        }
        this.seen.delete(key)
        continue
      }
      const delay = delayOf(e.line)
      if (key !== open && now - e.first < delay) {
        wake(e.first + delay)
        continue
      }
      if (snoozes(e.line) && key !== open) {
        const age = now - e.first - delay
        if (age >= IDLE_SHOW_MS + IDLE_SNOOZE_MS) e.first = now - delay
        else if (age >= IDLE_SHOW_MS) {
          wake(e.first + delay + IDLE_SHOW_MS + IDLE_SNOOZE_MS)
          continue
        } else wake(e.first + delay + IDLE_SHOW_MS)
      }
      if (!e.arrived && key !== open && waitsForArrival(e.line) && isWalking(e.line.speakerId) && now - e.first < ARRIVE_MAX_MS) {
        wake(Math.min(now + ARRIVE_POLL_MS, e.first + ARRIVE_MAX_MS))
        continue
      }
      e.arrived = true
      if (e.line.kind === 'reflection') {
        if (now - e.first >= REFLECTION_MS) continue
        wake(e.first + REFLECTION_MS)
      }
      live.push(e.line)
    }
    // Keep candidate order (priority), lingering lines after their peers.
    const pos = new Map(cands.map((c, i) => [c.key, i]))
    live.sort((a, b) => (pos.get(a.key) ?? cands.length) - (pos.get(b.key) ?? cands.length))

    const capped = capBubbles(live, open)
    const next = new Map<string, RoutedLine>()
    for (const l of capped) if (l.kind !== 'ambient') next.set(l.key, l)
    // Ambient lines fade by their own 3 s animation; everything else fades out over EXIT_MS.
    for (const [k, l] of this.shown) if (!next.has(k) && !this.exits.has(k)) this.exits.set(k, { line: l, until: now + EXIT_MS })
    for (const k of next.keys()) this.exits.delete(k)
    const out: ShownLine[] = [...capped]
    for (const [k, x] of this.exits) {
      if (now >= x.until) {
        this.exits.delete(k)
        continue
      }
      out.push({ ...x.line, exiting: true })
      wake(x.until)
    }
    this.shown = next
    return { lines: out, nextAt: nextAt === Infinity ? null : nextAt }
  }
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const lineOf = (id: string | undefined, stage: number): string => {
  const line = OFFICE_LINES.find((x) => x.id === id)
  return line ? lineText(line, stage) : '…'
}
const questionOf = (id: DecisionCardId, stage: number): string => {
  const card = DECISIONS.find((d) => d.id === id)
  return card ? cardQuestion(card, stage) : '…'
}

function toBubble(l: RoutedLine, stage: number): WorldBubble | null {
  switch (l.kind) {
    case 'ambient':
      return { kind: 'ambient', key: l.key, bubbleId: l.ref, lineId: l.extra ?? '', speakerId: l.speakerId, text: lineOf(l.extra, stage) }
    case 'decision': {
      const cardId = l.ref
      return {
        kind: 'decision',
        key: l.key,
        cardId,
        role: decisionRole(cardId),
        speakerId: l.speakerId,
        text: questionOf(cardId, stage),
        onOpen: () => storeApi().openPanel({ kind: 'decision', cardId }),
      }
    }
    case 'staff':
      return { kind: 'staff', key: l.key, speakerId: l.speakerId, need: l.ref as StaffNeed }
    case 'person':
      return { kind: 'person', key: l.key, speakerId: l.speakerId }
    case 'desk':
      return { kind: 'desk', key: l.key, speakerId: l.speakerId, topic: l.ref as DeskTopic, ...(l.extra ? { refId: l.extra } : null) }
    case 'visitor':
      return { kind: 'visitor', key: l.key, speakerId: l.speakerId, topic: l.ref as VisitorTopic, visitorId: l.extra ?? l.speakerId }
    case 'reflection':
      return { kind: 'reflection', key: l.key, speakerId: l.speakerId, cardId: l.ref, optionIndex: Number(l.extra ?? 0) }
  }
}

export function WorldBubbles({ renderBubble, ambient = true }: { renderBubble?: BubbleRenderer; ambient?: boolean }) {
  const bubbleOpen = useUi((u) => u.bubbleOpen ?? null)
  // A centred card or screen (stage-up, victory, post-mortem, statistics…) or the start call owns the screen.
  const covered = useSceneCovered()
  const key = useGS((s) => selectBubbleKey(s, bubbleOpen))
  const layout = useLayout()
  const mock = useMockState()
  const stage = useGS((s) => s.stage)

  const [timeline] = useState(() => new BubbleTimeline())
  const [wakeups, setWakeups] = useState(0)
  const step = useMemo(() => {
    const cands = key ? key.split('\n').map(lineFromString).filter((l) => ambient || l.kind !== 'ambient') : []
    const s = getGS(mock)
    const alive = (id: string) => s.employees.some((e) => e.id === id) || s.visitors.some((v) => v.id === id)
    return timeline.step(cands, bubbleOpen, performance.now(), alive, mock ? undefined : speakerWalking)
    // `wakeups` re-runs the gate when a delay, linger or exit runs out (nothing in the store changed).
  }, [key, ambient, bubbleOpen, wakeups, timeline])
  useEffect(() => {
    if (step.nextAt === null) return
    const id = window.setTimeout(() => setWakeups((n) => n + 1), Math.max(0, step.nextAt - performance.now()) + 4)
    return () => window.clearTimeout(id)
  }, [step])

  // The expanded bubble is gone (speaker left, card defaulted, need resolved): let time run again.
  useEffect(() => {
    if (bubbleOpen !== null && !step.lines.some((l) => l.key === bubbleOpen && !l.exiting)) storeApi().setBubbleOpen(null)
  }, [step, bubbleOpen])

  const list = useMemo(() => step.lines.map((l) => ({ b: toBubble(l, stage), exiting: !!l.exiting, pin: isPinned(l) ? l.speakerId : null })), [step, stage])
  const gs = getGS(mock)
  /** A pinned pill (burnout, notice) stays over the person's desk while they walk (a moving target slides under the thumb). */
  const deskOf = (employeeId: string | null): [number, number] | undefined => {
    const slot = employeeId ? gs.employees.find((e) => e.id === employeeId)?.deskSlotId : undefined
    return slot ? (layout.itemCenter.get(slot)?.pos ?? layout.slotWorld.get(slot)) : undefined
  }

  // Overlaps (same or different speakers) are resolved in screen space by the layout driver.
  const [registry] = useState(() => new BubbleLayoutRegistry())
  useEffect(() => {
    registry.openKey = bubbleOpen
    registry.covered = covered
    registry.dirty = true
  }, [registry, bubbleOpen, covered])
  useBubbleLayoutDriver(registry)
  const render = renderBubble ?? ((b: WorldBubble) => <DefaultBubble bubble={b} />)
  return (
    <group>
      {list.map(({ b, exiting, pin }) =>
        b ? (
          <BubbleAnchor
            key={b.key}
            layoutKey={b.key}
            kind={b.kind}
            layout={registry}
            speakerId={b.speakerId}
            fallback={layout.center}
            pinAt={deskOf(pin)}
            interactive={b.kind !== 'ambient' && b.kind !== 'reflection'}
            openKey={bubbleOpen}
            exiting={exiting}
          >
            {render(b)}
          </BubbleAnchor>
        ) : null,
      )}
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
  // Staff, person, desk, visitor and reflection bubbles need the ui renderer (options, chips); none without it.
  if (bubble.kind === 'staff' || bubble.kind === 'person' || bubble.kind === 'desk' || bubble.kind === 'visitor' || bubble.kind === 'reflection') return null
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
