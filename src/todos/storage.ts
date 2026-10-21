import { createId } from './id'
import { MAX_TITLE_LENGTH, normalizeTodos } from './tree'
import type { Todo } from './types'

export const STORAGE_KEY = 'nested-todos'
/** Where unreadable data is copied before it can be overwritten, so it is never lost silently. */
export const BACKUP_KEY = `${STORAGE_KEY}:unreadable-backup`
const STORAGE_VERSION = 1

interface StoredTodos {
  version: typeof STORAGE_VERSION
  todos: Todo[]
}

/** `localStorage` can be missing or throw (e.g. when the browser blocks site data). */
export function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function serializeTodos(todos: Todo[]): string {
  const data: StoredTodos = { version: STORAGE_VERSION, todos }
  return JSON.stringify(data)
}

/**
 * Reads stored todos, repairing what it can (missing fields, duplicate ids,
 * stale completion states). Returns `null` if the data is not readable at all.
 */
export function parseTodos(raw: string): Todo[] | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data) || data.version !== STORAGE_VERSION || !Array.isArray(data.todos)) return null
    return normalizeTodos(sanitizeList(data.todos, new Set()))
  } catch {
    // Not JSON, or nested so deeply that reading it overflows the stack.
    return null
  }
}

function sanitizeList(values: unknown[], seenIds: Set<string>): Todo[] {
  const todos: Todo[] = []
  for (const value of values) {
    if (!isRecord(value)) continue
    let id = typeof value.id === 'string' && value.id !== '' ? value.id : createId()
    if (seenIds.has(id)) id = createId()
    seenIds.add(id)
    const title = typeof value.title === 'string' ? value.title.trim().slice(0, MAX_TITLE_LENGTH) : ''
    todos.push({
      id,
      title: title || 'Untitled',
      completed: value.completed === true,
      collapsed: value.collapsed === true,
      createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : 0,
      children: Array.isArray(value.children) ? sanitizeList(value.children, seenIds) : [],
    })
  }
  return todos
}

export function loadTodos(storage: Storage | null): Todo[] {
  if (!storage) return []
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return []
  }
  if (raw === null) return []
  const todos = parseTodos(raw)
  if (todos) return todos
  try {
    storage.setItem(BACKUP_KEY, raw)
  } catch {
    // Nothing else we can do; start with an empty list.
  }
  return []
}

/** Returns `false` when the browser refused to save (storage full, disabled, ...). */
export function saveTodos(storage: Storage | null, todos: Todo[]): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, serializeTodos(todos))
    return true
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
