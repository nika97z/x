export interface Todo {
  id: string
  title: string
  /**
   * A todo without sub todos is completed by the user.
   * A todo with sub todos is completed exactly when all of its sub todos are;
   * `normalizeTodos` keeps this in sync after every change.
   */
  completed: boolean
  /** Whether the sub todos are hidden in the list. */
  collapsed: boolean
  createdAt: number
  /** Sub todos in rank order: the first one has rank 1. */
  children: Todo[]
}

/** The id of the todo that owns a list, or `null` for the list of main todos. */
export type ParentId = string | null
