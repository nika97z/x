import type { Todo } from '../todos/types'

/** Explains why a checkbox that completes by itself cannot be checked by hand. */
export function automaticCompletionMessage(todo: Todo) {
  const left = todo.children.filter((child) => !child.completed).length
  return todo.completed
    ? `"${todo.title}" is done because everything inside it is done.`
    : `"${todo.title}" will be done when everything inside it is done (${left} left).`
}
