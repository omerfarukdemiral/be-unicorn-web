// zustand store: the only bridge between the pure engine and render/ui.
// dispatch → engine.applyAction; tick → fixed engine steps (FIXED_STEP_DAYS) scaled by the effective speed
// (time.speed = the player's choice, held at 0 while any ui.pauseReasons is active: modal, decision, concept card,
// round size choice / weekly pitch in Büyüme › Tur, the payday desk open on a waiting month; a center screen never
// holds it).
// After each tick: a new concept goes straight to the Kazanımlar badge (no scene bubble), an interrupting event closes
// the center screen, and at 4× an important moment slows the run to 1× for a few game days, then back to 4×
// (docs/GAMEPLAY_V2.md §3.6, §12). A card shown
// lands in the Keşif record (localStorage 'be-unicorn:codex', outside the engine and the save, §9.2).
import { create } from 'zustand'
import { DECISIONS } from '../content'
import { applyAction, createGame, step } from '../engine'
import { applySnapshot, buyCost } from '../engine/layout'
import { autoArrangeDraft, presetDraft, savedDraft } from '../engine/layoutPlans'
import * as B from '../engine/balance'
import { FIXED_STEP_DAYS, FOUNDER_SLOT_ID, INITIAL_WIDGETS, SECONDS_PER_DAY, type Action, type ConceptId, type GameEventKind, type GameSpeed, type GameState, type LayoutSnapshot, type NewGameOptions, type SavedLayout } from '../engine/types'
import { clearSave, readCodex, readProfile, readSave, readUiSave, writeCodex, writeProfile, writeSave, writeUiSave } from './save'
import { addPin, autoPin, defaultPins, removePin } from './metricPins'
import { isDirty, reduceLayoutEdit, startEdit, storedPieces } from './layoutEdit'
import { clearRunOnScreen } from './session'
import { CENTER_KINDS, type Codex, type GameStore, type Overlay, type Panel, type PauseReason, type ReplayLog, type Selection, type UiState, type ZoomLevel } from './types'

export { SAVE_KEY } from './save'

/** Upper bound of engine days advanced by one tick (keeps a hitch from fast-forwarding). */
const MAX_DAYS_PER_TICK = 4

const NO_INSET = { top: 0, right: 0, bottom: 0 }

/**
 * Events that interrupt a center screen: it closes so no card or payday desk is hidden behind it.
 * docs/GAMEPLAY_V2.md §3.6.
 */
const INTERRUPTS: readonly GameEventKind[] = [
  'decisionShown',
  'paydayShort',
  'crisis',
  // The early round window opening is the "tur teklifi" moment.
  'roundWindow',
  // Payroll could not be paid: the bankruptcy clock started (phase 3).
  'payrollMissed',
  'roundFailed',
  'loanCalled',
]
export const INTERRUPT_EVENT_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>(INTERRUPTS)

/**
 * Events that bring a card (a decision, the payday desk). They never slow 4×: an open card pauses through pauseReasons
 * and the player's chosen speed comes back as it closes (F1, DECISIONS #35). The one exception is an urgent card
 * (isUrgentCard): its default lands in days, so it slows 4× like a moment and holds 1× until it is answered.
 */
export const CARD_EVENT_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>(['decisionShown', 'paydayShort'])

const URGENT_CARD_IDS: ReadonlySet<string> = new Set(
  DECISIONS.filter((c) => c.category === 'crisis' || (c.defaultAfterDays !== undefined && c.defaultAfterDays > 0 && c.defaultAfterDays < B.DECISION_DEFAULT_AFTER_DAYS)).map((c) => c.id),
)

/**
 * A card whose default answers it in days, not the usual DECISION_DEFAULT_AFTER_DAYS: a crisis or rescue card
 * (emergency-loan 14 g), the landlord notice (7 g), the board review (30 g). At 4× (0.5 s a day) its default would
 * land in seconds while it sits collapsed, so it keeps the old 1× slowdown and hold (F1 review fix).
 */
export function isUrgentCard(cardId: string | undefined): boolean {
  return cardId !== undefined && URGENT_CARD_IDS.has(cardId)
}

/** Events that are worth watching at 1×: at 4× they slow the run down (never pause). Cards are not among them. */
export const IMPORTANT_EVENT_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>([
  ...INTERRUPTS.filter((k) => !CARD_EVENT_KINDS.has(k)),
  // A crisis showing what it is (GAMEPLAY V2 §5.1): the player plans around it.
  'crisisRevealed',
  'projectLaunched',
  'milestone',
  'bankruptWarning',
  'roundClosed',
  'release',
])

/** Events that start an effort crisis: the game drops to 1× and the person's bubble is pinned (E1 round 3). */
export const EFFORT_CRISIS_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>(['burnedOut', 'resignNotice'])

/** Game days at 1× after an important moment before 4× comes back (~8 s at 1×, SECONDS_PER_DAY = 2.8). */
export const SLOWDOWN_WINDOW_DAYS = 3

/** NEW-5: wall time an important moment holds 1× before the player's speed comes back (≤ 3 s with the timer slack). */
export const SLOWDOWN_MS = 2800

/** Round 6: after a hold ends, moments within this wall time do not start another (one hold per chain). */
export const SLOWDOWN_COOLDOWN_MS = 5000

/** performance.now() when the last moment hold ended (module state: UI timing, never saved). */
let lastHoldEnd = Number.NEGATIVE_INFINITY

/** True while the store itself sends setSpeed (the slowdown and its restore): such a call keeps the pending restore. */
let autoSpeed = false

function autoSetSpeed(speed: GameSpeed): void {
  autoSpeed = true
  try {
    useGameStore.getState().dispatch({ type: 'setSpeed', speed })
  } finally {
    autoSpeed = false
  }
}

/** A payday that leaves less than this many months of runway is an important moment too (docs/CORE_LOOP.md §3.2). */
export const PAYDAY_SLOW_RUNWAY_MONTHS = 3

/**
 * True when `next` brought an event that should slow 4× down to 1× (see IMPORTANT_EVENT_KINDS), with two edges so
 * 4× is not dropped every ~25 s (review fix):
 * - a release only for a new version or a module, not for the updates after 1.0;
 * - a payday only when runway CROSSES below PAYDAY_SLOW_RUNWAY_MONTHS, not on every tight month.
 * Cards never count (CARD_EVENT_KINDS): an open card pauses and the chosen speed stays; an urgent card does (isUrgentCard).
 */
