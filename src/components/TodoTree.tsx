import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { useTodoStore } from '../todos/TodoStoreContext'
import type { ParentId, Todo } from '../todos/types'
import {
  closestSibling,
  createAnnouncements,
  indexRanks,
  restrictToVerticalAxis,
  screenReaderInstructions,
  siblingKeyboardCoordinates,
} from './dnd'
import { AddingInsideContext, type AddingInside } from './AddingInsideContext'
import { TodoList } from './TodoList'

const modifiers = [restrictToVerticalAxis]

interface TodoTreeProps {
  todos: Todo[]
  /** The item that owns the list (`null` for the main items). */
  parentId: ParentId
  label: string
}

export function TodoTree({ todos, parentId, label }: TodoTreeProps) {
  const store = useTodoStore()
  const sensors = useSensors(
    // A small distance keeps a plain click on the handle from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: siblingKeyboardCoordinates }),
  )
  const [addingInsideId, setAddingInsideId] = useState<string | null>(null)
  const addingInside = useMemo<AddingInside>(
    () => ({ id: addingInsideId, open: setAddingInsideId, close: () => setAddingInsideId(null) }),
    [addingInsideId],
  )
  const accessibility = useMemo(
    () => ({ announcements: createAnnouncements(indexRanks(todos)), screenReaderInstructions }),
    [todos],
  )

  function handleDragStart() {
    // A short buzz on phones that support it (Android), so a drag is felt as well as seen.
    navigator.vibrate?.(10)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    // `moveTodo` ignores the move if the two todos are not siblings.
    store.dispatch({ type: 'move', activeId: String(active.id), overId: String(over.id) })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestSibling}
      modifiers={modifiers}
      accessibility={accessibility}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <AddingInsideContext value={addingInside}>
        <TodoList todos={todos} parentId={parentId} depth={0} label={label} />
      </AddingInsideContext>
    </DndContext>
  )
}
