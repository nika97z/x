/** False for elements hidden with CSS (e.g. the actions behind the "more" button). */
export function isVisible(element: HTMLElement) {
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true
}

export function findTodoElement(id: string) {
  return document.querySelector<HTMLElement>(`[data-todo-id="${id}"]`)
}

/** Focuses the first usable control of an item row; without one, the round + button or the + square. */
export function focusTodo(item: Element | null) {
  const row = item?.querySelector(':scope > .todo-row')
  const candidates = row
    ? ['.todo-checkbox', '.collapse-toggle', '.drag-handle', '.icon-button'].flatMap((selector) =>
        Array.from(row.querySelectorAll<HTMLElement>(selector)),
      )
    : []
  const target = candidates.find((element) => !(element as HTMLButtonElement).disabled && isVisible(element))
  // The caller decides about scrolling (see `revealTodo`).
  ;(target ?? document.querySelector<HTMLElement>('.fab, .add-square'))?.focus({ preventScroll: true })
}

/** Briefly highlights an item, e.g. one that was just added. */
export function flashTodo(item: Element) {
  item.classList.remove('just-added')
  item.classList.add('just-added')
  item.addEventListener('animationend', () => item.classList.remove('just-added'), { once: true })
}

/** Scrolls an item into view, clear of the + button at the bottom (see `scroll-margin` in the CSS). */
export function revealTodo(id: string) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  findTodoElement(id)?.scrollIntoView?.({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
}