export function hasImportantMoment(prev: GameState, next: GameState): boolean {
  const since = lastEventId(prev)
  for (const e of next.events) {
    if (e.id <= since) continue
    if (e.kind === 'release') {
      // A module delivery (not a refresh, which ships 0 users), the first 1.0 and a version release (a version without a minor) count; a plain update does not.
      const r = next.releases?.find((x) => x.id === e.refId)
      if ((r?.update === undefined && !(r?.module && r.users === 0)) || (r?.version !== undefined && r.minor === undefined)) return true
      continue
    }
    if (IMPORTANT_EVENT_KINDS.has(e.kind)) return true
    if (e.kind === 'decisionShown' && isUrgentCard(e.refId)) return true
    if (e.kind === 'payday') {
      const rc = next.finance.lastReceipt
      const after = rc ? rc.runwayAfter : next.finance.runway
      const before = rc ? rc.runwayBefore : null
      if (after !== null && after < PAYDAY_SLOW_RUNWAY_MONTHS && (before === null || before >= PAYDAY_SLOW_RUNWAY_MONTHS)) return true
    }
  }
  return false
}

/** Who the new events in `next` put in an effort crisis (burnt out, handed in a notice). */
export function newCrises(prev: GameState, next: GameState): string[] {
  const since = lastEventId(prev)
  const out: string[] = []
  for (const e of next.events) if (e.id > since && EFFORT_CRISIS_KINDS.has(e.kind) && e.refId !== undefined && !out.includes(e.refId)) out.push(e.refId)
  return out
}

/** Still in crisis: in the company and burnt out or on notice. */
const inCrisis = (s: GameState, id: string): boolean => {
  const e = s.employees.find((x) => x.id === id)
  return e !== undefined && (e.status === 'leaving' || e.status === 'burnout')
}

/**
 * Effort crisis hold: a burnout or notice at 2× / 4× drops the speed to 1× (a real setSpeed, like the moment slowdown)
 * for SLOWDOWN_MS of wall time (round 6: one hold per chain, never waiting on a tap; the person's bubble keeps asking),
 * then the player's speed comes back. A new crisis during the hold joins it without extending it. Honours
 * "Önemli anda yavaşla".
 */
function effortCrisisStep(prev: GameState, next: GameState): void {
  const ui = useGameStore.getState().ui
  const crisis = newCrises(prev, next)
  // At 1× inside a moment slowdown the player's speed is the one waiting to come back.
  const waiting = next.time.speed === 1 && ui.slowdownResumeDay !== null
  const hold = ui.effortHold
  if (ui.decisionSlow) return
  if (crisis.length > 0 && !hold && ui.slowOnMoments && (next.time.speed > 1 || waiting) && (waiting || performance.now() - lastHoldEnd >= SLOWDOWN_COOLDOWN_MS)) {
    autoSetSpeed(1)
    useGameStore.setState((s) => ({
      ui: {
        ...s.ui,
        // A moment hold already running keeps its start: the chain stays one hold.
        slowdownAt: waiting && s.ui.slowdownAt !== null ? s.ui.slowdownAt : performance.now(),
        // The 4× restore of an important moment would undo the hold: the hold hands the speed back itself.
        slowdownResumeDay: null,
        effortHold: { employeeIds: crisis, untilDay: next.time.day + B.EFFORT_HOLD_DAYS, prevSpeed: waiting ? (s.ui.chosenSpeed > 1 ? s.ui.chosenSpeed : 4) : next.time.speed },
      },
    }))
    if (typeof window !== 'undefined') window.setTimeout(endEffortHoldIfDue, SLOWDOWN_MS + 20)
    return
  }
  if (!hold) return
  if (crisis.length > 0) {
    useGameStore.setState((s) => ({ ui: { ...s.ui, effortHold: { ...hold, employeeIds: [...new Set([...hold.employeeIds, ...crisis])] } } }))
  }
  endEffortHoldIfDue()
}

function endEffortHoldIfDue(): void {
  const { ui, state } = useGameStore.getState()
  const hold = ui.effortHold
  if (!hold || state.gameOver || ui.pauseReasons.length > 0) return
  // Ends when the people in crisis are answered or gone, or after SLOWDOWN_MS of wall time, whichever comes first.
  const open = hold.employeeIds.some((id) => inCrisis(state, id))
  if (open && ui.slowdownAt !== null && performance.now() - ui.slowdownAt < SLOWDOWN_MS) return
  useGameStore.setState((s) => ({ ui: { ...s.ui, effortHold: null } }))
  lastHoldEnd = performance.now()
  if (state.time.speed === 1) autoSetSpeed(hold.prevSpeed)
}

/** True when `next` brought an event that closes an open center screen (INTERRUPT_EVENT_KINDS). */
export function hasInterrupt(prev: GameState, next: GameState): boolean {
  const since = lastEventId(prev)
  return next.events.some((e) => e.id > since && INTERRUPT_EVENT_KINDS.has(e.kind))
}

/** Stable empty list (older saves have no goalsDone). */
const NO_GOALS: readonly string[] = []

/** Concepts waiting to be read: the one just arrived plus the minimized ones, never a learned one. */
export function waitingConcepts(s: GameState): ConceptId[] {
  const c = s.concepts
  const out = c.minimized.filter((id) => !c.learned.includes(id))
  if (c.active && !c.learned.includes(c.active.id) && !out.includes(c.active.id)) out.push(c.active.id)
  return out
}

/** Stage goals done since Yol haritası was last opened (the dot on the stage name). */
export function unseenGoals(s: GameState, seenGoals: readonly string[]): number {
  return (s.goalsDone ?? NO_GOALS).filter((id) => !seenGoals.includes(id)).length
}

/** Everything newly earned (docs/GAMEPLAY_V2.md §12): concepts waiting to be read + unseen stage goals (the milestone cue). */
export function achievementsBadge(s: GameState, seenGoals: readonly string[]): number {
  return waitingConcepts(s).length + unseenGoals(s, seenGoals)
}

