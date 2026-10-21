import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'
import './App.css'
import { navigate, savedScrollY, useRoute, type Route } from './navigation'
import { HomePage } from './pages/HomePage'
import { ItemPage } from './pages/ItemPage'
import { NewItemPage } from './pages/NewItemPage'
import type { TodoStore } from './todos/store'
import { TodoStoreContext } from './todos/TodoStoreContext'
import { findTodo } from './todos/tree'
import type { Todo } from './todos/types'

/** The page that shows the list `parentId` owns: the page of its main item (or the main page). */
function listPageOf(todos: Todo[], parentId: string | null): Route {
  let id = parentId
  while (id !== null) {
    const location = findTodo(todos, id)
    if (!location) break
    if (location.parentId === null) return { page: 'item', id }
    id = location.parentId
  }
  return { page: 'home' }
}

export default function App({ store }: { store: TodoStore }) {
  const { todos, saveFailed, notice } = useSyncExternalStore(store.subscribe, store.getState)
  const route = useRoute()
  useEffect(() => store.syncWithOtherTabs(), [store])

  const item = route.page === 'item' ? todos.find((todo) => todo.id === route.id) : undefined
  const parent =
    route.page === 'new' && route.parentId !== null ? findTodo(todos, route.parentId)?.todo : undefined
  const missing =
    (route.page === 'item' && !item) || (route.page === 'new' && route.parentId !== null && !parent)

  // The page of an item that is gone (deleted, maybe in another tab) falls back to the main page.
  useEffect(() => {
    if (missing) navigate({ page: 'home' }, { replace: true })
  }, [missing])

  // A page opens at the top, or where it was left when coming back to it.
  useLayoutEffect(() => {
    window.scrollTo(0, savedScrollY())
  }, [route])

  let page
  if (route.page === 'new' && !missing) {
    page = (
      <NewItemPage
        key={route.parentId ?? 'main'}
        parent={parent ?? null}
        backTo={listPageOf(todos, route.parentId)}
      />
    )
  } else if (item) {
    page = <ItemPage key={item.id} todo={item} notice={notice} />
  } else {
    page = <HomePage todos={todos} notice={notice} />
  }

  return (
    <TodoStoreContext value={store}>
      <main className="app">
        {saveFailed && (
          <p className="save-warning" role="alert">
            Your latest changes could not be saved in this browser. Storage may be full or disabled.
          </p>
        )}
        {page}
      </main>
    </TodoStoreContext>
  )
}
