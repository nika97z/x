import { useEffect, useState } from 'react'
import type { Notice } from '../todos/store'
import { useTodoStore } from '../todos/TodoStoreContext'
import { findTodoElement, focusTodo, revealTodo } from './focus'
import { CloseIcon } from './Icons'

const UNDO_TIME = 7000
const MESSAGE_TIME = 4000

/** Messages such as "Deleted …  Undo". The live region stays mounted so screen readers announce them. */
export function NoticeBar({ notice }: { notice: Notice | null }) {
  return (
    <div className="notice-region" role="status" aria-live="polite">
      {notice && <NoticeToast key={notice.id} notice={notice} />}
    </div>
  )
}

function NoticeToast({ notice }: { notice: Notice }) {
  const store = useTodoStore()
  // Waits while the person is reading or about to press a button.
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(() => store.dismissNotice(notice.id), notice.undo ? UNDO_TIME : MESSAGE_TIME)
    return () => window.clearTimeout(timer)
  }, [notice, paused, store])

  function handleUndo() {
    const id = store.undo()
    if (!id) return
    requestAnimationFrame(() => {
      const element = findTodoElement(id)
      // A main item comes back as a square (a button); anything else as a row in a list.
      if (element instanceof HTMLButtonElement) return element.focus()
      revealTodo(id)
      focusTodo(element)
    })
  }

  return (
    <div
      className="notice"
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <span className="notice-message">{notice.message}</span>
      {notice.undo && (
        <button type="button" className="notice-action" onClick={handleUndo}>
          Undo
        </button>
      )}
      <button
        type="button"
        className="icon-button notice-close"
        aria-label="Dismiss message"
        onClick={() => store.dismissNotice(notice.id)}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
