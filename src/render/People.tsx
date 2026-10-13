// All characters in the scene: employees, the founder and visiting NPCs, plus departing ghosts
// (people already gone from GameState walking out / shrinking away instead of popping out).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { idleBuilders } from '../engine/loopSelectors'
import { FOUNDER_SLOT_ID, type Dept, type GameState, type NpcRole } from '../engine/types'
import { DepartingFigure, EmployeeCharacter, FounderCharacter, employeeLook } from './Character'
import type { CharacterLook } from './CharacterModel'
import { diffDeparting, mergeGhosts, pruneGhosts, type Ghost, type Seen } from './departing'
import { NPC_HEAD_Y, Npc, npcLook, rankVisitors } from './Npc'
import { clearSpeaker, lastPos, registerDesk, sceneTime, useLayout, useOffice, useSceneClock, type LastPos } from './sceneRegistry'
import { getGS, storeApi, useGS, useMockState, useUi } from './source'
import { panelSelection } from '../store/gameStore'
import { personKey } from './bubbles'
import { staffNeeds } from './WorldBubbles'

const selectPeople = (s: GameState) => [s.employees, s.visitors, s.founder.currentAction, s.time.speed, s.derived.overload > 0] as const

/** What a ghost needs to be drawn: who they looked like (dept / role). */
type Who = { dept: Dept } | { role: NpcRole }
interface GhostData {
  look: CharacterLook
  from: LastPos
  headY: number
}

/** The founder's tap opens their own actions as a desk bubble (spec §2 row 10). */
const DESK_ACTIONS = 'desk:actions'

