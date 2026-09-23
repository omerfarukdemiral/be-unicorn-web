// Tiny procedural sound engine (Web Audio). No asset files: every cue is a few soft
// oscillator/noise voices through a gentle low-pass and a short echo, at a low master level.
// Safe to import anywhere: without AudioContext (tests, SSR) every call is a no-op.

export type CueId =
  | 'tap' | 'panelOpen' | 'panelClose' | 'pause' | 'resume' | 'speed'
  | 'start' | 'actionStart' | 'actionDone' | 'projectStarted' | 'projectLaunched'
  | 'hired' | 'left' | 'itemPlaced' | 'itemSold' | 'itemMoved' | 'ringOpened'
  | 'milestone' | 'roundStarted' | 'roundClosed' | 'stageUp'
  | 'conceptQueued' | 'conceptLearned' | 'decisionShown' | 'decisionAnswered'
  | 'visitor' | 'warning' | 'error' | 'gameOver' | 'victory'

/** Overall loudness. Kept low on purpose: feedback, not music. */
const MASTER = 0.32

let ctx: AudioContext | null = null
let master: GainNode | null = null
let bus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let enabled = true

function audioCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = audioCtor()
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  master = ctx.createGain()
  master.gain.value = enabled ? MASTER : 0
  // Soften everything: roll off the top end so nothing is piercing.
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 5200
  lp.Q.value = 0.3
  // Short, quiet echo for a bit of room.
  const delay = ctx.createDelay(0.5)
  delay.delayTime.value = 0.13
  const fb = ctx.createGain()
  fb.gain.value = 0.22
  const wet = ctx.createGain()
  wet.gain.value = 0.16
  bus = ctx.createGain()
  bus.connect(lp)
  bus.connect(delay)
  delay.connect(fb)
  fb.connect(delay)
  delay.connect(wet)
  wet.connect(lp)
  lp.connect(master)
  master.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.5)
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

/** Call from a user gesture: browsers only allow audio after one. */
export function unlockAudio(): void {
  const c = ensure()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

export function setAudioEnabled(on: boolean): void {
  enabled = on
  if (master && ctx) master.gain.setTargetAtTime(on ? MASTER : 0, ctx.currentTime, 0.05)
}

interface ToneOpts {
  type?: OscillatorType
  gain?: number
  attack?: number
  /** Glide to this frequency over the note. */
  to?: number
  detune?: number
}

function tone(freq: number, at: number, dur: number, o: ToneOpts = {}): void {
  if (!ctx || !bus) return
  const t0 = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur)
  if (o.detune) osc.detune.value = o.detune
  const peak = o.gain ?? 0.1
  const a = o.attack ?? 0.006
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dur)
  osc.connect(g)
  g.connect(bus)
  osc.start(t0)
  osc.stop(t0 + a + dur + 0.05)
}

function noise(at: number, dur: number, freq: number, gain: number, sweepTo?: number, q = 1.2): void {
  if (!ctx || !bus || !noiseBuf) return
  const t0 = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(freq, t0)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur)
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f)
  f.connect(g)
  g.connect(bus)
  src.start(t0, Math.random() * 0.3)
  src.stop(t0 + dur + 0.02)
}

/** Notes (Hz): a C-major pentatonic palette keeps every cue consonant with the others. */
const N = { G3: 196, C4: 261.6, D4: 293.7, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568 }

function arp(notes: number[], step: number, dur: number, o: ToneOpts = {}, at = 0): void {
  notes.forEach((f, i) => tone(f, at + i * step, dur, o))
}

