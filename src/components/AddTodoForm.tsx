import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createTodo, MAX_TITLE_LENGTH } from '../todos/tree'
import { useTodoStore } from '../todos/TodoStoreContext'
import type { ParentId } from '../todos/types'
import { findTodoElement, flashTodo, revealTodo } from './focus'

interface AddTodoFormProps {
  parentId: ParentId
  /** Accessible name of the text field. */
  label: string
  /** Called after adding, and by the Cancel button and Escape. */
  onClose: () => void
}

/** The bar below a row to add one item inside it. It closes once the item is added. */
export function AddTodoForm({ parentId, label, onClose }: AddTodoFormProps) {
  const store = useTodoStore()
  const [title, setTitle] = useState('')
  const inputId = useId()
  const trimmed = title.trim()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmed) return
    const todo = createTodo(trimmed)
    store.dispatch({ type: 'add', parentId, todo })
    onClose()
    // Show where it landed: the end of the row's list.
    requestAnimationFrame(() => {
      const element = findTodoElement(todo.id)
      if (!element) return
      revealTodo(todo.id)
      flashTodo(element)
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="text-input"
        type="text"
        value={title}
        placeholder="Title"
        maxLength={MAX_TITLE_LENGTH}
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="enter"
        autoFocus
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" className="button button-primary" disabled={!trimmed}>
        Add
      </button>
      <button type="button" className="button" onClick={onClose}>
        Cancel
      </button>
    </form>
  )
}