// Characters are memoised on the fields they draw, so this list re-rendering per tick stays cheap.
export function People() {
  const [employees, visitors, action, chosenSpeed, overload] = useGS(selectPeople)
  // Builders with nothing to build carry a "…" over the head (playtest LD1).
  const idle = useGS(idleBuilders)
  // The project leads (E3): a gold star over the head. A primitive key, so the set rebuilds only when a lead changes.
  const leadKey = useGS((s) => s.projects.flatMap((p) => (p.leadId ? [p.leadId] : [])).join(','))
  const leads = useMemo(() => new Set(leadKey ? leadKey.split(',') : []), [leadKey])
  // A focus pause (decision / Defter card / open bubble / modal) holds the world still without touching time.speed.
  const held = useUi((u) => u.pauseReasons.length > 0)
  const generation = useUi((u) => u.generation)
  const slots = useOffice().slots
  const mock = useMockState()
  const speed = held && !mock ? 0 : chosenSpeed
  // The scene's one clock: poses, juice and confetti stand still while held.
  useSceneClock(held && !mock)
  const getDay = useCallback(() => getGS(mock).time.day, [mock])
  const layout = useLayout()
  const selection = useUi((u) => panelSelection(u.panel))
  const founderOpen = useUi((u) => u.bubbleOpen === DESK_ACTIONS)

  // An employee's tap opens their card beside them (T14), or the bubble they already ask with (leaving / idle);
  // a second tap closes it. The panel's detail stays one tap further (the card's Detay).
  const selectEmployee = useCallback((id: string) => {
    const st = storeApi()
    const asks = staffNeeds(st.state).some(([x]) => x === id)
    const key = asks ? `staff:${id}` : personKey(id)
    st.setBubbleOpen(st.ui.bubbleOpen === key ? null : key)
  }, [])
  const openEmployee = useUi((u) => (u.bubbleOpen?.startsWith('person:') || u.bubbleOpen?.startsWith('staff:') ? u.bubbleOpen.slice(u.bubbleOpen.indexOf(':') + 1) : null))
  const selectVisitor = useCallback((id: string) => storeApi().select({ kind: 'visitor', id }), [])
  // Founder decisions come from the desk: the tap toggles the actions bubble (its Detay opens the founder panel).
  const tapFounder = useCallback(() => {
    const st = storeApi()
    st.setBubbleOpen(st.ui.bubbleOpen === DESK_ACTIONS ? null : DESK_ACTIONS)
  }, [])

  const founderSlot = useMemo(() => slots.find((s) => s.id === FOUNDER_SLOT_ID), [slots])
  const occupiedDesks = useMemo(() => slots.filter((s) => s.occupantId && s.id !== FOUNDER_SLOT_ID), [slots])
  // Visitors waiting at the same target fan out instead of stacking on one point.
  const fan = useMemo(() => rankVisitors(visitors), [visitors])

  // The desk is a fixed speaker: company decisions float over it, not over the walking founder.
  useEffect(() => {
    const c = layout.itemCenter.get(FOUNDER_SLOT_ID)?.pos ?? layout.slotWorld.get(FOUNDER_SLOT_ID)
    if (!c) return
    registerDesk(c[0], c[1])
    return () => clearSpeaker('desk')
  }, [layout])

  // Departing ghosts. A layout effect so the ghost mounts in the same paint the live character leaves.
  const [ghosts, setGhosts] = useState<Ghost<GhostData>[]>([])
  const seen = useRef<{ generation: number; list: Seen<Who>[] } | null>(null)
  useLayoutEffect(() => {
    const list: Seen<Who>[] = [
      ...employees.map((e) => ({ id: e.id, kind: 'employee' as const, leaving: e.status === 'leaving', data: { dept: e.dept } })),
      ...visitors.map((v) => ({ id: v.id, kind: 'visitor' as const, leaving: false, data: { role: v.role } })),
    ]
    const prev = seen.current
    seen.current = { generation, list }
    // New game / loaded save: the old team does not parade out.
    if (!prev || prev.generation !== generation) {
      lastPos.clear()
      setGhosts((g) => (g.length ? [] : g))
      return
    }
    const ids = new Set(list.map((x) => x.id))
    const now = sceneTime.t * 1000
    const added: Ghost<GhostData>[] = []
    for (const g of diffDeparting(prev.list, ids, now)) {
      const from = lastPos.get(g.id)
      lastPos.delete(g.id)
      // Never drawn, or already outside the door: nothing to show leaving.
      if (!from || from.outside) continue
      const who = g.data
      const look = 'dept' in who ? employeeLook(g.id, who.dept) : npcLook(g.id, who.role)
      added.push({ ...g, data: { look, from: { ...from }, headY: 'dept' in who ? 1.05 : NPC_HEAD_Y } })
    }
    setGhosts((cur) => {
      const next = mergeGhosts(pruneGhosts(cur, new Set<string>(), now), added, ids)
      return next.length === cur.length && added.length === 0 && next.every((x, i) => x === cur[i]) ? cur : next
    })
  }, [employees, visitors, generation])

  const ghostDone = useCallback((id: string) => {
    setGhosts((cur) => pruneGhosts(cur, new Set([id]), sceneTime.t * 1000))
  }, [])

  return (
    <group>
      <FounderCharacter
        action={action}
        founderSlot={founderSlot}
        deskSlots={occupiedDesks}
        layout={layout}
        speed={speed}
        selected={founderOpen || selection?.kind === 'founder'}
        onSelect={tapFounder}
      />
      {employees.map((e) => (
        <EmployeeCharacter
          key={e.id}
          employee={e}
          deskSlot={e.deskSlotId ? slots.find((s) => s.id === e.deskSlotId) : undefined}
          layout={layout}
          speed={speed}
          overload={overload}
          idle={idle.includes(e.id)}
          lead={leads.has(e.id)}
          selected={(selection?.kind === 'employee' && selection.id === e.id) || openEmployee === e.id}
          onSelect={selectEmployee}
        />
      ))}
      {visitors.map((v) => (
        <Npc
          key={v.id}
          visitor={v}
          slots={slots}
          layout={layout}
          getDay={getDay}
          speed={speed}
          selected={selection?.kind === 'visitor' && selection.id === v.id}
          onSelect={selectVisitor}
          fanIndex={fan.get(v.id)?.index ?? 0}
          fanCount={fan.get(v.id)?.count ?? 1}
        />
      ))}
      {ghosts.map((g) => (
        <DepartingFigure
          key={`ghost:${g.id}:${g.since}`}
          id={g.id}
          look={g.data.look}
          from={g.data.from}
          mode={g.mode}
          layout={layout}
          speed={speed}
          headY={g.data.headY}
          onDone={ghostDone}
        />
      ))}
    </group>
  )
}