const CUES: Record<CueId, () => void> = {
  tap: () => {
    tone(N.E6, 0, 0.035, { type: 'triangle', gain: 0.035, detune: (Math.random() - 0.5) * 30 })
    noise(0, 0.02, 3200, 0.02)
  },
  panelOpen: () => tone(N.E5, 0, 0.09, { gain: 0.05, to: N.A5 }),
  panelClose: () => tone(N.A5, 0, 0.08, { gain: 0.04, to: N.E5 }),
  pause: () => tone(N.C5, 0, 0.12, { gain: 0.05, to: N.G4 }),
  resume: () => tone(N.G4, 0, 0.12, { gain: 0.05, to: N.C5 }),
  speed: () => tone(N.G5, 0, 0.05, { type: 'triangle', gain: 0.04 }),
  start: () => arp([N.C5, N.G5, N.C6], 0.08, 0.35, { gain: 0.07 }),
  actionStart: () => {
    tone(N.D5, 0, 0.12, { type: 'triangle', gain: 0.06 })
    tone(N.A5, 0.05, 0.14, { gain: 0.04 })
  },
  actionDone: () => arp([N.G5, N.D6], 0.08, 0.28, { gain: 0.06 }),
  projectStarted: () => arp([N.C5, N.E5, N.G5], 0.06, 0.2, { type: 'triangle', gain: 0.06 }),
  projectLaunched: () => {
    arp([N.C5, N.E5, N.G5, N.C6], 0.08, 0.3, { type: 'triangle', gain: 0.07 })
    ;[N.C5, N.E5, N.G5].forEach((f) => tone(f, 0.34, 0.7, { gain: 0.035, attack: 0.03 }))
  },
  hired: () => arp([N.C5, N.E5, N.G5], 0.07, 0.3, { type: 'triangle', gain: 0.07 }),
  left: () => arp([N.D5, N.A4], 0.12, 0.35, { gain: 0.05 }),
  itemPlaced: () => {
    noise(0, 0.06, 420, 0.12, 260, 2)
    tone(N.G3, 0, 0.1, { gain: 0.1 })
    tone(N.D6, 0.035, 0.14, { gain: 0.03 })
  },
  itemSold: () => arp([N.D6, N.G5], 0.06, 0.12, { type: 'triangle', gain: 0.05 }),
  itemMoved: () => noise(0, 0.14, 900, 0.05, 2200),
  ringOpened: () => arp([N.G5, N.A5, N.D6, N.G6], 0.055, 0.45, { gain: 0.045 }),
  milestone: () => {
    tone(N.C6, 0, 0.8, { gain: 0.06 })
    tone(N.G6, 0.02, 0.6, { gain: 0.03 })
  },
  roundStarted: () => arp([N.G4, N.C5], 0.1, 0.3, { type: 'triangle', gain: 0.06 }),
  roundClosed: () => {
    arp([N.E6, N.G6, N.E6, N.G6], 0.045, 0.1, { type: 'triangle', gain: 0.035 })
    ;[N.C5, N.E5, N.G5].forEach((f) => tone(f, 0.18, 0.8, { gain: 0.04, attack: 0.02 }))
  },
  stageUp: () => {
    arp([N.G4, N.C5, N.E5, N.G5, N.C6], 0.09, 0.35, { type: 'triangle', gain: 0.07 })
    ;[N.C5, N.E5, N.G5, N.C6].forEach((f) => tone(f, 0.5, 1.4, { gain: 0.035, attack: 0.08 }))
  },
  conceptQueued: () => tone(N.D5, 0, 0.07, { gain: 0.045, to: N.A5 }),
  conceptLearned: () => {
    noise(0, 0.16, 1500, 0.035, 3500)
    arp([N.G5, N.D6], 0.09, 0.4, { gain: 0.05 }, 0.08)
  },
  decisionShown: () => arp([N.E5, N.D5], 0.1, 0.2, { type: 'triangle', gain: 0.05 }),
  decisionAnswered: () => tone(N.G5, 0, 0.12, { type: 'triangle', gain: 0.05 }),
  visitor: () => {
    noise(0, 0.05, 260, 0.08, undefined, 3)
    noise(0.13, 0.05, 240, 0.07, undefined, 3)
  },
  warning: () => arp([N.G4, N.E4], 0.18, 0.45, { gain: 0.06 }),
  error: () => tone(N.A4, 0, 0.12, { type: 'triangle', gain: 0.045, to: N.G4 }),
  gameOver: () => arp([N.G4, N.E4, N.D4, N.C4], 0.28, 0.7, { gain: 0.06, attack: 0.02 }),
  victory: () => {
    CUES.stageUp()
    arp([N.C6, N.E6, N.G6, N.E6, N.G6], 0.07, 0.2, { type: 'triangle', gain: 0.03 }, 0.9)
  },
}

/** Minimum real ms between two plays of the same cue. */
const COOLDOWN: Partial<Record<CueId, number>> = { tap: 35, visitor: 20_000, conceptQueued: 4000, decisionShown: 4000, speed: 80 }
const lastPlayed = new Map<CueId, number>()

export function playCue(id: CueId): void {
  if (!enabled) return
  const c = ensure()
  if (!c || c.state !== 'running') return
  const now = performance.now()
  const cd = COOLDOWN[id] ?? 150
  if (now - (lastPlayed.get(id) ?? -Infinity) < cd) return
  lastPlayed.set(id, now)
  // Dev-only trail for scripted smoke tests (the browser test harness cannot hear).
  if (import.meta.env.DEV) {
    const w = window as unknown as { __cues?: string[] }
    ;(w.__cues ??= []).push(id)
  }
  CUES[id]()
}