/** Last step of each card thread (rival's step 4 has two branches; the investor's step 5 is the exit offer). */
const THREAD_LAST: Readonly<Record<string, number>> = DECISIONS.reduce<Record<string, number>>((acc, c) => {
  if (c.thread) acc[c.thread.id] = Math.max(acc[c.thread.id] ?? 0, c.thread.step)
  return acc
}, {})

/**
 * The Keşif record after `next` (docs/GAMEPLAY_V2.md §9.2): every `decisionShown` card is seen, a thread's last step
 * marks it done. Returns the same object when nothing new came (no write, no render).
 */
export function codexAfter(codex: Codex, prev: GameState, next: GameState): Codex {
  const since = lastEventId(prev)
  let out = codex
  for (const e of next.events) {
    if (e.id <= since || e.kind !== 'decisionShown' || !e.refId) continue
    const card = DECISIONS.find((d) => d.id === e.refId)
    if (!card) continue
    if (!out.seenCards.includes(card.id)) out = { ...out, seenCards: [...out.seenCards, card.id] }
    const th = card.thread
    if (th && th.step >= (THREAD_LAST[th.id] ?? Infinity) && !out.threadsDone.includes(th.id)) out = { ...out, threadsDone: [...out.threadsDone, th.id] }
  }
  return out
}

/** The Keşif grid's own cells: every thread step and secret card (ordinary cards are not collected). */
const CODEX_CARDS = DECISIONS.filter((d) => d.thread || d.secret)

/** Keşif count: grid cells seen out of all of them ("23/64"), so the number matches the tiles. */
export function codexCount(codex: Codex): { n: number; total: number } {
  return { n: CODEX_CARDS.filter((d) => codex.seenCards.includes(d.id)).length, total: CODEX_CARDS.length }
}

const initialUi = (saved = readUiSave()): UiState => ({
  panel: null,
  panelBack: null,
  hoverSlotId: null,
  overlay: null,
  placing: null,
  zoom: 1,
  lastError: null,
  pauseReasons: [],
  runStarted: false,
  generation: 0,
  sceneInset: NO_INSET,
  decisionExpanded: false,
  bubbleOpen: null,
  slowOnMoments: true,
  slowdownAt: null,
  slowdownResumeDay: null,
  chosenSpeed: 1,
  effortHold: null,
  decisionSlow: null,
  pinnedMetrics: saved.pinnedMetrics ?? [],
  seenMetrics: saved.seenMetrics ?? [...INITIAL_WIDGETS],
  pinTouched: saved.pinTouched ?? false,
  seenGoals: saved.seenGoals ?? [],
  codex: readCodex(),
  layoutEdit: null,
  storageSeen: null,
})

/** UI fields that survive newGame()/load() (player preferences of this session, top-bar pins included). */
const keptUi = (ui: UiState): Pick<UiState, 'zoom' | 'slowOnMoments' | 'generation' | 'pinnedMetrics' | 'pinTouched'> => ({
  zoom: ui.zoom,
  slowOnMoments: ui.slowOnMoments,
  generation: ui.generation + 1,
  pinnedMetrics: ui.pinnedMetrics,
  pinTouched: ui.pinTouched,
})

/** Writes the UI profile (pins, seen gauges, seen goals) to localStorage 'be-unicorn:ui'. */
function persistUi(ui: UiState): void {
  writeUiSave({ pinnedMetrics: ui.pinnedMetrics, seenMetrics: ui.seenMetrics, pinTouched: ui.pinTouched, seenGoals: ui.seenGoals })
}

/**
 * Automatic pinning (docs/LAYOUT.md §5.2): a gauge unlocked by this step fills a free top-bar slot until the player
 * pins or unpins by hand. Keeps the old UiState when nothing changed.
 */
function withAutoPins(ui: UiState, prev: GameState, next: GameState): UiState {
  if (ui.pinTouched || next.unlockedWidgets.length === prev.unlockedWidgets.length) return ui
  const fresh = next.unlockedWidgets.filter((id) => !prev.unlockedWidgets.includes(id))
  const pins = autoPin(ui.pinnedMetrics, fresh, next.unlockedWidgets)
  if (pins === ui.pinnedMetrics) return ui
  const out = { ...ui, pinnedMetrics: pins }
  persistUi(out)
  return out
}

/**
 * A round choice waits for the player: the early window is open (size chooser) or this week's pitch is due
 * (docs/CORE_LOOP.md §4.3). Read with the Tur section open, it is the `offer` focus pause.
 */
export function offerWaiting(s: GameState): boolean {
  const r = s.round
  if (r?.active) return r.pitchDue !== undefined
  return s.derived.canStartRound && !s.gameOver
}

/**
 * The open overlay when it is a blocking modal; null for none, a center screen (time flows under those) or the payday
 * desk (it holds time through its own `payday` reason, only while a month waits on it).
 */
export function blockingOverlay(ui: Pick<UiState, 'overlay'>): Overlay | null {
  return ui.overlay && !CENTER_KINDS.has(ui.overlay.kind) && ui.overlay.kind !== 'payday' ? ui.overlay : null
}

/** GAMEPLAY V2 §6.1: the payday desk is open on a month waiting on it (the `payday` pause). */
export function paydayDeskOpen(ui: Pick<UiState, 'overlay'>, state?: GameState): boolean {
  return ui.overlay?.kind === 'payday' && !!state?.finance.pendingPayday && !state.gameOver
}

/** True when a center screen (statistics, Kanun Kitabı, Pazar haritası) is open. */
export function centerOpen(ui: Pick<UiState, 'overlay'>): boolean {
  return !!ui.overlay && CENTER_KINDS.has(ui.overlay.kind)
}

/**
 * Focus pauses implied by what is open (one mechanism for modals, decision cards, Defter cards and round offers).
 * A center screen is not one: it shows, it does not ask for a decision (docs/GAMEPLAY_V2.md §14.1).
 * `concept` holds only while the card itself is open; a concept arriving never pauses.
 */
