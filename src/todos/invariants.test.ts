import { describe, expect, it } from 'vitest'
import { todosReducer, type TodoAction } from './reducer'
import { parseTodos, serializeTodos } from './storage'
import { createTodo, findTodo } from './tree'
import type { ParentId, Todo } from './types'

/** Small seeded PRNG (mulberry32), so failures can be reproduced. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function flatten(todos: Todo[], parentId: ParentId = null, out: { todo: Todo; parentId: ParentId }[] = []) {
  for (const todo of todos) {
    out.push({ todo, parentId })
    flatten(todo.children, todo.id, out)
  }
  return out
}

/** Every list's ids, sorted, keyed by the owning parent. */
function membership(todos: Todo[]) {
  const lists = new Map<ParentId, string[]>([[null, todos.map((todo) => todo.id).sort()]])
  for (const { todo } of flatten(todos)) lists.set(todo.id, todo.children.map((child) => child.id).sort())
  return lists
}

function checkInvariants(todos: Todo[]) {
  const all = flatten(todos)
  const ids = all.map(({ todo }) => todo.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const { todo } of all) {
    expect(todo.title.trim()).toBe(todo.title)
    expect(todo.title).not.toBe('')
    if (todo.children.length > 0) {
      expect(todo.completed, `"${todo.title}" must follow its sub todos`).toBe(
        todo.children.every((child) => child.completed),
      )
    }
  }
}

function randomAction(todos: Todo[], next: () => number, step: number): TodoAction {
  const all = flatten(todos)
  const pick = () => all[Math.floor(next() * all.length)]
  const roll = next()
  if (all.length === 0 || roll < 0.3) {
    const parent = all.length > 0 && next() < 0.8 ? pick().todo.id : null
    return { type: 'add', parentId: parent, todo: createTodo(`Todo ${step}`, `id-${step}`, step) }
  }
  const { todo, parentId } = pick()
  if (roll < 0.55) return { type: 'setCompleted', id: todo.id, completed: next() < 0.7 }
  if (roll < 0.75) {
    const siblings = parentId === null ? todos : flatten(todos).find((entry) => entry.todo.id === parentId)!.todo.children
    // Mostly siblings, sometimes a todo from another list (which must be ignored).
    const over = next() < 0.85 ? siblings[Math.floor(next() * siblings.length)] : pick().todo
    return { type: 'move', activeId: todo.id, overId: over.id }
  }
  if (roll < 0.85) return { type: 'setCollapsed', id: todo.id, collapsed: next() < 0.5 }
  if (roll < 0.92) return { type: 'rename', id: todo.id, title: next() < 0.2 ? '   ' : ` Renamed ${step} ` }
  return { type: 'delete', id: todo.id }
}

describe('random sequences of changes', () => {
  for (const seed of [1, 2, 3, 42, 1234]) {
    it(`keep every invariant (seed ${seed})`, () => {
      const next = random(seed)
      let todos: Todo[] = []
      let deleted: TodoAction | null = null
      for (let step = 0; step < 600; step++) {
        // Now and then, undo the last delete (possibly after other changes).
        const action: TodoAction = deleted && next() < 0.15 ? deleted : randomAction(todos, next, step)
        if (action.type === 'delete') {
          const found = findTodo(todos, action.id)
          deleted = found ? { type: 'restore', parentId: found.parentId, index: found.index, todo: found.todo } : null
        } else if (action.type === 'restore') {
          deleted = null
        }
        const before = todos
        todos = todosReducer(todos, action)
        checkInvariants(todos)

        if (action.type === 'move') {
          // A move only reorders one list: every list keeps the same members.
          expect(membership(todos)).toEqual(membership(before))
          const location = flatten(before).find((entry) => entry.todo.id === action.activeId)!
          const overLocation = flatten(before).find((entry) => entry.todo.id === action.overId)!
          if (location.parentId !== overLocation.parentId) expect(todos).toBe(before)
        }
        // Applying the same change again changes nothing (and returns the same array).
        if (action.type !== 'add' && action.type !== 'move') expect(todosReducer(todos, action)).toBe(todos)
        // Saved data reads back exactly.
        if (step % 50 === 0) expect(parseTodos(serializeTodos(todos))).toEqual(todos)
      }
    })
  }
})

describe('moving matches "takes the rank of the target"', () => {
  it('for every pair of positions in a list of 5', () => {
    const base = Array.from({ length: 5 }, (_, index) => createTodo(`T${index + 1}`, `t${index + 1}`, 0))
    for (let from = 0; from < 5; from++) {
      for (let to = 0; to < 5; to++) {
        const moved = todosReducer(base, { type: 'move', activeId: base[from].id, overId: base[to].id })
        const expected = base.filter((_, index) => index !== from)
        expected.splice(to, 0, base[from])
        expect(moved.map((todo) => todo.id)).toEqual(expected.map((todo) => todo.id))
        expect(moved.findIndex((todo) => todo.id === base[from].id)).toBe(to)
      }
    }
  })
})

describe('hostile stored data', () => {
  it('does not crash on extremely deep nesting', () => {
    const depth = 100_000
    const raw = `{"version":1,"todos":${'[{"id":"x","title":"t","children":'.repeat(depth)}[]${'}]'.repeat(depth)}}`
    expect(() => parseTodos(raw)).not.toThrow()
  })

  it('ignores prototype tricks', () => {
    const raw = '{"version":1,"todos":[{"__proto__":{"polluted":true},"id":"a","title":"A","constructor":1}]}'
    const todos = parseTodos(raw)!
    expect(todos[0]).toEqual({ id: 'a', title: 'A', completed: false, collapsed: false, createdAt: 0, children: [] })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('re-numbers duplicate ids across levels', () => {
    const raw = JSON.stringify({
      version: 1,
      todos: [{ id: 'same', title: 'A', children: [{ id: 'same', title: 'B', children: [{ id: 'same', title: 'C' }] }] }],
    })
    const ids = flatten(parseTodos(raw)!).map(({ todo }) => todo.id)
    expect(new Set(ids).size).toBe(3)
  })
})
