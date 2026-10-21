import { todosReducer, type TodoAction } from './reducer'
import { loadTodos, saveTodos, STORAGE_KEY } from './storage'
import { countDescendants, findTodo } from './tree'
import type { ParentId, Todo } from './types'

export interface DeletedTodo {
  todo: Todo
  parentId: ParentId
  index: number
}

/** A short message in the bar above the "add todo" field, optionally with Undo. */
export interface Notice {
  id: number
  message: string
  undo?: DeletedTodo
}

export interface TodoState {
  todos: Todo[]
  /** True when the latest change could not be saved in the browser. */
  saveFailed: boolean
  notice: Notice | null
}

export interface TodoStore {
  getState(): TodoState
  subscribe(listener: () => void): () => void
  /** Applies a change and saves it right away. */
  dispatch(action: TodoAction): void
  /** Deletes a todo with its sub todos and offers to undo it. */
  remove(id: string): void
  /** Brings back the todo from the current Undo notice. Returns its id. */
  undo(): string | undefined
  notify(message: string): void
  /** Hides the notice (only the given one, if an id is passed). */
  dismissNotice(id?: number): void
  /** Picks up changes that another tab saved. Returns a function that stops listening. */
  syncWithOtherTabs(): () => void
}

/**
 * Holds the todos outside React (read them with `useSyncExternalStore`) so every
 * change is saved synchronously, in the same event that made it.
 */
export function createTodoStore(storage: Storage | null): TodoStore {
  let state: TodoState = { todos: loadTodos(storage), saveFailed: false, notice: null }
  let lastNoticeId = 0
  const listeners = new Set<() => void>()

  function setState(next: TodoState) {
    state = next
    for (const listener of listeners) listener()
  }

  /** Saves `todos` if they changed and publishes the new state. */
  function commit(todos: Todo[], notice: Notice | null) {
    if (todos === state.todos) {
      if (notice !== state.notice) setState({ ...state, notice })
      return
    }
    setState({ todos, saveFailed: !saveTodos(storage, todos), notice })
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    dispatch(action) {
      commit(todosReducer(state.todos, action), state.notice)
    },

    remove(id) {
      const location = findTodo(state.todos, id)
      if (!location) return
      const { todo, parentId, index } = location
      const count = countDescendants(todo)
      const message = count === 0 ? `Deleted "${todo.title}"` : `Deleted "${todo.title}" and ${count} inside it`
      commit(todosReducer(state.todos, { type: 'delete', id }), {
        id: ++lastNoticeId,
        message,
        undo: { todo, parentId, index },
      })
    },

    undo() {
      const deleted = state.notice?.undo
      if (!deleted) return undefined
      commit(todosReducer(state.todos, { type: 'restore', ...deleted }), null)
      return deleted.todo.id
    },

    notify(message) {
      setState({ ...state, notice: { id: ++lastNoticeId, message } })
    },

    dismissNotice(id) {
      if (state.notice && (id === undefined || state.notice.id === id)) setState({ ...state, notice: null })
    },

    syncWithOtherTabs() {
      if (!storage || typeof window === 'undefined') return () => {}
      const onStorage = (event: StorageEvent) => {
        // `key` is null when the other tab cleared all storage.
        if (event.storageArea !== storage || (event.key !== null && event.key !== STORAGE_KEY)) return
        setState({ ...state, todos: loadTodos(storage) })
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },
  }
}
