import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useMemo } from 'react'
import type { ParentId, Todo } from '../todos/types'
import { TodoItem } from './TodoItem'

const MAIN_LIST_ID = 'main-todos'

interface TodoListProps {
  todos: Todo[]
  parentId: ParentId
  depth: number
  label: string
  id?: string
}

/** One ranked list of siblings. Each list is its own sortable area. */
export function TodoList({ todos, parentId, depth, label, id }: TodoListProps) {
  const ids = useMemo(() => todos.map((todo) => todo.id), [todos])

  return (
    <SortableContext id={parentId ?? MAIN_LIST_ID} items={ids} strategy={verticalListSortingStrategy}>
      <ul id={id} className={depth === 0 ? 'todo-list' : 'todo-list sub-list'} role="list" aria-label={label}>
        {todos.map((todo, index) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            parentId={parentId}
            rank={index + 1}
            siblingCount={todos.length}
            depth={depth}
          />
        ))}
      </ul>
    </SortableContext>
  )
}
