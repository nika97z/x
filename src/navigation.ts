import { useMemo, useSyncExternalStore } from 'react'

// Pages live in the URL hash (#/new, #/new/<id>, #/item/<id>), so the phone's back
// button and back gesture work, and a page survives a reload.

export type Route =
  | { page: 'home' }
  /** A page to type the title of a new item; `parentId` null makes a new main item (square). */
  | { page: 'new'; parentId: string | null }
  | { page: 'item'; id: string }

interface HistoryState {
  /** How many in-app pages are below this one in the browser history. */
  depth: number
  /** Where the page was scrolled to when we left it, to come back to the same spot. */
  scrollY?: number
}

const NAVIGATE_EVENT = 'app:navigate'

// We restore scroll positions ourselves: the browser would try before the page has rendered.
if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual'

export function parseRoute(hash: string): Route {
  const item = /^#\/item\/(.+)$/.exec(hash)
  if (item) return { page: 'item', id: decodeURIComponent(item[1]) }
  const newItem = /^#\/new(?:\/(.+))?$/.exec(hash)
  if (newItem) return { page: 'new', parentId: newItem[1] ? decodeURIComponent(newItem[1]) : null }
  return { page: 'home' }
}

function routeUrl(route: Route): string {
  if (route.page === 'home') return location.pathname + location.search
  if (route.page === 'new') return route.parentId ? `#/new/${encodeURIComponent(route.parentId)}` : '#/new'
  return `#/item/${encodeURIComponent(route.id)}`
}

function currentState(): HistoryState | null {
  const state = history.state as Partial<HistoryState> | null
  return typeof state?.depth === 'number' ? (state as HistoryState) : null
}

export function navigate(route: Route, options: { replace?: boolean } = {}) {
  const depth = currentState()?.depth ?? 0
  if (!options.replace) history.replaceState({ ...currentState(), depth, scrollY: window.scrollY }, '')
  const state: HistoryState = { depth: options.replace ? depth : depth + 1 }
  if (options.replace) history.replaceState(state, '', routeUrl(route))
  else history.pushState(state, '', routeUrl(route))
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

/** Back to the previous page; to `fallback` when the app was opened directly on this one. */
export function goBack(fallback: Route = { page: 'home' }) {
  if ((currentState()?.depth ?? 0) > 0) history.back()
  else navigate(fallback, { replace: true })
}

/** The scroll position to show the current page at (0 for a page that was not visited before). */
export function savedScrollY() {
  return currentState()?.scrollY ?? 0
}

// The item that was just added on a "new" page, so the list can show where it landed.
let justAdded: string | null = null

export function rememberJustAdded(id: string) {
  justAdded = id
}

export function takeJustAdded(): string | null {
  const id = justAdded
  justAdded = null
  return id
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener('hashchange', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return useMemo(() => parseRoute(hash), [hash])
}