export function pauseReasonsOf(ui: Pick<UiState, 'overlay' | 'panel'> & { decisionExpanded?: boolean; bubbleOpen?: string | null; layoutEdit?: unknown }, state?: GameState): PauseReason[] {
  const r: PauseReason[] = []
  if (blockingOverlay(ui)) r.push('modal')
  const p = ui.panel
  if ((p?.kind === 'decision' && p.answered === undefined) || ui.decisionExpanded) r.push('decision')
  if (p?.kind === 'journal' && p.conceptId) r.push('concept')
  // Only Büyüme › Tur draws the size picker (the plain hub shows a one-row summary that opens it), so only it holds the
  // size choice or a weekly pitch; the hub, and the running round itself, never pause (§14.1: showing is not deciding).
  if (p?.kind === 'growth' && p.section === 'round' && state && offerWaiting(state)) r.push('offer')
  if (paydayDeskOpen(ui, state)) r.push('payday')
  if (ui.bubbleOpen != null) r.push('bubble')
  // The office edit mode holds the world: nobody walks into a desk that is being moved.
  if (ui.layoutEdit != null) r.push('layout')
  return r
}

/** The payday desk stays open only while a month waits on it (answered or defaulted → it closes). */
function withDesk(ui: UiState, state: GameState): UiState {
  return ui.overlay?.kind === 'payday' && !state.finance.pendingPayday ? { ...ui, overlay: null } : ui
}

/** Recomputes ui.pauseReasons after a panel/overlay/state change; keeps the old UiState when nothing changed. */
function withPause(ui: UiState, state: GameState): UiState {
  const next = pauseReasonsOf(ui, state)
  const cur = ui.pauseReasons
  if (next.length === cur.length && next.every((x, i) => x === cur[i])) return ui
  return { ...ui, pauseReasons: next }
}

/** Speed the world actually runs at: the player's speed unless a focus pause holds it (or the run is over). */
export function effectiveSpeed(st: { state: GameState; ui: UiState }): GameSpeed {
  if (st.state.gameOver || st.ui.pauseReasons.length > 0) return 0
  return st.state.time.speed
}

/**
 * The speed time comes back to (N6): the running speed the player picked, also while an automatic 1× (a moment
 * slowdown, an effort hold) or a pause holds it. "Karar · 4×", Space, the pause key and the phone pill all use it.
 */
export function resumeSpeed(st: { state: GameState; ui: UiState }): GameSpeed {
  const sp = st.state.time.speed
  if (st.ui.decisionSlow && sp > 0) return st.ui.decisionSlow
  if (sp > 0 && st.ui.slowdownResumeDay === null && st.ui.effortHold === null) return sp
  if (st.ui.effortHold && sp > 0) return st.ui.effortHold.prevSpeed
  return st.ui.chosenSpeed
}

const actionListeners = new Set<(a: Action) => void>()

/** Hears every applied action (round 8: the chip's confirm watch, ui/chipConfirm.ts). */
export function onAction(f: (a: Action) => void): () => void {
  actionListeners.add(f)
  return () => actionListeners.delete(f)
}

/** New game / continue: the world waits for the player's first "Başlat". */
function pausedStart(s: GameState): GameState {
  return s.time.speed === 0 ? s : { ...s, time: { ...s.time, speed: 0 } }
}

/** Scene selection shown by the panel (detail, or the slot a targeted shop buys for). Render highlights it. */
export function panelSelection(panel: Panel | null): Selection | null {
  if (!panel) return null
  if (panel.kind === 'detail') return panel.selection
  if (panel.kind === 'shop' && panel.slotTarget) {
    // Stable per panel object, so selectors (tuples, useShallow) see the same reference every call.
    let sel = targetSelections.get(panel)
    if (!sel) targetSelections.set(panel, (sel = { kind: 'slot', id: panel.slotTarget }))
    return sel
  }
  return null
}
const targetSelections = new WeakMap<Panel, Selection>()

