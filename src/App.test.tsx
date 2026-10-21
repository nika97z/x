import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { loadTodos } from './todos/storage'
import { createTodoStore } from './todos/store'

type User = ReturnType<typeof userEvent.setup>

function renderApp() {
  const store = createTodoStore(localStorage)
  const user = userEvent.setup()
  const view = render(<App store={store} />)
  return { store, user, ...view }
}

/** The square of a main item on the main page. */
function square(title: string) {
  return screen.getByRole('button', { name: new RegExp(`^${title}`) })
}

/** Uses the + square: type the title, press Enter. Ends on the new item's page. */
async function createSquare(user: User, title: string) {
  await user.click(screen.getByRole('button', { name: 'Add' }))
  await user.type(screen.getByRole('textbox', { name: 'Title' }), `${title}{Enter}`)
  await screen.findByRole('heading', { name: title })
}

async function back(user: User) {
  await user.click(screen.getByRole('button', { name: 'Back' }))
  await screen.findByRole('button', { name: 'Add' })
}

/** Adds items to the page's own list with the round + button: one title page per item. */
async function addWithPlus(user: User, parent: string, titles: string[]) {
  for (const title of titles) {
    await user.click(screen.getByRole('button', { name: `Add inside "${parent}"` }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), `${title}{Enter}`)
    await screen.findByRole('checkbox', { name: title })
  }
}

/** Adds items inside a row: "Add inside" opens the bar below it, Enter adds one item and closes it. */
async function addInside(user: User, parent: string, titles: string[]) {
  for (const title of titles) {
    await user.click(screen.getByRole('button', { name: `Add inside "${parent}"` }))
    await user.type(screen.getByRole('textbox', { name: `New title inside "${parent}"` }), `${title}{Enter}`)
    await screen.findByRole('checkbox', { name: title })
  }
}

/** The row of an item with this exact title (without what is inside it). */
function row(title: string): HTMLElement {
  return screen.getByRole('checkbox', { name: title }).closest('.todo-row')!
}

function ranksIn(list: HTMLElement) {
  return within(list)
    .getAllByRole('listitem')
    .filter((item) => item.parentElement === list)
    .map((item) => item.querySelector(':scope > .todo-row .rank')?.textContent)
}

