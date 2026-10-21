import { createContext, useContext } from 'react'

/** Which row has its "add inside" bar open. Only one at a time, and only after "Add inside" was clicked. */
export interface AddingInside {
  id: string | null
  open(id: string): void
  close(): void
}

export const AddingInsideContext = createContext<AddingInside>({ id: null, open() {}, close() {} })

export function useAddingInside() {
  return useContext(AddingInsideContext)
}