function samePanel(a: Panel | null, b: Panel | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * True while the visitor who brought `id` is still standing in the office. minimizeConcept sends that visitor away,
 * so the store only shelves the concept after the visitor's own stay (CONCEPT_VISITOR_DAYS) is over.
 */
function conceptVisitorStays(s: GameState, id: ConceptId): boolean {
  return s.visitors.some((v) => v.purpose === 'concept' && v.refId === id && v.leaveDay > s.time.day)
}

/** Concept a visitor came to tell, while it is still unread (they stand silently until tapped). */
function visitorConcept(s: GameState, visitorId: string): ConceptId | null {
  const v = s.visitors.find((x) => x.id === visitorId)
  if (v?.purpose !== 'concept' || !v.refId) return null
  const id = v.refId as ConceptId
  return s.concepts.triggered.includes(id) && !s.concepts.learned.includes(id) ? id : null
}

/** Empty slot in an open ring (not the founder desk): tapping it goes straight to the shop. */
function isEmptyOpenSlot(s: GameState, id: string): boolean {
  const slot = s.office.slots.find((x) => x.id === id)
  if (!slot || slot.id === FOUNDER_SLOT_ID || slot.itemId !== undefined || slot.spanOf !== undefined) return false
  return slot.ring === 0 || s.office.rings.some((r) => r.index === slot.ring && r.unlocked)
}

/**
 * A slot detail whose item just left (sold, moved away) would show a dead-end "Boş slot" page.
 * Move → follow the item to its new slot; otherwise → the shop targeted at the now empty slot.
 */
function retargetEmptiedDetail(action: Action, s: GameState): void {
  const { ui, openPanel } = useGameStore.getState()
  const p = ui.panel
  if (p?.kind !== 'detail' || p.selection.kind !== 'slot' || !isEmptyOpenSlot(s, p.selection.id)) return
  if (action.type === 'moveItem') {
    if (action.toSlotId !== undefined) openPanel({ kind: 'detail', selection: { kind: 'slot', id: action.toSlotId } }, { replace: true })
  }
  else openPanel({ kind: 'shop', slotTarget: p.selection.id }, { replace: true })
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** Replay log lives outside zustand: appended in place, never triggers renders. Capped. */
const REPLAY_MAX = 20_000
let replay: ReplayLog = { seed: 1, runIndex: 0, fromSave: false, actions: [] }
function resetReplay(s: GameState, fromSave: boolean): void {
  replay = { seed: s.rng.seed, runIndex: s.meta.runIndex, fromSave, actions: [] }
}

/** Id of the newest engine event (the events buffer is ordered by id). */
function lastEventId(s: GameState): number {
  return s.events[s.events.length - 1]?.id ?? 0
}

/** Fractional days not yet stepped (below one fixed chunk). Reset on new game / load. */
let pendingDays = 0

/** Records XP once the run ends so a reload still carries it into the next run. */
/** NEW-4: the UI once the run is over: every panel, bubble, placement and edit closed (the end overlay stays). */
export function endOfRunUi(ui: UiState, state: GameState): UiState {
  return withPause({ ...ui, panel: null, panelBack: null, bubbleOpen: null, decisionExpanded: false, placing: null, layoutEdit: null }, state)
}

function onGameOver(s: GameState): void {
  if (!s.gameOver) return
  writeProfile({ founderXp: s.meta.founderXp + s.gameOver.xpEarned, runIndex: s.meta.runIndex + 1 })
  clearSave()
  // A reload after the end shows the start card, not an auto-resume (there is nothing left to resume).
  clearRunOnScreen('gameOver')
  // NEW-4: the run is over: no panel, bubble, placement or edit stays up behind (or answers under) the end screen.
  // The end overlay itself comes from ModalHost.
  useGameStore.setState((st) => ({ ui: endOfRunUi(st.ui, st.state) }))
}

function freshState(opts?: Partial<NewGameOptions>): GameState {
  const profile = readProfile()
  const full: NewGameOptions = {
    seed: opts?.seed ?? randomSeed(),
    founderXp: opts?.founderXp ?? profile.founderXp,
    runIndex: opts?.runIndex ?? profile.runIndex,
    companyName: opts?.companyName,
  }
  return createGame(full)
}

export const useGameStore = create<GameStore>()((set, get) => ({
  // Placeholder run until the start screen calls newGame() or load().
  state: createGame({ seed: 1 }),
  ui: initialUi(),

  dispatch(action) {
    const { state } = get()
    const res = applyAction(state, action)
    if (!res.ok) {
      set((s) => ({ ui: { ...s.ui, lastError: { code: res.error ?? 'invalid', at: performance.now(), action: action.type, ...(action.type === 'founderAction' ? { detail: action.kind } : null) } } }))
      return res
    }
    if (replay.actions.length < REPLAY_MAX) replay.actions.push({ atDay: state.time.day, action })
    // Before the UI follows the new state (a fire empties its detail panel): the chip's confirm watch hears it first.
    for (const f of actionListeners) f(action)
    const starts = action.type === 'setSpeed' && action.speed > 0 && !get().ui.runStarted
    // A round choice made (size picked, pitch sent) ends the `offer` pause: pause reasons follow the new state.
    // The payday desk closes once its month is answered (`payday` pause ends with it).
    set((s) => ({ state: res.state, ui: withAutoPins(withPause(withDesk(starts ? { ...s.ui, runStarted: true } : s.ui, res.state), res.state), state, res.state) }))
    retargetEmptiedDetail(action, res.state)
    // The player's own running speed is the one every pause hands back (N6).
    if (action.type === 'setSpeed' && !autoSpeed && action.speed > 0 && get().ui.chosenSpeed !== action.speed) set((s) => ({ ui: { ...s.ui, chosenSpeed: action.speed } }))
    // The player's own speed choice always wins over a pending 4× restore.
    if (action.type === 'setSpeed' && !autoSpeed && (get().ui.slowdownResumeDay !== null || get().ui.effortHold !== null || get().ui.decisionSlow !== null)) set((s) => ({ ui: { ...s.ui, slowdownResumeDay: null, effortHold: null, decisionSlow: null } }))
    if (res.state.gameOver && !state.gameOver) onGameOver(res.state)
    // The expanded scene bubble's card is gone (answered): its focus pause ends with it.
    if (!res.state.decisions.active && get().ui.decisionExpanded) get().setDecisionExpanded(false)
    // Any real action answers the open scene bubble (a speed change is not an answer): the world resumes.
    if (res.ok && action.type !== 'setSpeed' && get().ui.bubbleOpen) get().setBubbleOpen(null)
    return res
  },

  tick(realDtSeconds) {
    const { state } = get()
    const speed = effectiveSpeed(get())
    if (speed === 0 || !(realDtSeconds > 0)) return
    pendingDays = Math.min(MAX_DAYS_PER_TICK, pendingDays + (realDtSeconds / SECONDS_PER_DAY) * speed)
    const chunks = Math.floor(pendingDays / FIXED_STEP_DAYS + 1e-9)
    if (chunks <= 0) return
    pendingDays -= chunks * FIXED_STEP_DAYS
    // step() works in FIXED_STEP_DAYS chunks internally: one call == `chunks` separate calls.
    const next = step(state, chunks * FIXED_STEP_DAYS)
    if (next === state) return
    // A pitch falling due with the Tur section open pauses right away (`offer`).
    set((s) => ({ state: next, ui: withAutoPins(withPause(withDesk(s.ui, next), next), state, next) }))
    if (next.gameOver && !state.gameOver) {
      onGameOver(next)
      return
    }
    afterStep(state, next)
  },

  newGame(opts) {
    pendingDays = 0
    lastHoldEnd = Number.NEGATIVE_INFINITY
    const state = pausedStart(freshState(opts))
    writeProfile({ founderXp: state.meta.founderXp, runIndex: state.meta.runIndex })
    resetReplay(state, false)
    // A fresh run: every gauge beyond the first three is new again (pins stay, locked until relearned).
    const ui: UiState = { ...initialUi(), ...keptUi(get().ui), seenMetrics: [...INITIAL_WIDGETS], seenGoals: [] }
    set({ state, ui })
    persistUi(ui)
    writeSave(state)
  },

  save() {
    const { state } = get()
    if (state.gameOver) return
    // Focus pauses are UI state and never touch time.speed: the save keeps the player's speed.
    writeSave(state)
  },

  load() {
    lastHoldEnd = Number.NEGATIVE_INFINITY
    const saved = readSave()
    if (!saved || saved.gameOver) return false
    const state = pausedStart(saved)
    pendingDays = 0
    resetReplay(state, true)
    // Pins and seen gauges come from the UI profile; an old profile without `seenMetrics` counts what the save
    // already unlocked as seen (no badge storm on continue).
    const prof = readUiSave()
    const kept = keptUi(get().ui)
    const pinTouched = prof.pinTouched ?? kept.pinTouched
    const pins = prof.pinnedMetrics ?? kept.pinnedMetrics
    // A mid-game save loaded by a player who never picked pins: fill the free slots with the defaults (Burn, Kâr
    // tahmini) so the old HUD's secondary numbers do not simply vanish (auto-pin only reacts to NEW unlocks).
    const pinnedMetrics = pinTouched ? pins : defaultPins(pins, state.unlockedWidgets)
    const ui: UiState = {
      ...initialUi(prof),
      ...kept,
      pinnedMetrics,
      pinTouched,
      seenMetrics: prof.seenMetrics ?? [...state.unlockedWidgets],
      // An old profile without seenGoals counts the save's goals as seen (no badge on continue).
      seenGoals: prof.seenGoals ?? [...(state.goalsDone ?? NO_GOALS)],
    }
    set({ state, ui })
    if (pinnedMetrics.join() !== pins.join()) persistUi(ui)
    return true
  },

  exportReplay: () => ({ ...replay, actions: [...replay.actions] }),

  select(selection) {
    const { ui, state, openPanel, closePanel, panelGoBack } = get()
    // The edit mode picks pieces by cell (render/LayoutEditor): people, slots and the floor select nothing.
    if (ui.layoutEdit) return
    if (!selection) {
      if (ui.bubbleOpen) get().setBubbleOpen(null)
      // Empty floor: leave a detail / targeted shop the way the back button does (a dock tab stays open).
      if (ui.panel?.kind === 'detail' || (ui.panel?.kind === 'shop' && ui.panel.slotTarget)) {
        if (ui.panelBack) panelGoBack()
        else closePanel()
      }
      return
    }
    if (selection.kind === 'slot' && isEmptyOpenSlot(state, selection.id)) openPanel({ kind: 'shop', slotTarget: selection.id })
    else if (selection.kind === 'visitor' && visitorConcept(state, selection.id)) {
      // The visitor who brought a concept stands silently; tapping them opens the card (the only concept pause).
      const conceptId = visitorConcept(state, selection.id)!
      if (!state.concepts.learned.includes(conceptId)) get().dispatch({ type: 'openConcept', conceptId })
      openPanel({ kind: 'journal', conceptId })
    } else openPanel({ kind: 'detail', selection })
  },
  openPanel(panel, opts) {
    set((s) => {
      // The edit mode owns the panel until Vazgeç / Bitti.
      if (s.ui.layoutEdit && panel.kind !== 'layout') return s
      const cur = s.ui.panel
      if (samePanel(cur, panel)) return s
      const panelBack = opts?.root ? null : opts?.replace ? s.ui.panelBack : cur
      // One surface: a panel replaces an open center screen (a blocking modal stays).
      const overlay = centerOpen(s.ui) ? null : s.ui.overlay
      return { ui: withPause({ ...s.ui, panel, panelBack, overlay }, s.state) }
    })
  },
  togglePanel(tab) {
    const { ui, openPanel, closePanel } = get()
    // Same tab again closes (a targeted shop counts as the shop tab).
    if (ui.panel?.kind === tab) closePanel()
    else openPanel({ kind: tab }, { root: true })
  },
  closePanel: () => {
    // Closing the layout panel is Vazgeç: the draft goes, nothing moved.
    if (get().ui.layoutEdit) return get().cancelLayoutEdit()
    set((s) => (s.ui.panel === null && s.ui.panelBack === null ? s : { ui: withPause({ ...s.ui, panel: null, panelBack: null }, s.state) }))
  },
  panelGoBack: () => set((s) => (s.ui.panelBack ? { ui: withPause({ ...s.ui, panel: s.ui.panelBack, panelBack: null }, s.state) } : s)),
  setHoverSlot: (hoverSlotId) => set((s) => (s.ui.hoverSlotId === hoverSlotId ? s : { ui: { ...s.ui, hoverSlotId } })),
  openOverlay: (overlay) =>
    set((s) => {
      // A center screen would cover the office being edited.
      if (s.ui.layoutEdit && CENTER_KINDS.has(overlay.kind)) return s
      // A center screen and the panel are one surface (phones have room for one): the screen closes the panel.
      if (CENTER_KINDS.has(overlay.kind)) return { ui: withPause({ ...s.ui, overlay, panel: null, panelBack: null }, s.state) }
      return { ui: withPause({ ...s.ui, overlay }, s.state) }
    }),
  toggleCenter(kind) {
    const { ui, openOverlay, closeOverlay } = get()
    if (ui.overlay?.kind === kind) closeOverlay()
    // Neither a blocking modal nor the payday desk is replaced by a center screen.
    else if (!blockingOverlay(ui) && ui.overlay?.kind !== 'payday') openOverlay({ kind })
  },
  closeOverlay: () =>
    set((s) => {
      // "Yeni ofise geç": the new office opens paused with the Başlat call, like a new game (docs/CORE_LOOP.md §3.2
      // rule 1, §4.3 "Yerleşme"). Like pausedStart this is not a player action: the replay keeps the player's choices.
      if (s.ui.overlay?.kind === 'moveScene' && !s.state.gameOver) {
        pendingDays = 0
        const state = pausedStart(s.state)
        return { state, ui: withPause({ ...s.ui, overlay: null, runStarted: false }, state) }
      }
      return { ui: withPause({ ...s.ui, overlay: null }, s.state) }
    }),
  setPlacing: (placing) => set((s) => ({ ui: { ...s.ui, placing } })),
  // The edit mode shows the whole office: the close zoom (selection follow) waits until it ends.
  setZoom: (zoom) => set((s) => ({ ui: { ...s.ui, zoom: s.ui.layoutEdit ? (Math.min(zoom, 1) as ZoomLevel) : zoom } })),
  setSceneInset: (inset) =>
    set((s) => {
      const c = s.ui.sceneInset
      return c.top === inset.top && c.right === inset.right && c.bottom === inset.bottom ? s : { ui: { ...s.ui, sceneInset: inset } }
    }),
  setBubbleOpen: (key) => set((s) => (s.ui.bubbleOpen === key ? s : { ui: withPause({ ...s.ui, bubbleOpen: key }, s.state) })),
  setDecisionExpanded: (decisionExpanded) =>
    set((s) => (s.ui.decisionExpanded === decisionExpanded ? s : { ui: withPause({ ...s.ui, decisionExpanded }, s.state) })),
  setSlowOnMoments: (slowOnMoments) => set((s) => (s.ui.slowOnMoments === slowOnMoments ? s : { ui: { ...s.ui, slowOnMoments } })),
  pinMetric(id) {
    const ui = get().ui
    // Over PIN_MAX a pin locked in this run leaves first (it is invisible), then the oldest.
    const pinnedMetrics = addPin(ui.pinnedMetrics, id, get().state.unlockedWidgets)
    // Already pinned or not pinnable: nothing to do.
    if (pinnedMetrics.length === ui.pinnedMetrics.length && pinnedMetrics.every((x, i) => x === ui.pinnedMetrics[i])) return
    const next = { ...ui, pinnedMetrics, pinTouched: true }
    set({ ui: next })
    persistUi(next)
  },
  unpinMetric(id) {
    const ui = get().ui
    const next = { ...ui, pinnedMetrics: removePin(ui.pinnedMetrics, id), pinTouched: true }
    set({ ui: next })
    persistUi(next)
  },
  beginLayoutEdit(tab) {
    const { ui, state } = get()
    if (ui.layoutEdit || state.gameOver || blockingOverlay(ui) || ui.overlay?.kind === 'payday') return false
    set((s) => ({
      ui: withPause(
        {
          ...s.ui,
          layoutEdit: startEdit(s.state.office, tab),
          storageSeen: storedPieces(s.state.office),
          panel: { kind: 'layout' },
          panelBack: null,
          overlay: centerOpen(s.ui) ? null : s.ui.overlay,
          placing: null,
          hoverSlotId: null,
          bubbleOpen: null,
          decisionExpanded: false,
          zoom: Math.min(s.ui.zoom, 1) as ZoomLevel,
        },
        s.state,
      ),
    }))
    return true
  },
  layoutEditOp(op) {
    set((s) => {
      const e = s.ui.layoutEdit
      if (!e) return s
      const next = reduceLayoutEdit(s.state.office, e, op, performance.now(), s.state.stats.cash)
      return next === e ? s : { ui: { ...s.ui, layoutEdit: next } }
    })
  },
  cancelLayoutEdit() {
    set((s) => (s.ui.layoutEdit ? { ui: withPause({ ...s.ui, layoutEdit: null, panel: null, panelBack: null }, s.state) } : s))
  },
  commitLayoutEdit() {
    const e = get().ui.layoutEdit
    if (!e) return null
    if (!isDirty(e)) {
      get().cancelLayoutEdit()
      return { ok: true, state: get().state }
    }
    // Checked before the edit mode closes, so a refusal keeps the draft and says why (the action re-checks anyway).
    const pre = applySnapshot(get().state.office, e.draft)
    // Short of cash for the new pieces: the draft stays and the panel says why (the spend line is already red).
    const preErr = 'error' in pre ? pre.error : pre.cost + buyCost(e.draft) > get().state.stats.cash ? ('insufficientCash' as const) : null
    if (preErr) {
      set((s) => ({
        ui: {
          ...s.ui,
          lastError: { code: preErr, at: performance.now(), action: 'applyLayout' },
          layoutEdit: s.ui.layoutEdit && preErr === 'insufficientCash' ? { ...s.ui.layoutEdit, refused: { cells: [], reason: 'cash', at: performance.now() } } : s.ui.layoutEdit,
        },
      }))
      return { ok: false, state: get().state, error: preErr }
    }
    get().cancelLayoutEdit()
    const res = get().dispatch({ type: 'applyLayout', draft: e.draft })
    if (!res.ok) set((s) => ({ ui: withPause({ ...s.ui, layoutEdit: e, panel: { kind: 'layout' }, panelBack: null }, s.state) }))
    return res
  },
  applyLayoutPlan(plan) {
    const { ui, state } = get()
    const e = ui.layoutEdit
    if (!e) return false
    const live = state.office
    const dept = new Map(state.employees.map((x) => [x.id, x.dept]))
    const deptOf = (id: string) => dept.get(id)
    let draft: LayoutSnapshot | null = null
    let saved: SavedLayout | undefined
    if (plan.kind === 'preset') draft = presetDraft(live, e.draft, plan.preset, deptOf)
    else if (plan.kind === 'auto') draft = autoArrangeDraft(live, e.draft, deptOf)
    else {
      saved = live.saved?.[plan.index]
      draft = saved ? (savedDraft(live, e.draft, saved, deptOf)?.draft ?? null) : null
    }
    get().layoutEditOp({ kind: 'plan', draft, ...(saved ? { saved } : {}) })
    return draft !== null
  },
  saveLayout(name, replace) {
    const e = get().ui.layoutEdit
    if (!e) return null
    return get().dispatch({ type: 'saveLayout', name, draft: e.draft, ...(replace !== undefined ? { replace } : {}) })
  },
  deleteSavedLayout(index) {
    if (!get().ui.layoutEdit) return null
    return get().dispatch({ type: 'deleteLayout', index })
  },
  markStorageSeen() {
    const n = storedPieces(get().state.office)
    if (get().ui.storageSeen !== n) set((s) => ({ ui: { ...s.ui, storageSeen: n } }))
  },
  markGoalsSeen() {
    const { ui, state } = get()
    const done = state.goalsDone ?? NO_GOALS
    if (done.every((id) => ui.seenGoals.includes(id))) return
    const next = { ...ui, seenGoals: [...new Set([...ui.seenGoals, ...done])] }
    set({ ui: next })
    persistUi(next)
  },
  markMetricsSeen(ids) {
    const ui = get().ui
    const add = [...new Set(ids)].filter((x) => !ui.seenMetrics.includes(x))
    if (add.length === 0) return
    const next = { ...ui, seenMetrics: [...ui.seenMetrics, ...add] }
    set({ ui: next })
    persistUi(next)
  },
}))

/**
 * Store-side rules that follow game time (run after every tick that advanced the world):
 * - a concept that arrived never shows as a scene bubble: it counts on the Kazanımlar badge at once, its visitor
 *   stands silently (tap → card) and, once the visitor's stay is over, it moves to the shelf (minimizeConcept);
 * - an interrupting event (a card, the round window, a missed payroll…) closes an open center screen;
 * - at 4× an important event (never a normal card; an urgent one, see isUrgentCard, does) slows the run to 1× (a real setSpeed: the player sees and may undo it) for
 *   SLOWDOWN_MS of real time (NEW-5; a focus pause stops ticks meanwhile, an urgent card still waiting holds it), then the
 *   player's speed comes back the same way; closing a pause ends it at once (N6), a player setSpeed cancels it;
 * - a card shown goes into the Keşif record (storage errors are swallowed by save.ts: play never breaks on them).
 * Engine changes go through dispatch, so the replay log reproduces them.
 */
function afterStep(prev: GameState, next: GameState): void {
  const { dispatch, closeOverlay } = useGameStore.getState()
  const codex = useGameStore.getState().ui.codex
  const seen = codexAfter(codex, prev, next)
  if (seen !== codex) {
    useGameStore.setState((s) => ({ ui: { ...s.ui, codex: seen } }))
    writeCodex(seen)
  }
  const ac = next.concepts.active
  if (ac && !conceptVisitorStays(next, ac.id)) dispatch({ type: 'minimizeConcept', conceptId: ac.id })
  if (centerOpen(useGameStore.getState().ui) && hasInterrupt(prev, next)) closeOverlay()
  effortCrisisStep(prev, next)
  const ui = useGameStore.getState().ui
  // An effort hold owns the speed until it ends.
  if (ui.effortHold) return
  const resumeDay = next.time.day + SLOWDOWN_WINDOW_DAYS
  // Round 6: one hold per chain of moments; a moment right after a hold ended (stage-up, a hire and a module in the
  // same breath) does not start another.
  if (ui.slowOnMoments && next.time.speed === 4 && performance.now() - lastHoldEnd >= SLOWDOWN_COOLDOWN_MS && hasImportantMoment(prev, next)) {
    autoSetSpeed(1)
    useGameStore.setState((s) => ({ ui: { ...s.ui, slowdownAt: performance.now(), slowdownResumeDay: resumeDay } }))
    // NEW-5: a wall-clock timer ends the hold on time even when frames are slow (a busy scene ticks a few times a second).
    if (typeof window !== 'undefined') window.setTimeout(endSlowdownIfDue, SLOWDOWN_MS + 20)
    return
  }
  endSlowdownIfDue()
}

/**
 * NEW-5: the moment holds 1× for SLOWDOWN_MS of wall time (performance.now; a pause stops it meanwhile), then the
 * player's speed comes back. A payday miss, the runway warning or a round close never keep 1× until a tap; only an
 * urgent decision card still waiting holds it (its default lands in days), and an effort hold owns the speed.
 */
function endSlowdownIfDue(): void {
  const { ui, state } = useGameStore.getState()
  if (ui.slowdownResumeDay === null || ui.effortHold || state.gameOver) return
  // Round 6: never waits on a tap, an urgent card still waiting included (its bubble asks on its own).
  if (ui.pauseReasons.length > 0) return
  if (ui.slowdownAt !== null && performance.now() - ui.slowdownAt < SLOWDOWN_MS) return
  useGameStore.setState((s) => ({ ui: { ...s.ui, slowdownResumeDay: null } }))
  lastHoldEnd = performance.now()
  if (state.time.speed === 1) autoSetSpeed(ui.chosenSpeed > 1 ? ui.chosenSpeed : 4)
}

/**
 * N6: a decision / panel / bubble pause that closes during a moment slowdown hands the player's speed back right
 * away (the player has dealt with the moment). A payday or urgent card still waiting keeps the 1× (afterStep).
 */
/**
 * Round 11 watchdog (1× holds still reached 4.7–6.4 s on some paths): while a hold is on, a wall-clock check every
 * 250 ms ends it once due, whatever ticks or pauses did meanwhile. Browser only.
 */
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    const { ui } = useGameStore.getState()
    if (ui.effortHold) endEffortHoldIfDue()
    else if (ui.slowdownResumeDay !== null) endSlowdownIfDue()
  }, 250)
}

