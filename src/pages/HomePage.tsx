import { PlusIcon } from '../components/Icons'
import { NoticeBar } from '../components/NoticeBar'
import { navigate } from '../navigation'
import type { Notice } from '../todos/store'
import type { Todo } from '../todos/types'

/** The main items as squares, two per row, with a + square at the end. */
export function HomePage({ todos, notice }: { todos: Todo[]; notice: Notice | null }) {
  return (
    <>
      <div className="home">
        <ul className="square-grid" role="list">
          {todos.map((todo) => (
            <li key={todo.id}>
              <Square todo={todo} />
            </li>
          ))}
          <li>
            <button
              type="button"
              className="square add-square"
              aria-label="Add"
              title="Add"
              onClick={() => navigate({ page: 'new', parentId: null })}
            >
              <PlusIcon />
            </button>
          </li>
        </ul>
      </div>
      <div className="bottom-dock">
        <NoticeBar notice={notice} />
      </div>
    </>
  )
}

function Square({ todo }: { todo: Todo }) {
  const total = todo.children.length
  const done = todo.children.filter((child) => child.completed).length
  const isComplete = total > 0 && todo.completed

  return (
    <button
      type="button"
      className={isComplete ? 'square is-completed' : 'square'}
      data-todo-id={todo.id}
      onClick={() => navigate({ page: 'item', id: todo.id })}
    >
      <span className="square-title">{todo.title}</span>
      {total > 0 && (
        <span className="square-progress">
          <span className="square-count">
            {done}/{total}
            <span className="sr-only"> done</span>
          </span>
          <ProgressBar done={done} total={total} />
        </span>
      )}
    </button>
  )
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <span className="progress-bar" aria-hidden="true">
      <span style={{ width: `${(done / total) * 100}%` }} />
    </span>
  )
}
