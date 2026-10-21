import { describe, expect, it } from 'vitest'
import { BACKUP_KEY, loadTodos, parseTodos, saveTodos, serializeTodos, STORAGE_KEY } from './storage'
import { addTodo, createTodo, setTodoCompleted } from './tree'
import type { Todo } from './types'

function sample(): Todo[] {
  let todos = addTodo([], null, createTodo('Trip', 'trip', 1))
  todos = addTodo(todos, 'trip', createTodo('Flights', 'flights', 2))
  todos = addTodo(todos, 'trip', createTodo('Hotel', 'hotel', 3))
  return setTodoCompleted(todos, 'flights', true)
}

describe('storage', () => {
  it('round-trips todos', () => {
    const todos = sample()
    expect(saveTodos(localStorage, todos)).toBe(true)
    expect(loadTodos(localStorage)).toEqual(todos)
  })

  it('starts empty when nothing is stored or storage is unavailable', () => {
    expect(loadTodos(localStorage)).toEqual([])
    expect(loadTodos(null)).toEqual([])
    expect(saveTodos(null, sample())).toBe(false)
  })

  it('backs up unreadable data instead of losing it', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadTodos(localStorage)).toEqual([])
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{not json')

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, todos: [] }))
    expect(loadTodos(localStorage)).toEqual([])
  })

  it('repairs missing fields, duplicate ids and stale completion', () => {
    const raw = JSON.stringify({
      version: 1,
      todos: [
        {
          id: 'p',
          title: '  Parent ',
          completed: false,
          children: [
            { id: 'c', title: 'Child', completed: true },
            { id: 'c', title: '', completed: true, children: 'oops' },
            42,
          ],
        },
      ],
    })
    const todos = parseTodos(raw)!
    expect(todos).toHaveLength(1)
    const [parent] = todos
    expect(parent.title).toBe('Parent')
    expect(parent.children).toHaveLength(2)
    expect(parent.children[1].id).not.toBe('c')
    expect(parent.children[1].title).toBe('Untitled')
    expect(parent.children[1].children).toEqual([])
    expect(parent.completed).toBe(true)
    expect(parent.collapsed).toBe(false)
  })

  it('reports failure when the browser refuses to save', () => {
    const full = {
      ...localStorage,
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    } as unknown as Storage
    expect(saveTodos(full, sample())).toBe(false)
  })

  it('serializes with a version number', () => {
    expect(JSON.parse(serializeTodos([]))).toEqual({ version: 1, todos: [] })
  })
})
