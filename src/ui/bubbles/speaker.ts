// Resolves a bubble speaker id (employee / visitor / 'founder' / NpcRole) to a display name.
import type { GameState, NpcRole } from '../../engine/types'
import { NPC_ROLES } from '../../engine/types'
import { NPC_TEXT } from '../../content'
import { t } from '../i18n'

export function speakerName(s: GameState, speakerId: string): string {
  if (speakerId === 'founder') return t('founder.you')
  const emp = s.employees.find((e) => e.id === speakerId)
  if (emp) return emp.name
  const vis = s.visitors.find((v) => v.id === speakerId)
  if (vis) return NPC_TEXT[vis.role].name
  if ((NPC_ROLES as readonly string[]).includes(speakerId)) return NPC_TEXT[speakerId as NpcRole].name
  return ''
}

export function npcLabel(role: NpcRole): string {
  const n = NPC_TEXT[role]
  return `${n.name} · ${n.title}`
}
