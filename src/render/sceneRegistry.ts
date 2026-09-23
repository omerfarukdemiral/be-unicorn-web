// Render-local mutable registry: where each character currently is (for bubbles that follow
// heads) and short-lived visual moods (celebration). Never written to GameState.
import { useMemo } from 'react'
import type { GameState } from '../engine/types'
import { computeLayout, type OfficeLayout } from './layout'
import { useGS } from './source'

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

const selectOffice = (s: GameState) => [s.office.slots, s.office.rings, s.office.stage] as const

/** Memoised scene layout for the current office. */
export function useLayout(): OfficeLayout {
  const [slots, rings, stage] = useGS(selectOffice)
  return useMemo(() => computeLayout(slots, rings, stage), [slots, rings, stage])
}
