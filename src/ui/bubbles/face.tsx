// Who is asking, as a face (T15): the speaker's portrait (public/portraits, shot from the scene's own character model
// by render/PortraitStudio) on a disc of the bubble's colour, the kind mark as a small badge on its corner.
// Ids mirror render/portraits.ts PORTRAIT_IDS (ui may not import render).
import type { Dept, GameState, NpcRole } from '../../engine/types'
import { NPC_ROLES } from '../../engine/types'
import { Icon, type IconName } from '../icons'
import { cx } from '../primitives'
import { iconTone, soft } from '../theme'

export type FaceId = 'founder' | 'buyer' | NpcRole | `team-${Dept}`

export function faceSrc(id: FaceId, scale: 1 | 2): string {
  return `${import.meta.env.BASE_URL}portraits/${id}@${scale}x.png`
}

/** The face for a bubble speaker id: 'founder' / 'desk', an employee (their dept's face), a visitor or an NPC role. */
export function faceOf(s: Pick<GameState, 'employees' | 'visitors'>, speakerId: string): FaceId | undefined {
  if (speakerId === 'founder' || speakerId === 'desk') return 'founder'
  const emp = s.employees.find((e) => e.id === speakerId)
  if (emp) return `team-${emp.dept}`
  const vis = s.visitors.find((v) => v.id === speakerId)
  if (vis) return vis.role
  if ((NPC_ROLES as readonly string[]).includes(speakerId)) return speakerId as NpcRole
  return undefined
}

export function Face({ id, size, color, badge, className }: { id: FaceId; size: number; color: string; badge?: IconName; className?: string }) {
  const b = Math.round(size * 0.5)
  return (
    <span aria-hidden="true" className={cx('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
      <span className="absolute inset-0 overflow-hidden rounded-full" style={{ background: soft(color, 26) }}>
        <img src={faceSrc(id, 1)} srcSet={`${faceSrc(id, 1)} 1x, ${faceSrc(id, 2)} 2x`} alt="" draggable={false} className="size-full scale-[1.12] object-cover" />
      </span>
      {badge && (
        <span
          className="absolute -bottom-0.5 -right-1 grid place-items-center rounded-full bg-surface"
          style={{ width: b, height: b, color: iconTone(color), boxShadow: `0 0 0 1.5px ${soft(color, 45)}` }}
        >
          <Icon name={badge} size={Math.round(b * 0.66)} />
        </span>
      )}
    </span>
  )
}
