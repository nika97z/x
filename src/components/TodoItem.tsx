import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, useId, useRef, useState } from 'react'
import { useTodoStore } from '../todos/TodoStoreContext'
import type { ParentId, Todo } from '../todos/types'
import { AddTodoForm } from './AddTodoForm'
import { useAddingInside } from './AddingInsideContext'
import type { TodoDragData } from './dnd'
import { focusTodo, isVisible } from './focus'
import { ChevronIcon, GripIcon, MoreIcon, PencilIcon, PlusIcon, TrashIcon } from './Icons'
import { automaticCompletionMessage } from './messages'
import { TitleEditor } from './TitleEditor'
import { TodoList } from './TodoList'

interface TodoItemProps {
  todo: Todo
  parentId: ParentId
  rank: number
  siblingCount: number
  depth: number
}

// Memoized: items that did not change keep their object, so they skip re-rendering.
export const TodoItem = memo(function TodoItem({ todo, parentId, rank, siblingCount, depth }: TodoItemProps) {
  const store = useTodoStore()
  const [isEditing, setIsEditing] = useState(false)
  // The bar below the row to add items inside it (the round + button is for the page's own list).
  const addingInside = useAddingInside()
  const isAddingInside = addingInside.id === todo.id
  // On phones the actions are hidden until the row (or its "more" button) is tapped.
  const [showActions, setShowActions] = useState(false)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const statusId = useId()
  const childrenId = useId()
  const actionsId = useId()

  const dragData: TodoDragData = { parentId }
  const { attributes, listeners, node, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id, data: dragData, disabled: siblingCount < 2 })

  const childCount = todo.children.length
  const hasChildren = childCount > 0
  const doneCount = todo.children.filter((child) => child.completed).length
  const showChildren = hasChildren && !todo.collapsed

  /** Focuses an action button, or the "more" button when the actions are hidden again. */
  function focusAction(button: HTMLButtonElement | null) {
    requestAnimationFrame(() => {
      const target = button && isVisible(button) ? button : moreButtonRef.current
      target?.focus()
    })
  }

  function stopEditing(returnFocus: boolean) {
    setIsEditing(false)
    setShowActions(false)
    if (returnFocus) focusAction(editButtonRef.current)
  }

  function closeAddForm() {
    addingInside.close()
    setShowActions(false)
    focusAction(addButtonRef.current)
  }

  function handleDelete() {
    const nextFocus = node.current?.nextElementSibling ?? node.current?.previousElementSibling
    const parentItem = node.current?.parentElement?.closest('li') ?? null
    store.remove(todo.id)
    requestAnimationFrame(() => focusTodo(nextFocus ?? parentItem))
  }

  const className = [
    'todo',
    todo.completed && 'is-completed',
    hasChildren && 'has-sub-todos',
    isDragging && 'is-dragging',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      ref={setNodeRef}
      className={className}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-todo-id={todo.id}
    >
      <div className="todo-row">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="drag-handle"
          disabled={siblingCount < 2}
          title={siblingCount < 2 ? `Rank ${rank}` : 'Drag to change the rank'}
          {...attributes}
          {...listeners}
          aria-label={`Change rank of "${todo.title}" (rank ${rank} of ${siblingCount})`}
        >
          <GripIcon />
          <span className="rank" aria-hidden="true">
            {rank}
          </span>
        </button>

        {hasChildren ? (
          <button
            type="button"
            className="icon-button collapse-toggle"
            aria-expanded={!todo.collapsed}
            aria-controls={showChildren ? childrenId : undefined}
            aria-label={`Inside "${todo.title}"`}
            title={todo.collapsed ? 'Show' : 'Hide'}
            onClick={() => store.dispatch({ type: 'setCollapsed', id: todo.id, collapsed: !todo.collapsed })}
          >
            <ChevronIcon />
          </button>
        ) : (
          <span className="collapse-spacer" aria-hidden="true" />
        )}

        {/* The label makes the whole cell a comfortable tap target. */}
        <label className="checkbox-hit" title={hasChildren ? 'Done when everything inside is done' : undefined}>
          <input
            type="checkbox"
            className="todo-checkbox"
            checked={todo.completed}
            aria-disabled={hasChildren || undefined}
            aria-label={todo.title}
            aria-describedby={hasChildren ? statusId : undefined}
            // With items inside, the store ignores the change and React resets the box; say why instead.
            onClick={hasChildren ? () => store.notify(automaticCompletionMessage(todo)) : undefined}
            onChange={(event) =>
              store.dispatch({ type: 'setCompleted', id: todo.id, completed: event.target.checked })
            }
          />
        </label>

        <span className="todo-main">
          {isEditing ? (
            <TitleEditor
              initialTitle={todo.title}
              onSave={(title) => store.dispatch({ type: 'rename', id: todo.id, title })}
              onClose={stopEditing}
            />
          ) : (
            <span
              className="todo-title"
              onClick={() => setShowActions((shown) => !shown)}
              onDoubleClick={() => setIsEditing(true)}
            >
              {todo.title}
            </span>
          )}

          {hasChildren && (
            <span className="progress" id={statusId}>
              {doneCount}/{childCount}
              <span className="sr-only"> done. Done when everything inside is done.</span>
            </span>
          )}
        </span>

        <button
          ref={moreButtonRef}
          type="button"
          className="icon-button more-button"
          aria-expanded={showActions}
          aria-controls={actionsId}
          aria-label={`Actions for "${todo.title}"`}
          title="Actions"
          onClick={() => setShowActions((shown) => !shown)}
        >
          <MoreIcon />
        </button>

        <span id={actionsId} className={showActions ? 'todo-actions is-open' : 'todo-actions'}>
          <button
            ref={addButtonRef}
            type="button"
            className="icon-button action"
            aria-expanded={isAddingInside}
            aria-label={`Add inside "${todo.title}"`}
            title="Add inside"
            onClick={() => (isAddingInside ? closeAddForm() : addingInside.open(todo.id))}
          >
            <PlusIcon />
            <span className="action-label">Add inside</span>
          </button>
          <button
            ref={editButtonRef}
            type="button"
            className="icon-button action"
            aria-label={`Edit "${todo.title}"`}
            title="Edit"
            onClick={() => setIsEditing(true)}
          >
            <PencilIcon />
            <span className="action-label">Edit</span>
          </button>
          <button
            type="button"
            className="icon-button action danger"
            aria-label={`Delete "${todo.title}"`}
            title="Delete"
            onClick={handleDelete}
          >
            <TrashIcon />
            <span className="action-label">Delete</span>
          </button>
        </span>
      </div>

      {showChildren && (
        <TodoList
          id={childrenId}
          todos={todo.children}
          parentId={todo.id}
          depth={depth + 1}
          label={`Inside "${todo.title}"`}
        />
      )}

      {isAddingInside && (
        <AddTodoForm parentId={todo.id} label={`New title inside "${todo.title}"`} onClose={closeAddForm} />
      )}

    </li>
  )
})
