import type {
  Active,
  Announcements,
  ClientRect,
  CollisionDetection,
  DataRef,
  DroppableContainer,
  KeyboardCoordinateGetter,
  Modifier,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from '@dnd-kit/core'
import type { ParentId, Todo } from '../todos/types'

// Ranks only change within one list, so a dragged todo is only ever compared
// with its siblings: the todos that share its parent.
//
// Todos have very different heights (an expanded one contains all of its sub
// todos), so instead of comparing centers we ask: "if it were dropped at rank N,
// where would its top edge end up?" and pick the rank whose spot is closest.

/** Stored on every sortable todo (`useSortable({ data })`). */
export interface TodoDragData {
  parentId: ParentId
}

function parentIdOf(data: DataRef): ParentId | undefined {
  return (data.current as Partial<TodoDragData> | undefined)?.parentId
}

interface Slot {
  container: DroppableContainer
  /** Position before the drag started. */
  rect: ClientRect
}

/** The dragged todo and its siblings, top to bottom. */
function siblingSlots(
  active: Active,
  containers: DroppableContainer[],
  rects: Map<UniqueIdentifier, ClientRect>,
): Slot[] {
  const parentId = parentIdOf(active.data)
  const slots: Slot[] = []
  for (const container of containers) {
    const rect = rects.get(container.id)
    if (rect && parentIdOf(container.data) === parentId) slots.push({ container, rect })
  }
  return slots.sort((a, b) => a.rect.top - b.rect.top)
}

/** Where the top edge of the dragged todo lands when it is dropped at `index`. */
function landingTop(slots: Slot[], activeIndex: number, index: number): number {
  if (index <= activeIndex) return slots[index].rect.top
  // Todos in between move up, so its bottom lines up with the target's bottom.
  return slots[index].rect.bottom - slots[activeIndex].rect.height
}

/** Picks the sibling whose rank the dragged todo would take at its current position. */
export const closestSibling: CollisionDetection = ({ active, collisionRect, droppableRects, droppableContainers }) => {
  const slots = siblingSlots(active, droppableContainers, droppableRects)
  const activeIndex = slots.findIndex((slot) => slot.container.id === active.id)
  if (activeIndex === -1) return []
  return slots
    .map((slot, index) => ({
      id: slot.container.id,
      data: {
        droppableContainer: slot.container,
        value: Math.abs(landingTop(slots, activeIndex, index) - collisionRect.top),
      },
    }))
    .sort((a, b) => a.data.value - b.data.value)
}

/** Up and down arrows move the picked-up todo exactly one rank within its list. */
export const siblingKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const step = event.code === 'ArrowDown' ? 1 : event.code === 'ArrowUp' ? -1 : 0
  if (step === 0) return undefined
  event.preventDefault()

  const { active, over, droppableRects, droppableContainers } = context
  if (!active) return undefined
  const slots = siblingSlots(active, droppableContainers.getEnabled(), droppableRects)
  const activeIndex = slots.findIndex((slot) => slot.container.id === active.id)
  if (activeIndex === -1) return undefined
  const overIndex = slots.findIndex((slot) => slot.container.id === over?.id)
  const targetIndex = (overIndex === -1 ? activeIndex : overIndex) + step
  if (targetIndex < 0 || targetIndex >= slots.length) return undefined

  return { x: slots[activeIndex].rect.left, y: landingTop(slots, activeIndex, targetIndex) }
}

/** Ranks are a vertical order, so the dragged todo only moves up and down. */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'To change the rank, press space or enter to pick it up. ' +
    'Use the up and down arrow keys to move it within its list. ' +
    'Press space or enter again to drop it, or escape to cancel.',
}

interface RankInfo {
  title: string
  rank: number
  siblingCount: number
}

/** Title and rank of every todo, for the screen reader announcements. */
export function indexRanks(todos: Todo[], ranks = new Map<UniqueIdentifier, RankInfo>()) {
  todos.forEach((todo, index) => {
    ranks.set(todo.id, { title: todo.title, rank: index + 1, siblingCount: todos.length })
    indexRanks(todo.children, ranks)
  })
  return ranks
}

export function createAnnouncements(ranks: Map<UniqueIdentifier, RankInfo>): Announcements {
  return {
    onDragStart({ active }) {
      const dragged = ranks.get(active.id)
      if (!dragged) return
      return `Picked up "${dragged.title}", rank ${dragged.rank} of ${dragged.siblingCount}.`
    },
    onDragOver({ active, over }) {
      const dragged = ranks.get(active.id)
      const target = over && ranks.get(over.id)
      if (!dragged || !target) return
      return `"${dragged.title}" would move to rank ${target.rank} of ${target.siblingCount}.`
    },
    onDragEnd({ active, over }) {
      const dragged = ranks.get(active.id)
      if (!dragged) return
      const target = over && over.id !== active.id ? ranks.get(over.id) : undefined
      if (!target) return `"${dragged.title}" was dropped. It stays at rank ${dragged.rank}.`
      return `"${dragged.title}" was moved to rank ${target.rank} of ${target.siblingCount}.`
    },
    onDragCancel({ active }) {
      const dragged = ranks.get(active.id)
      if (!dragged) return
      return `Moving was cancelled. "${dragged.title}" stays at rank ${dragged.rank}.`
    },
  }
}