describe('main page', () => {
  it('starts with only the + square and no text at all', () => {
    const { container } = renderApp()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('square', 'add-square')
    expect(container.textContent).toBe('')
  })

  it('+ opens a new page; a title creates the square and opens its page', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    // The page has the round + button and no add bar.
    expect(screen.getByRole('button', { name: 'Add inside "Trip"' })).toHaveClass('fab')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await back(user)
    expect(square('Trip')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Trip', ''])
    expect(within(items[1]).getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('going back from the new page keeps a typed title and adds nothing without one', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await back(user)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Groceries')
    await back(user)
    expect(square('Groceries')).toBeInTheDocument()
  })

  it('shows progress on a square and marks it when everything inside is done', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Flights', 'Hotel'])
    await user.click(screen.getByRole('checkbox', { name: 'Flights' }))
    await back(user)
    expect(square('Trip')).toHaveTextContent('Trip1/2 done')
    expect(square('Trip')).not.toHaveClass('is-completed')

    await user.click(square('Trip'))
    await user.click(await screen.findByRole('checkbox', { name: 'Hotel' }))
    await back(user)
    expect(square('Trip')).toHaveTextContent('2/2 done')
    expect(square('Trip')).toHaveClass('is-completed')
  })
})

describe('adding: the round + button and the bar below a row', () => {
  it('opens a page with just the title; Enter adds it at the end and comes back to show it', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Flights'])

    await user.click(screen.getByRole('button', { name: 'Add inside "Trip"' }))
    const title = screen.getByRole('textbox', { name: 'Title' })
    expect(title).toHaveFocus()
    expect(title).toHaveAccessibleDescription('Inside "Trip"')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    await user.type(title, 'Hotel{Enter}')
    const hotel = await screen.findByRole('checkbox', { name: 'Hotel' })
    expect(ranksIn(screen.getByRole('list', { name: 'Inside "Trip"' }))).toEqual(['1', '2'])
    // Highlighted and focused where it landed.
    await vi.waitFor(() => expect(hotel).toHaveFocus())
    expect(hotel.closest('li')).toHaveClass('just-added')
  })

  it('shows the bar below a row only after "Add inside", and closes it once the item is added', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Packing', 'Flights'])
    const hash = location.hash
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    const addInsidePacking = screen.getByRole('button', { name: 'Add inside "Packing"' })
    await user.click(addInsidePacking)
    const input = screen.getByRole('textbox', { name: 'New title inside "Packing"' })
    expect(input).toHaveFocus()
    expect(location.hash).toBe(hash)
    // Below the row it belongs to.
    expect(screen.getByRole('checkbox', { name: 'Packing' }).closest('li')).toContainElement(input)

    await user.type(input, 'Documents{Enter}')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    const documents = screen.getByRole('checkbox', { name: 'Documents' })
    await vi.waitFor(() => expect(documents.closest('li')).toHaveClass('just-added'))
    await vi.waitFor(() => expect(addInsidePacking).toHaveFocus())
    expect(location.hash).toBe(hash)
  })

  it('adds inside rows at any depth, one item per "Add inside"', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Packing'])
    await addInside(user, 'Packing', ['Documents', 'Clothes'])
    await addInside(user, 'Documents', ['Passport', 'Visa'])

    expect(ranksIn(screen.getByRole('list', { name: 'Inside "Packing"' }))).toEqual(['1', '2'])
    expect(ranksIn(screen.getByRole('list', { name: 'Inside "Documents"' }))).toEqual(['1', '2'])
    expect(within(row('Packing')).getByText('0/2')).toBeInTheDocument()
    expect(within(row('Documents')).getByText('0/2')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('has only one bar open at a time', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Packing', 'Flights'])
    await user.click(screen.getByRole('button', { name: 'Add inside "Packing"' }))
    await user.click(screen.getByRole('button', { name: 'Add inside "Flights"' }))
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('textbox', { name: 'New title inside "Flights"' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Add inside "Packing"' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('the Cancel button closes the bar without adding anything', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Packing'])
    await user.click(screen.getByRole('button', { name: 'Add inside "Packing"' }))
    await user.type(screen.getByRole('textbox', { name: 'New title inside "Packing"' }), 'Not added')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Not added' })).not.toBeInTheDocument()
  })

  it('back keeps a typed title and adds nothing without one', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await user.click(screen.getByRole('button', { name: 'Add inside "Trip"' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('heading', { name: 'Trip' })
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add inside "Trip"' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Flights')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('checkbox', { name: 'Flights' })).toBeInTheDocument()
  })

  it('opened directly (e.g. after a reload), Enter leads to the page of the list', async () => {
    const { user, unmount } = renderApp()
    await createSquare(user, 'Trip')
    const tripId = loadTodos(localStorage)[0].id
    unmount()

    history.replaceState(null, '', `#/new/${tripId}`)
    renderApp()
    expect(screen.getByText('Inside "Trip"')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Flights{Enter}')
    expect(await screen.findByRole('heading', { name: 'Trip' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Flights' })).toBeInTheDocument()
  })
})

describe('item page', () => {
  it('completes items automatically when everything inside is done, at every level', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Flights', 'Packing'])
    await addInside(user, 'Packing', ['Clothes', 'Passport'])

    const packing = screen.getByRole('checkbox', { name: 'Packing' })
    expect(packing).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('checkbox', { name: 'Clothes' }))
    expect(packing).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Passport' }))
    expect(packing).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Flights' }))
    expect(document.querySelector('.page-progress')).toHaveClass('is-completed')

    await user.click(screen.getByRole('checkbox', { name: 'Clothes' }))
    expect(packing).not.toBeChecked()
    expect(document.querySelector('.page-progress')).not.toHaveClass('is-completed')
  })

  it('explains instead of toggling when an item with items inside is tapped', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Packing'])
    await addInside(user, 'Packing', ['Clothes', 'Passport'])

    await user.click(screen.getByRole('checkbox', { name: 'Packing' }))
    expect(screen.getByRole('checkbox', { name: 'Packing' })).not.toBeChecked()
    expect(document.querySelector('.notice-region')).toHaveTextContent(
      '"Packing" will be done when everything inside it is done (2 left).',
    )
  })

  it('un-completes an item when something new is added inside it', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Packing'])
    await addInside(user, 'Packing', ['Clothes'])
    await user.click(screen.getByRole('checkbox', { name: 'Clothes' }))
    expect(screen.getByRole('checkbox', { name: 'Packing' })).toBeChecked()

    await addInside(user, 'Packing', ['Passport'])
    expect(screen.getByRole('checkbox', { name: 'Packing' })).not.toBeChecked()
  })

  it('edits titles of rows and of the page item', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Old title'])

    await user.click(screen.getByRole('button', { name: 'Edit "Old title"' }))
    await user.keyboard('{Control>}a{/Control}New title{Enter}')
    expect(screen.getByRole('checkbox', { name: 'New title' })).toBeInTheDocument()
    await user.dblClick(screen.getByText('New title'))
    await user.keyboard('{Control>}a{/Control}Discarded{Escape}')
    expect(screen.queryByText('Discarded')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Actions for "Trip"' }))
    await user.click(screen.getByRole('button', { name: 'Edit "Trip"' }))
    await user.keyboard('{Control>}a{/Control}Holiday{Enter}')
    expect(screen.getByRole('heading', { name: 'Holiday' })).toBeInTheDocument()
    await back(user)
    expect(square('Holiday')).toBeInTheDocument()
  })

  it('deletes a row with what is inside it, and Undo puts it back at its rank', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['First', 'Packing', 'Last'])
    await addInside(user, 'Packing', ['Clothes', 'Passport'])
    await user.click(screen.getByRole('checkbox', { name: 'Clothes' }))

    await user.click(screen.getByRole('button', { name: 'Delete "Packing"' }))
    expect(screen.queryByRole('checkbox', { name: 'Packing' })).not.toBeInTheDocument()
    expect(document.querySelector('.notice-region')).toHaveTextContent('Deleted "Packing" and 2 inside it')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    const list = screen.getByRole('list', { name: 'Inside "Trip"' })
    expect(
      within(list)
        .getAllByRole('checkbox', { name: /First|Packing|Last/ })
        .map((box) => box.ariaLabel),
    ).toEqual(['First', 'Packing', 'Last'])
    expect(screen.getByRole('checkbox', { name: 'Clothes' })).toBeChecked()
  })

  it('moves focus to the round + button after deleting the last row', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Only'])
    await user.click(screen.getByRole('button', { name: 'Delete "Only"' }))
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Add inside "Trip"' })).toHaveFocus())
  })

  it('deletes the page item, goes back, and Undo brings the square back', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Flights'])
    await back(user)
    await createSquare(user, 'Work')
    await back(user)

    await user.click(square('Trip'))
    await user.click(await screen.findByRole('button', { name: 'Actions for "Trip"' }))
    await user.click(screen.getByRole('button', { name: 'Delete "Trip"' }))
    await screen.findByRole('button', { name: 'Add' })
    expect(screen.queryByRole('button', { name: /^Trip/ })).not.toBeInTheDocument()
    expect(document.querySelector('.notice-region')).toHaveTextContent('Deleted "Trip" and 1 inside it')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Trip0/1 done', 'Work', ''])
  })

  it('hides the Undo message after a while', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { user } = renderApp()
      await createSquare(user, 'Trip')
      await addWithPlus(user, 'Trip', ['Flights'])
      await user.click(screen.getByRole('button', { name: 'Delete "Flights"' }))
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(8000))
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('collapses and expands what is inside a row', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Packing'])
    await addInside(user, 'Packing', ['Clothes'])

    const toggle = screen.getByRole('button', { name: 'Inside "Packing"' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('checkbox', { name: 'Clothes' })).not.toBeInTheDocument()
    await user.click(toggle)
    expect(screen.getByRole('checkbox', { name: 'Clothes' })).toBeInTheDocument()
  })

  it('opens the row actions by tapping a row', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Flights'])
    const more = screen.getByRole('button', { name: 'Actions for "Flights"' })
    await user.click(screen.getByText('Flights'))
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(more.getAttribute('aria-controls')!)).toHaveClass('is-open')
  })

  it('disables the drag handle when an item is alone in its list', async () => {
    const { user } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Only one'])
    expect(screen.getByRole('button', { name: /Change rank of "Only one"/ })).toBeDisabled()
    await addWithPlus(user, 'Trip', ['Second'])
    expect(screen.getByRole('button', { name: /Change rank of "Only one"/ })).toBeEnabled()
  })
})

