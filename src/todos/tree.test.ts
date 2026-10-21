import { describe, expect, it } from 'vitest'
import {
  addTodo,
  countDescendants,
  createTodo,
  deleteTodo,
  findTodo,
  moveTodo,
  normalizeTodos,
  renameTodo,
  restoreTodo,
  setTodoCollapsed,
  setTodoCompleted,
} from './tree'
import type { ParentId, Todo } from './types'

let nextId = 0
function add(todos: Todo[], parentId: ParentId, title: string, id = `t${++nextId}`) {
  return addTodo(todos, parentId, createTodo(title, id, 0))
}

function get(todos: Todo[], id: string): Todo {
  const location = findTodo(todos, id)
  if (!location) throw new Error(`no todo ${id}`)
  return location.todo
}

const titles = (todos: Todo[]) => todos.map((todo) => todo.title)

/** main > (a, b > (b1, b2)) */
function sampleTree() {
  let todos: Todo[] = []
  todos = add(todos, null, 'Main', 'main')
  todos = add(todos, 'main', 'A', 'a')
  todos = add(todos, 'main', 'B', 'b')
  todos = add(todos, 'b', 'B1', 'b1')
  todos = add(todos, 'b', 'B2', 'b2')
  return todos
}

describe('addTodo', () => {
  it('appends main todos and sub todos at the end, so they get the next rank', () => {
    let todos = add([], null, 'First', 'first')
    todos = add(todos, null, 'Second', 'second')
    todos = add(todos, 'first', 'Sub 1', 's1')
    todos = add(todos, 'first', 'Sub 2', 's2')
    expect(titles(todos)).toEqual(['First', 'Second'])
    expect(titles(get(todos, 'first').children)).toEqual(['Sub 1', 'Sub 2'])
  })

  it('supports any nesting depth', () => {
    let todos = add([], null, 'Level 0', 'l0')
    for (let level = 1; level <= 12; level++) todos = add(todos, `l${level - 1}`, `Level ${level}`, `l${level}`)
    const deepest = findTodo(todos, 'l12')
    expect(deepest?.parentId).toBe('l11')
    expect(deepest?.todo.title).toBe('Level 12')
  })

  it('trims titles and ignores empty titles, unknown parents and duplicate ids', () => {
    const todos = add([], null, '  Hello  ', 'h')
    expect(get(todos, 'h').title).toBe('Hello')
    expect(add(todos, null, '   ')).toBe(todos)
    expect(add(todos, 'missing', 'Orphan')).toBe(todos)
    expect(add(todos, null, 'Again', 'h')).toBe(todos)
  })

  it('expands a collapsed parent so the new sub todo is visible', () => {
    let todos = sampleTree()
    todos = setTodoCollapsed(todos, 'b', true)
    expect(get(todos, 'b').collapsed).toBe(true)
    todos = add(todos, 'b', 'B3')
    expect(get(todos, 'b').collapsed).toBe(false)
  })

  it('un-completes a completed todo (and its ancestors) when a sub todo is added', () => {
    let todos = sampleTree()
    for (const id of ['a', 'b1', 'b2']) todos = setTodoCompleted(todos, id, true)
    expect(get(todos, 'main').completed).toBe(true)

    todos = add(todos, 'a', 'A1')
    expect(get(todos, 'a').completed).toBe(false)
    expect(get(todos, 'main').completed).toBe(false)
  })
})

describe('completion', () => {
  it('completes a parent only when all of its sub todos are completed', () => {
    let todos = sampleTree()
    todos = setTodoCompleted(todos, 'a', true)
    expect(get(todos, 'main').completed).toBe(false)
    todos = setTodoCompleted(todos, 'b1', true)
    expect(get(todos, 'b').completed).toBe(false)
    todos = setTodoCompleted(todos, 'b2', true)
    expect(get(todos, 'b').completed).toBe(true)
    expect(get(todos, 'main').completed).toBe(true)
  })

  it('un-completes all ancestors when a sub todo is unchecked', () => {
    let todos = sampleTree()
    for (const id of ['a', 'b1', 'b2']) todos = setTodoCompleted(todos, id, true)
    todos = setTodoCompleted(todos, 'b2', false)
    expect(get(todos, 'b').completed).toBe(false)
    expect(get(todos, 'main').completed).toBe(false)
    expect(get(todos, 'a').completed).toBe(true)
  })

  it('cannot complete a todo that has sub todos directly', () => {
    const todos = sampleTree()
    expect(setTodoCompleted(todos, 'b', true)).toBe(todos)
    expect(setTodoCompleted(todos, 'main', true)).toBe(todos)
  })

  it('returns the same tree for no-op changes', () => {
    const todos = sampleTree()
    expect(setTodoCompleted(todos, 'a', false)).toBe(todos)
    expect(setTodoCompleted(todos, 'missing', true)).toBe(todos)
  })

  it('completes the parent when its last unfinished sub todo is deleted', () => {
    let todos = sampleTree()
    todos = setTodoCompleted(todos, 'b1', true)
    expect(get(todos, 'b').completed).toBe(false)
    todos = deleteTodo(todos, 'b2')
    expect(get(todos, 'b').completed).toBe(true)
  })

  it('keeps the shown state when a todo loses its last sub todo', () => {
    let todos = sampleTree()
    todos = setTodoCompleted(todos, 'a', true)
    todos = add(todos, 'a', 'A1', 'a1')
    expect(get(todos, 'a').completed).toBe(false)
    todos = deleteTodo(todos, 'a1')
    expect(get(todos, 'a').children).toEqual([])
    expect(get(todos, 'a').completed).toBe(false)
    // It is a normal todo again and can be checked by hand.
    todos = setTodoCompleted(todos, 'a', true)
    expect(get(todos, 'a').completed).toBe(true)
  })
})

