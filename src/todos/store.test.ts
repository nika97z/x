import { describe, expect, it, vi } from 'vitest'
import { loadTodos, saveTodos, STORAGE_KEY } from './storage'
import { createTodoStore } from './store'
import { addTodo, createTodo } from './tree'

describe('createTodoStore', () => {
  it('loads saved todos and saves every change immediately', () => {
    saveTodos(localStorage, addTodo([], null, createTodo('Saved', 'saved', 0)))
    const store = createTodoStore(localStorage)
    expect(store.getState().todos.map((todo) => todo.title)).toEqual(['Saved'])

    store.dispatch({ type: 'add', parentId: 'saved', todo: createTodo('Child', 'child', 0) })
    expect(loadTodos(localStorage)[0].children[0].title).toBe('Child')
    expect(store.getState().saveFailed).toBe(false)
  })

  it('notifies subscribers only when something changed', () => {
    const store = createTodoStore(localStorage)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.dispatch({ type: 'add', parentId: null, todo: createTodo('One', 'one', 0) })
    expect(listener).toHaveBeenCalledTimes(1)
    store.dispatch({ type: 'setCompleted', id: 'missing', completed: true })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.dispatch({ type: 'delete', id: 'one' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('flags changes that could not be saved and keeps working in memory', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    const store = createTodoStore(broken)
    store.dispatch({ type: 'add', parentId: null, todo: createTodo('One', 'one', 0) })
    expect(store.getState().todos).toHaveLength(1)
    expect(store.getState().saveFailed).toBe(true)
  })

  it('offers to undo a delete and puts the todo back where it was', () => {
    const store = createTodoStore(localStorage)
    for (const id of ['a', 'b', 'c']) store.dispatch({ type: 'add', parentId: null, todo: createTodo(id.toUpperCase(), id, 0) })
    store.dispatch({ type: 'add', parentId: 'b', todo: createTodo('B1', 'b1', 0) })

    store.remove('b')
    expect(store.getState().todos.map((todo) => todo.id)).toEqual(['a', 'c'])
    expect(store.getState().notice?.message).toBe('Deleted "B" and 1 inside it')
    expect(loadTodos(localStorage)).toHaveLength(2)

    expect(store.undo()).toBe('b')
    expect(store.getState().todos.map((todo) => todo.id)).toEqual(['a', 'b', 'c'])
    expect(store.getState().todos[1].children[0].id).toBe('b1')
    expect(store.getState().notice).toBeNull()
    expect(loadTodos(localStorage)).toHaveLength(3)
    expect(store.undo()).toBeUndefined()
  })

  it('shows and dismisses messages', () => {
    const store = createTodoStore(localStorage)
    store.notify('Hello')
    const first = store.getState().notice!
    expect(first.message).toBe('Hello')
    expect(first.undo).toBeUndefined()

    store.notify('Again')
    store.dismissNotice(first.id) // an old message no longer hides the new one
    expect(store.getState().notice?.message).toBe('Again')
    store.dismissNotice()
    expect(store.getState().notice).toBeNull()
  })

  it('picks up changes saved by another tab', () => {
    const store = createTodoStore(localStorage)
    const stop = store.syncWithOtherTabs()

    saveTodos(localStorage, addTodo([], null, createTodo('From other tab', 'other', 0)))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, storageArea: localStorage }))
    expect(store.getState().todos.map((todo) => todo.title)).toEqual(['From other tab'])

    // Other keys are ignored.
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else', storageArea: localStorage }))
    expect(store.getState().todos).toHaveLength(1)

    stop()
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, storageArea: localStorage }))
    expect(store.getState().todos).toHaveLength(1)
  })
})