/**
 * P5 auto-slow: a decision waiting on the player (a card, a round pitch, the payday desk). While one is open at 2× /
 * 4× the run goes 1× until it closes ("her şey için düşünebilmeyi isterdim").
 */
export function decisionWaiting(s: GameState): boolean {
  return !!s.decisions.active || (!!s.round?.active && s.round.pitchDue !== undefined) || !!s.finance.pendingPayday
}

useGameStore.subscribe((st, prev) => {
  if (st.state === prev.state) return
  const was = decisionWaiting(prev.state)
  const is = decisionWaiting(st.state)
  if (was === is || st.state.gameOver) return
  const { ui, state } = st
  if (is) {
    if (!ui.slowOnMoments || ui.decisionSlow) return
    const back = resumeSpeed(st)
    // A moment slowdown or an effort hold already at 1× hands its pending speed over: the decision now owns it.
    if (state.time.speed < 2 && !(state.time.speed === 1 && back > 1)) return
    useGameStore.setState((s) => ({ ui: { ...s.ui, decisionSlow: back, slowdownAt: performance.now(), slowdownResumeDay: null, effortHold: null } }))
    if (state.time.speed !== 1) autoSetSpeed(1)
    return
  }
  if (!ui.decisionSlow) return
  const back = ui.decisionSlow
  useGameStore.setState((s) => ({ ui: { ...s.ui, decisionSlow: null } }))
  lastHoldEnd = performance.now()
  if (state.time.speed === 1) autoSetSpeed(back)
})

useGameStore.subscribe((st, prev) => {
  if (prev.ui.pauseReasons.length === 0 || st.ui.pauseReasons.length > 0) return
  const { ui, state } = st
  if (ui.slowdownResumeDay === null || ui.effortHold || state.time.speed !== 1 || state.gameOver) return
  useGameStore.setState((s) => ({ ui: { ...s.ui, slowdownResumeDay: null } }))
  lastHoldEnd = performance.now()
  if (ui.chosenSpeed > 1) autoSetSpeed(ui.chosenSpeed)
})
