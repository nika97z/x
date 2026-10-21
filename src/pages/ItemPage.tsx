import { useEffect, useState } from 'react'
import { findTodoElement, flashTodo, focusTodo, revealTodo } from '../components/focus'
import { BackIcon, MoreIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { NoticeBar } from '../components/NoticeBar'
import { TitleEditor } from '../components/TitleEditor'
import { TodoTree } from '../components/TodoTree'
import { goBack, navigate, takeJustAdded } from '../navigation'
import type { Notice } from '../todos/store'
import { useTodoStore } from '../todos/TodoStoreContext'
import type { Todo } from '../todos/types'
import { ProgressBar } from './HomePage'

/** One main item: its ranked list inside, and the round + button to add more. */
export function ItemPage({ todo, notice }: { todo: Todo; notice: Notice | null }) {
  const store = useTodoStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const total = todo.children.length
  const done = todo.children.filter((child) => child.completed).length

  // Back from adding something: show where it landed. (Taken inside the frame, so React's
  // development double-run of effects cannot use it up in the run it then cancels.)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const id = takeJustAdded()
      const element = id ? findTodoElement(id) : null
      if (!id || !element) return
      revealTodo(id)
      flashTodo(element)
      focusTodo(element)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleDelete() {
    store.remove(todo.id)
    goBack()
  }

  return (
    <>
      <header className="page-header">
        <button type="button" className="icon-button page-button" aria-label="Back" onClick={() => goBack()}>
          <BackIcon />
        </button>
        {isEditing ? (
          <TitleEditor
            className="page-title-input"
            initialTitle={todo.title}
            onSave={(title) => store.dispatch({ type: 'rename', id: todo.id, title })}
            onClose={() => {
              setIsEditing(false)
              setShowActions(false)
            }}
          />
        ) : (
          <h1 className="page-title" onClick={() => setIsEditing(true)}>
            {todo.title}
          </h1>
        )}
        <button
          type="button"
          className="icon-button page-button"
          aria-expanded={showActions}
          aria-label={`Actions for "${todo.title}"`}
          onClick={() => setShowActions((shown) => !shown)}
        >
          <MoreIcon />
        </button>
      </header>

      {showActions && (
        <div className="page-actions">
          <button
            type="button"
            className="icon-button action"
            aria-label={`Edit "${todo.title}"`}
            onClick={() => setIsEditing(true)}
          >
            <PencilIcon />
            <span className="action-label">Edit</span>
          </button>
          <button
            type="button"
            className="icon-button action danger"
            aria-label={`Delete "${todo.title}"`}
            onClick={handleDelete}
          >
            <TrashIcon />
            <span className="action-label">Delete</span>
          </button>
        </div>
      )}

      {total > 0 && (
        <div className={todo.completed ? 'page-progress is-completed' : 'page-progress'}>
          <span className="square-count">
            {done}/{total}
            <span className="sr-only"> done</span>
          </span>
          <ProgressBar done={done} total={total} />
        </div>
      )}

      <div className="todo-area">
        {total > 0 && <TodoTree todos={todo.children} parentId={todo.id} label={`Inside "${todo.title}"`} />}
      </div>

      {/* Sticks to the bottom of the screen: messages, and the + button in the corner, within thumb reach. */}
      <div className="bottom-dock">
        <NoticeBar notice={notice} />
        <button
          type="button"
          className="fab"
          aria-label={`Add inside "${todo.title}"`}
          title="Add"
          onClick={() => navigate({ page: 'new', parentId: todo.id })}
        >
          <PlusIcon />
        </button>
      </div>
    </>
  )
}
