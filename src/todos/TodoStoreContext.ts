import { createContext, useContext } from 'react'
import type { TodoStore } from './store'

export const TodoStoreContext = createContext<TodoStore | null>(null)

export function useTodoStore(): TodoStore {
  const store = useContext(TodoStoreContext)
  if (!store) throw new Error('useTodoStore must be used inside <TodoStoreContext value={store}>')
  return store
}
