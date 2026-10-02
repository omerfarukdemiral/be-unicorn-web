// Resolves a bubble speaker id (employee / visitor / 'founder' / NpcRole) to a display name. NPCs speak with the run's
// fixed cast (state.cast, GAMEPLAY V2 §9.1); an older save without one falls back to the role's default name.
import type { GameState, NpcRole } from '../../engine/types'
import { NPC_ROLES } from '../../engine/types'
import { NPC_TEXT } from '../../content'
import { t } from '../i18n'

/** The run's name for an NPC role (same seed → same name). */
export function castName(s: Pick<GameState, 'cast'>, role: NpcRole): string {
  return s.cast?.[role] ?? NPC_TEXT[role].name
}

export function speakerName(s: GameState, speakerId: string): string {
  if (speakerId === 'founder') return t('founder.you')
  const emp = s.employees.find((e) => e.id === speakerId)
  if (emp) return emp.name
  const vis = s.visitors.find((v) => v.id === speakerId)
  if (vis) return castName(s, vis.role)
  if ((NPC_ROLES as readonly string[]).includes(speakerId)) return castName(s, speakerId as NpcRole)
  return ''
}

/** "Nevin · Mentor": the cast name and the role's title. */
export function npcLabel(role: NpcRole, cast?: GameState['cast']): string {
  return `${castName({ cast }, role)} · ${NPC_TEXT[role].title}`
}