describe('normalizeTodos', () => {
  it('repairs stale completion states at every level', () => {
    const leaf = (id: string, completed: boolean): Todo => ({ ...createTodo(id, id, 0), completed })
    const stale: Todo[] = [
      { ...leaf('p', false), children: [{ ...leaf('c', false), children: [leaf('g1', true), leaf('g2', true)] }] },
    ]
    const fixed = normalizeTodos(stale)
    expect(get(fixed, 'c').completed).toBe(true)
    expect(get(fixed, 'p').completed).toBe(true)
  })

  it('keeps unchanged todos identical', () => {
    const todos = sampleTree()
    expect(normalizeTodos(todos)).toBe(todos)
    const changed = setTodoCompleted(todos, 'a', true)
    expect(changed[0].children[1]).toBe(todos[0].children[1])
  })
})

describe('moveTodo', () => {
  function ranked(count: number) {
    let todos: Todo[] = []
    for (let i = 1; i <= count; i++) todos = add(todos, null, `T${i}`, `m${i}`)
    return todos
  }

  it('moves a todo down to the rank of the target', () => {
    const todos = moveTodo(ranked(4), 'm1', 'm3')
    expect(titles(todos)).toEqual(['T2', 'T3', 'T1', 'T4'])
  })

  it('moves a todo up to the rank of the target', () => {
    const todos = moveTodo(ranked(4), 'm4', 'm1')
    expect(titles(todos)).toEqual(['T4', 'T1', 'T2', 'T3'])
  })

  it('reorders sub todos and keeps their own sub todos attached', () => {
    let todos = sampleTree()
    todos = moveTodo(todos, 'b', 'a')
    expect(titles(get(todos, 'main').children)).toEqual(['B', 'A'])
    expect(titles(get(todos, 'b').children)).toEqual(['B1', 'B2'])
    todos = moveTodo(todos, 'b2', 'b1')
    expect(titles(get(todos, 'b').children)).toEqual(['B2', 'B1'])
  })

  it('never moves a todo into another list', () => {
    const todos = sampleTree()
    expect(moveTodo(todos, 'b1', 'a')).toBe(todos)
    expect(moveTodo(todos, 'a', 'main')).toBe(todos)
    expect(moveTodo(todos, 'b', 'b1')).toBe(todos)
    expect(moveTodo(todos, 'a', 'a')).toBe(todos)
    expect(moveTodo(todos, 'missing', 'a')).toBe(todos)
  })
})

describe('other operations', () => {
  it('renames with a trimmed title and ignores empty titles', () => {
    let todos = sampleTree()
    todos = renameTodo(todos, 'b1', '  Book flights ')
    expect(get(todos, 'b1').title).toBe('Book flights')
    expect(renameTodo(todos, 'b1', '   ')).toBe(todos)
    expect(renameTodo(todos, 'b1', 'Book flights')).toBe(todos)
  })

  it('deletes a todo with all of its sub todos', () => {
    let todos = sampleTree()
    todos = deleteTodo(todos, 'b')
    expect(findTodo(todos, 'b1')).toBeUndefined()
    expect(titles(get(todos, 'main').children)).toEqual(['A'])
    todos = deleteTodo(todos, 'main')
    expect(todos).toEqual([])
  })

  it('restores a deleted todo at its old rank, with its sub todos and completion', () => {
    const todos = setTodoCompleted(sampleTree(), 'b1', true)
    const deleted = findTodo(todos, 'b')!
    let next = deleteTodo(todos, 'b')
    next = restoreTodo(next, deleted.parentId, deleted.index, deleted.todo)
    expect(next).toEqual(todos)
    // Restoring twice does nothing.
    expect(restoreTodo(next, deleted.parentId, deleted.index, deleted.todo)).toBe(next)
  })

  it('restores as a main todo when the old parent is gone too', () => {
    let todos = sampleTree()
    const b1 = findTodo(todos, 'b1')!
    todos = deleteTodo(todos, 'b1')
    todos = deleteTodo(todos, 'b')
    todos = restoreTodo(todos, b1.parentId, b1.index, b1.todo)
    expect(titles(todos)).toEqual(['Main', 'B1'])
  })

  it('un-completes the parent when an unfinished todo is restored into it', () => {
    let todos = sampleTree()
    todos = setTodoCompleted(todos, 'b1', true)
    const b2 = findTodo(todos, 'b2')!
    todos = deleteTodo(todos, 'b2')
    expect(get(todos, 'b').completed).toBe(true)
    todos = restoreTodo(todos, b2.parentId, b2.index, b2.todo)
    expect(get(todos, 'b').completed).toBe(false)
  })

  it('counts sub todos at all levels', () => {
    const todos = sampleTree()
    expect(countDescendants(get(todos, 'main'))).toBe(4)
    expect(countDescendants(get(todos, 'a'))).toBe(0)
  })

  it('only collapses todos that have sub todos', () => {
    const todos = sampleTree()
    expect(setTodoCollapsed(todos, 'a', true)).toBe(todos)
    expect(get(setTodoCollapsed(todos, 'b', true), 'b').collapsed).toBe(true)
  })
})
