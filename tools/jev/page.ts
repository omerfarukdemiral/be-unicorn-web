// Jev page bridge: loaded into the running dev app by play.ts (import('/tools/jev/page.ts'), Vite serves it), so it
// shares the app's own engine, content and store modules. It never sees the API key: the Node side talks to the model
// and only sends a move id here. Plain DOM overlay, no app code touched.
import { CONTENT } from '../../src/content/index'
import { createEngine, openDecision, type GameSpeed, type GameState } from '../../src/engine/index'
import { useGameStore } from '../../src/store/gameStore'
import { stepText } from '../../src/ui/loopUi'
import { fallbackMove, legalMoves, observe, type Move, type Observation } from './legal'

export interface JevStatus {
  day: number
  stage: number
  speed: number
  runStarted: boolean
  overlay: string | null
  pauseReasons: readonly string[]
  /** Key of the open decision (changes when a new one opens), null = none. */
  openKey: string | null
  gameOver: { kind: string; day: number } | null
  valuation: number
}

export interface JevSnapshot {
  obs: Observation
  moves: { id: string; label: string; chip?: boolean }[]
  fallback: string
}

export interface JevBridge {
  status(): JevStatus
  snapshot(): JevSnapshot
  apply(id: string): { ok: boolean; error?: string; label?: string }
  setSpeed(speed: GameSpeed): void
  housekeep(): string[]
  overlay(info: { line: string; why: string; meta: string }): void
}

const api = createEngine(CONTENT)
let lastMoves: Move[] = []

function openKey(s: GameState): string | null {
  const open = openDecision(s)
  if (!open) return null
  if (open === 'card') return `card:${s.decisions.active?.cardId}:${s.decisions.active?.shownDay}`
  if (open === 'payday') return `payday:${s.finance.pendingPayday?.day}`
  if (open === 'meeting') return `meeting:${s.round?.startedDay}:${s.derived.round?.meetingIndex ?? ''}:${s.round?.pitchDue ?? ''}`
  return `leaver:${s.employees.filter((e) => e.status === 'leaving').map((e) => `${e.id}@${e.leaveDay}`).join(',')}`
}

function chipLine(s: GameState): string | null {
  const st = s.derived.nextStep
  if (!st) return null
  try {
    return stepText(st, s)
  } catch {
    return null
  }
}

const bridge: JevBridge = {
  status() {
    const { state: s, ui } = useGameStore.getState()
    return {
      day: s.time.day,
      stage: s.stage,
      speed: s.time.speed,
      runStarted: ui.runStarted,
      overlay: ui.overlay?.kind ?? null,
      pauseReasons: ui.pauseReasons,
      openKey: openKey(s),
      gameOver: s.gameOver ? { kind: s.gameOver.kind, day: s.gameOver.day } : null,
      valuation: s.finance.valuation,
    }
  },
  snapshot() {
    const s = useGameStore.getState().state
    const chip = chipLine(s)
    lastMoves = legalMoves(s, CONTENT, api, chip)
    const fb = fallbackMove(s, CONTENT, lastMoves)
    return { obs: observe(s, CONTENT, chip), moves: lastMoves.map((m) => ({ id: m.id, label: m.label, ...(m.chip ? { chip: true } : {}) })), fallback: fb.id }
  },
  apply(id) {
    const m = lastMoves.find((x) => x.id === id)
    if (!m) return { ok: false, error: 'unknownId' }
    if (!m.action) return { ok: true, label: m.label }
    const r = useGameStore.getState().dispatch(m.action)
    return r.ok ? { ok: true, label: m.label } : { ok: false, error: r.error ?? 'refused', label: m.label }
  },
  setSpeed(speed) {
    useGameStore.getState().dispatch({ type: 'setSpeed', speed })
  },
  /** What a player clicks through without thinking: the move scene, open Defter cards, a panel or bubble left open. */
  housekeep() {
    const did: string[] = []
    const st = useGameStore.getState()
    if (st.ui.overlay?.kind === 'moveScene') {
      st.closeOverlay()
      did.push('moveScene')
    }
    if (st.ui.overlay && ['stats', 'lawbook', 'market'].includes(st.ui.overlay.kind)) st.closeOverlay()
    if (st.ui.panel && st.ui.pauseReasons.length > 0) st.closePanel()
    if (st.ui.decisionExpanded) st.setDecisionExpanded(false)
    if (st.ui.bubbleOpen) st.setBubbleOpen(null)
    const c = useGameStore.getState().state.concepts.active
    if (c && !useGameStore.getState().state.concepts.learned.includes(c.id)) {
      useGameStore.getState().dispatch({ type: 'openConcept', conceptId: c.id })
      did.push(`concept:${c.id}`)
    }
    return did
  },
  overlay({ line, why, meta }) {
    let box = document.getElementById('jev-overlay')
    if (!box) {
      box = document.createElement('div')
      box.id = 'jev-overlay'
      box.setAttribute('aria-live', 'polite')
      Object.assign(box.style, {
        position: 'fixed', left: '50%', top: '16px', transform: 'translateX(-50%)', zIndex: '2147483647', maxWidth: 'min(420px, calc(100vw - 32px))',
        padding: '10px 14px', borderRadius: '14px', background: 'rgba(18, 20, 28, 0.86)', color: '#fff',
        font: '600 14px/1.35 system-ui, -apple-system, sans-serif', boxShadow: '0 6px 24px rgba(0,0,0,0.25)', pointerEvents: 'none',
        backdropFilter: 'blur(6px)',
      } as Partial<CSSStyleDeclaration>)
      box.innerHTML = '<div data-k="meta" style="font-weight:500;font-size:12px;opacity:.7"></div><div data-k="line" style="font-size:15px;margin-top:2px"></div><div data-k="why" style="font-weight:400;font-size:13px;opacity:.85;margin-top:3px"></div>'
      document.body.appendChild(box)
    }
    for (const [k, v] of Object.entries({ meta, line, why })) {
      const el = box.querySelector(`[data-k="${k}"]`)
      if (el) el.textContent = v
    }
  },
}

export function install(): true {
  ;(window as unknown as { __jev: JevBridge }).__jev = bridge
  return true
}
