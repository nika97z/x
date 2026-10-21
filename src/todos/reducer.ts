import {
  addTodo,
  deleteTodo,
  moveTodo,
  normalizeTodos,
  renameTodo,
  restoreTodo,
  setTodoCollapsed,
  setTodoCompleted,
} from './tree'
import type { ParentId, Todo } from './types'

export type TodoAction =
  | { type: 'add'; parentId: ParentId; todo: Todo }
  | { type: 'setCompleted'; id: string; completed: boolean }
  | { type: 'rename'; id: string; title: string }
  | { type: 'delete'; id: string }
  | { type: 'restore'; parentId: ParentId; index: number; todo: Todo }
  | { type: 'move'; activeId: string; overId: string }
  | { type: 'setCollapsed'; id: string; collapsed: boolean }
  | { type: 'replaceAll'; todos: Todo[] }

/** Pure: ids and timestamps are created by the caller (see `createTodo`). */
export function todosReducer(todos: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'add':
      return addTodo(todos, action.parentId, action.todo)
    case 'setCompleted':
      return setTodoCompleted(todos, action.id, action.completed)
    case 'rename':
      return renameTodo(todos, action.id, action.title)
    case 'delete':
      return deleteTodo(todos, action.id)
    case 'restore':
      return restoreTodo(todos, action.parentId, action.index, action.todo)
    case 'move':
      return moveTodo(todos, action.activeId, action.overId)
    case 'setCollapsed':
      return setTodoCollapsed(todos, action.id, action.collapsed)
    case 'replaceAll':
      return normalizeTodos(action.todos)
  }
}
