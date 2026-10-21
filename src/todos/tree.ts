import { createId } from './id'
import type { ParentId, Todo } from './types'

// Pure, immutable operations on the todo tree. Every function returns the
// same array when nothing changed, so React can skip work for those todos.

export const MAX_TITLE_LENGTH = 500

export function createTodo(title: string, id = createId(), createdAt = Date.now()): Todo {
  return { id, title: title.trim(), completed: false, collapsed: false, createdAt, children: [] }
}

/**
 * Makes every todo that has sub todos completed exactly when all of its sub
 * todos are completed, bottom-up through all levels.
 *
 * A todo whose last sub todo was deleted keeps the state it showed before, because
 * its `completed` flag always holds the value derived from its sub todos.
 */
export function normalizeTodos(todos: Todo[]): Todo[] {
  let changed = false
  const next = todos.map((todo) => {
    const normalized = normalizeTodo(todo)
    if (normalized !== todo) changed = true
    return normalized
  })
  return changed ? next : todos
}

function normalizeTodo(todo: Todo): Todo {
  if (todo.children.length === 0) return todo
  const children = normalizeTodos(todo.children)
  const completed = children.every((child) => child.completed)
  if (children === todo.children && completed === todo.completed) return todo
  return { ...todo, children, completed }
}

export interface TodoLocation {
  todo: Todo
  parentId: ParentId
  /** Position among its siblings; the rank is `index + 1`. */
  index: number
  siblings: Todo[]
}

export function findTodo(todos: Todo[], id: string, parentId: ParentId = null): TodoLocation | undefined {
  for (let index = 0; index < todos.length; index++) {
    const todo = todos[index]
    if (todo.id === id) return { todo, parentId, index, siblings: todos }
    const found = findTodo(todo.children, id, todo.id)
    if (found) return found
  }
  return undefined
}

/** Applies `update` to the todo with the given id, wherever it is in the tree. */
function updateTodo(todos: Todo[], id: string, update: (todo: Todo) => Todo): Todo[] {
  let changed = false
  const next = todos.map((todo) => {
    if (changed) return todo
    if (todo.id === id) {
      const updated = update(todo)
      changed = updated !== todo
      return updated
    }
    const children = updateTodo(todo.children, id, update)
    if (children === todo.children) return todo
    changed = true
    return { ...todo, children }
  })
  return changed ? next : todos
}

/** Applies `update` to the list owned by `parentId` (`null` is the list of main todos). */
function updateList(todos: Todo[], parentId: ParentId, update: (list: Todo[]) => Todo[]): Todo[] {
  if (parentId === null) return update(todos)
  return updateTodo(todos, parentId, (parent) => {
    const children = update(parent.children)
    return children === parent.children ? parent : { ...parent, children }
  })
}

/** Adds `todo` as the last item (highest rank) of the list owned by `parentId`. */
export function addTodo(todos: Todo[], parentId: ParentId, todo: Todo): Todo[] {
  if (!todo.title || findTodo(todos, todo.id)) return todos
  if (parentId !== null && !findTodo(todos, parentId)) return todos
  const next =
    parentId === null
      ? [...todos, todo]
      : updateTodo(todos, parentId, (parent) => ({
          ...parent,
          // Show the new sub todo, even if the list was collapsed.
          collapsed: false,
          children: [...parent.children, todo],
        }))
  return normalizeTodos(next)
}

/** Only todos without sub todos can be completed directly; the others follow their sub todos. */
export function setTodoCompleted(todos: Todo[], id: string, completed: boolean): Todo[] {
  const next = updateTodo(todos, id, (todo) =>
    todo.children.length > 0 || todo.completed === completed ? todo : { ...todo, completed },
  )
  return normalizeTodos(next)
}

export function renameTodo(todos: Todo[], id: string, title: string): Todo[] {
  const trimmed = title.trim()
  if (!trimmed) return todos
  return updateTodo(todos, id, (todo) => (todo.title === trimmed ? todo : { ...todo, title: trimmed }))
}

/** Deletes a todo together with all of its sub todos. */
export function deleteTodo(todos: Todo[], id: string): Todo[] {
  const location = findTodo(todos, id)
  if (!location) return todos
  const next = updateList(todos, location.parentId, (list) => list.filter((todo) => todo.id !== id))
  return normalizeTodos(next)
}

/**
 * Puts a deleted todo (with its sub todos) back at its old rank. If its parent
 * was deleted in the meantime, it comes back as the last main todo.
 */
export function restoreTodo(todos: Todo[], parentId: ParentId, index: number, todo: Todo): Todo[] {
  if (collectIds(todo).some((id) => findTodo(todos, id))) return todos
  const insert = (list: Todo[], at: number) => {
    const position = Math.max(0, Math.min(at, list.length))
    return [...list.slice(0, position), todo, ...list.slice(position)]
  }
  if (parentId === null || !findTodo(todos, parentId)) {
    return normalizeTodos(insert(todos, parentId === null ? index : todos.length))
  }
  const next = updateTodo(todos, parentId, (parent) => ({
    ...parent,
    collapsed: false,
    children: insert(parent.children, index),
  }))
  return normalizeTodos(next)
}

function collectIds(todo: Todo, ids: string[] = []): string[] {
  ids.push(todo.id)
  for (const child of todo.children) collectIds(child, ids)
  return ids
}

/**
 * Moves a todo to the rank currently held by `overId`, shifting the todos in
 * between by one. Both todos must share the same parent; otherwise nothing changes.
 */
export function moveTodo(todos: Todo[], activeId: string, overId: string): Todo[] {
  const location = findTodo(todos, activeId)
  if (!location) return todos
  const to = location.siblings.findIndex((todo) => todo.id === overId)
  if (to === -1 || to === location.index) return todos
  return updateList(todos, location.parentId, (list) => arrayMove(list, location.index, to))
}

export function setTodoCollapsed(todos: Todo[], id: string, collapsed: boolean): Todo[] {
  return updateTodo(todos, id, (todo) =>
    todo.collapsed === collapsed || todo.children.length === 0 ? todo : { ...todo, collapsed },
  )
}

/** Number of sub todos at all levels below `todo`. */
export function countDescendants(todo: Todo): number {
  return todo.children.reduce((count, child) => count + 1 + countDescendants(child), 0)
}

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