describe('the whole app', () => {
  it('remembers everything, and the open page, after a reload', async () => {
    const { user, unmount } = renderApp()
    await createSquare(user, 'Trip')
    await addWithPlus(user, 'Trip', ['Flights'])
    await user.click(screen.getByRole('checkbox', { name: 'Flights' }))
    unmount()

    expect(loadTodos(localStorage)[0].completed).toBe(true)
    renderApp()
    expect(screen.getByRole('heading', { name: 'Trip' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Flights' })).toBeChecked()
  })

  it('shows the main page for a page whose item no longer exists', async () => {
    history.replaceState(null, '', '#/item/gone')
    const { unmount } = renderApp()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    await vi.waitFor(() => expect(location.hash).toBe(''))
    unmount()

    history.replaceState(null, '', '#/new/gone')
    renderApp()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    await vi.waitFor(() => expect(location.hash).toBe(''))
  })

  it('never shows or announces the word "todo"', async () => {
    const { user, container } = renderApp()
    const check = () => {
      const texts = [container.textContent ?? '']
      for (const element of container.querySelectorAll('*')) {
        for (const name of ['aria-label', 'title', 'placeholder', 'aria-roledescription']) {
          texts.push(element.getAttribute(name) ?? '')
        }
      }
      // Screen reader instructions and announcements live outside the app's container.
      texts.push(document.body.textContent ?? '')
      expect(texts.join(' ')).not.toMatch(/todo/i)
    }
    check()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    check()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Trip{Enter}')
    await screen.findByRole('heading', { name: 'Trip' })
    await addWithPlus(user, 'Trip', ['Packing', 'Flights'])
    await user.click(screen.getByRole('button', { name: 'Add inside "Packing"' }))
    check()
    await user.type(screen.getByRole('textbox', { name: 'New title inside "Packing"' }), 'Clothes{Enter}')
    await screen.findByRole('checkbox', { name: 'Clothes' })
    await user.click(screen.getByRole('checkbox', { name: 'Packing' }))
    await user.click(screen.getByRole('button', { name: 'Actions for "Trip"' }))
    await user.click(screen.getByRole('button', { name: 'Delete "Flights"' }))
    check()
    await back(user)
    check()
  })
})
