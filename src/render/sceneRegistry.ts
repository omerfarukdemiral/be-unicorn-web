// Render-local mutable registry: where each character currently is (for bubbles that follow
// heads) and short-lived visual moods (celebration). Never written to GameState.
import { useMemo } from 'react'
import type { GameState, OfficeState } from '../engine/types'
import { computeLayout, type OfficeLayout } from './layout'
import { getGS, useGS, useMockState } from './source'

export interface SpeakerPos {
  x: number
  y: number
  z: number
  /** False while the character is outside (walked out of the door). */
  visible: boolean
}

/** Keyed by employee id, visitor id or 'founder'. */
export const speakerPositions = new Map<string, SpeakerPos>()

export function setSpeakerPos(id: string, x: number, y: number, z: number, visible: boolean): void {
  const p = speakerPositions.get(id)
  if (p) {
    p.x = x
    p.y = y
    p.z = z
    p.visible = visible
  } else speakerPositions.set(id, { x, y, z, visible })
}

export function clearSpeaker(id: string): void {
  speakerPositions.delete(id)
}

/** performance.now() timestamp until which characters cheer. */
export const mood = { celebrateUntil: 0, renovateUntil: 0 }

export function celebrate(ms = 2600): void {
  mood.celebrateUntil = Math.max(mood.celebrateUntil, performance.now() + ms)
}

export function isCelebrating(now = performance.now()): boolean {
  return now < mood.celebrateUntil
}

/**
 * Structural signature of the office. The engine clones the whole state every step, so
 * `office.slots` is a new array each tick even when nothing changed; render keys on this
 * string instead so the scene only re-renders when the office really changes.
 */
export function officeSignature(s: GameState): string {
  const o = s.office
  let k = `${o.stage}|`
  for (const r of o.rings) k += r.unlocked ? '1' : '0'
  for (const x of o.slots) k += `|${x.id},${x.ring},${x.type},${x.pos.x},${x.pos.z},${x.rotation},${x.itemId ?? ''},${x.spanOf ?? ''},${x.occupantId ?? ''}`
  return k
}

/** Office snapshot with a stable reference while its signature is unchanged. */
export function useOffice(): OfficeState {
  const sig = useGS(officeSignature)
  const mock = useMockState()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getGS(mock).office, [sig, mock])
}

/** Memoised scene layout for the current office (stable across engine ticks). */
export function useLayout(): OfficeLayout {
  const office = useOffice()
  return useMemo(() => computeLayout(office.slots, office.rings, office.stage), [office])
}
