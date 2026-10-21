import type { Active, ClientRect, DroppableContainer, Over, UniqueIdentifier } from '@dnd-kit/core'
import { describe, expect, it } from 'vitest'
import { addTodo, createTodo } from '../todos/tree'
import type { ParentId } from '../todos/types'
import { closestSibling, createAnnouncements, indexRanks, siblingKeyboardCoordinates } from './dnd'

function rect(top: number, height = 40): ClientRect {
  return { top, left: 10, width: 200, height, bottom: top + height, right: 210 }
}

function container(id: string, parentId: ParentId, box: ClientRect): DroppableContainer {
  return {
    id,
    key: id,
    data: { current: { parentId } },
    disabled: false,
    node: { current: null },
    rect: { current: box },
  }
}

// Main list: "a" is tall because its two sub todos are expanded inside it.
//   a   0..120   (a1 40..80, a2 80..120)
//   b   120..160
//   c   160..200
const containers = [
  container('a', null, rect(0, 120)),
  container('a1', 'a', rect(40)),
  container('a2', 'a', rect(80)),
  container('b', null, rect(120)),
  container('c', null, rect(160)),
]
const droppableRects = new Map<UniqueIdentifier, ClientRect>(containers.map((c) => [c.id, c.rect.current!]))
const activeTodo = (id: string, parentId: ParentId) => ({ id, data: { current: { parentId } } }) as unknown as Active

function collide(active: Active, top: number, height: number) {
  return closestSibling({
    active,
    collisionRect: rect(top, height),
    droppableRects,
    droppableContainers: containers,
    pointerCoordinates: null,
  }).map((collision) => collision.id)
}

describe('closestSibling', () => {
  it('only considers todos from the same list', () => {
    const ids = collide(activeTodo('c', null), 50, 40)
    expect(ids).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    expect(ids).not.toContain('a1')
    expect(ids).not.toContain('a2')
  })

  it('picks the rank whose spot is closest, even for a tall todo', () => {
    const a = activeTodo('a', null)
    expect(collide(a, 0, 120)[0]).toBe('a') // not moved
    expect(collide(a, 40, 120)[0]).toBe('b') // lands at 40..160 when it takes rank 2
    expect(collide(a, 80, 120)[0]).toBe('c') // lands at 80..200 when it takes rank 3
  })

  it('moves a short todo above a tall one once it reaches the top', () => {
    const c = activeTodo('c', null)
    expect(collide(c, 160, 40)[0]).toBe('c')
    expect(collide(c, 120, 40)[0]).toBe('b')
    expect(collide(c, 10, 40)[0]).toBe('a')
  })
})

describe('siblingKeyboardCoordinates', () => {
  function press(code: string, activeId: string, overId: string | null) {
    const parentId = containers.find((c) => c.id === activeId)!.data.current!.parentId as ParentId
    const event = new KeyboardEvent('keydown', { code, cancelable: true })
    const coordinates = siblingKeyboardCoordinates(event, {
      active: activeId,
      currentCoordinates: { x: 0, y: 0 },
      context: {
        active: activeTodo(activeId, parentId),
        over: overId ? ({ id: overId } as Over) : null,
        droppableRects,
        droppableContainers: { getEnabled: () => containers },
      } as never,
    })
    return { coordinates, defaultPrevented: event.defaultPrevented }
  }

  it('steps one rank at a time, skipping sub todos', () => {
    expect(press('ArrowDown', 'a', null).coordinates).toEqual({ x: 10, y: 40 })
    expect(press('ArrowDown', 'a', 'b').coordinates).toEqual({ x: 10, y: 80 })
    expect(press('ArrowUp', 'a', 'c').coordinates).toEqual({ x: 10, y: 40 })
    expect(press('ArrowUp', 'c', null).coordinates).toEqual({ x: 10, y: 120 })
    expect(press('ArrowUp', 'c', 'b').coordinates).toEqual({ x: 10, y: 0 })
  })

  it('stops at both ends of the list', () => {
    expect(press('ArrowUp', 'a', null).coordinates).toBeUndefined()
    expect(press('ArrowDown', 'c', null).coordinates).toBeUndefined()
    expect(press('ArrowDown', 'a2', null).coordinates).toBeUndefined()
  })

  it('ignores other keys', () => {
    expect(press('ArrowLeft', 'b', null)).toEqual({ coordinates: undefined, defaultPrevented: false })
    expect(press('ArrowDown', 'b', null).defaultPrevented).toBe(true)
  })
})

describe('announcements', () => {
  it('describe moves with titles and ranks instead of ids', () => {
    let todos = addTodo([], null, createTodo('Flights', 'f', 0))
    todos = addTodo(todos, null, createTodo('Hotel', 'h', 0))
    todos = addTodo(todos, null, createTodo('Bags', 'b', 0))
    const announcements = createAnnouncements(indexRanks(todos))
    const active = { id: 'b' } as Active
    const over = (id: string) => ({ id }) as Over

    expect(announcements.onDragStart({ active })).toBe('Picked up "Bags", rank 3 of 3.')
    expect(announcements.onDragOver({ active, over: over('f') })).toBe('"Bags" would move to rank 1 of 3.')
    expect(announcements.onDragEnd({ active, over: over('f') })).toBe('"Bags" was moved to rank 1 of 3.')
    expect(announcements.onDragEnd({ active, over: over('b') })).toBe('"Bags" was dropped. It stays at rank 3.')
    expect(announcements.onDragCancel({ active, over: null })).toBe('Moving was cancelled. "Bags" stays at rank 3.')
  })
})
