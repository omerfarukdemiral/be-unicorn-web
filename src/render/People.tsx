// All characters in the scene: employees, the founder and visiting NPCs.
import { useCallback } from 'react'
import { FOUNDER_SLOT_ID, type GameState } from '../engine/types'
import { EmployeeCharacter, FounderCharacter } from './Character'
import { Npc } from './Npc'
import { useLayout } from './sceneRegistry'
import { getGS, storeApi, useGS, useMockState, useUi } from './source'

const selectPeople = (s: GameState) =>
  [s.employees, s.visitors, s.office.slots, s.founder.currentAction, s.time.speed, s.derived.overload > 0] as const

export function People() {
  const [employees, visitors, slots, action, speed, overload] = useGS(selectPeople)
  const mock = useMockState()
  const getDay = useCallback(() => getGS(mock).time.day, [mock])
  const layout = useLayout()
  const selection = useUi((u) => u.selection)

  const selectEmployee = useCallback((id: string) => storeApi().select({ kind: 'employee', id }), [])
  const selectVisitor = useCallback((id: string) => storeApi().select({ kind: 'visitor', id }), [])
  const selectFounder = useCallback(() => storeApi().select({ kind: 'founder' }), [])

  const founderSlot = slots.find((s) => s.id === FOUNDER_SLOT_ID)
  const occupiedDesks = slots.filter((s) => s.occupantId && s.id !== FOUNDER_SLOT_ID)

  return (
    <group>
      <FounderCharacter
        action={action}
        founderSlot={founderSlot}
        deskSlots={occupiedDesks}
        layout={layout}
        speed={speed}
        selected={selection?.kind === 'founder'}
        onSelect={selectFounder}
      />
      {employees.map((e) => (
        <EmployeeCharacter
          key={e.id}
          employee={e}
          deskSlot={e.deskSlotId ? slots.find((s) => s.id === e.deskSlotId) : undefined}
          layout={layout}
          speed={speed}
          overload={overload}
          selected={selection?.kind === 'employee' && selection.id === e.id}
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
        />
      ))}
    </group>
  )
}
