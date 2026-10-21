import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { BackIcon, CheckIcon } from '../components/Icons'
import { goBack, navigate, rememberJustAdded, type Route } from '../navigation'
import { createTodo, MAX_TITLE_LENGTH } from '../todos/tree'
import { useTodoStore } from '../todos/TodoStoreContext'
import type { Todo } from '../todos/types'

interface NewItemPageProps {
  /** Where the new item goes; null for a new main item (square). */
  parent: Todo | null
  /** Where "back" leads when the app was opened directly on this page. */
  backTo: Route
}

/**
 * A page with just the title field. The item only exists once it has a title:
 * Enter saves it (a new square opens its page; anything else goes back to its list),
 * going back keeps a typed title, and an empty one adds nothing.
 */
export function NewItemPage({ parent, backTo }: NewItemPageProps) {
  const store = useTodoStore()
  const [title, setTitle] = useState('')
  const contextId = useId()
  // Read when the page closes (also by the phone's back gesture), so kept outside render state.
  const draftRef = useRef('')
  const createdRef = useRef(false)
  const parentId = parent?.id ?? null

  // Stable (it only reads refs), so the effect below runs its cleanup once, when the page closes.
  const create = useCallback((): string | undefined => {
    const trimmed = draftRef.current.trim()
    if (!trimmed || createdRef.current) return undefined
    createdRef.current = true
    const todo = createTodo(trimmed)
    store.dispatch({ type: 'add', parentId, todo })
    if (parentId !== null) rememberJustAdded(todo.id)
    return todo.id
  }, [store, parentId])

  // Leaving any other way than Enter (back arrow, back gesture) still keeps a typed title.
  useEffect(() => () => void create(), [create])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = create()
    if (!id) return
    if (parentId === null) navigate({ page: 'item', id }, { replace: true })
    else goBack(backTo)
  }

  return (
    <>
      <form className="page-header" onSubmit={handleSubmit}>
        <button
          type="button"
          className="icon-button page-button"
          aria-label="Back"
          onClick={() => {
            create()
            goBack(backTo)
          }}
        >
          <BackIcon />
        </button>
        <input
          className="text-input page-title-input"
          type="text"
          value={title}
          placeholder="Title"
          aria-label="Title"
          aria-describedby={parent ? contextId : undefined}
          maxLength={MAX_TITLE_LENGTH}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          autoFocus
          onChange={(event) => {
            setTitle(event.target.value)
            draftRef.current = event.target.value
          }}
        />
        <button type="submit" className="icon-button page-button" aria-label="Save" disabled={!title.trim()}>
          <CheckIcon />
        </button>
      </form>
      {parent && (
        <p className="new-context" id={contextId}>
          Inside "{parent.title}"
        </p>
      )}
    </>
  )
}
