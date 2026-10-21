import { expect, test } from '@playwright/test'
import {
  addInside,
  addWithPlus,
  back,
  createSquare,
  drag,
  openSquare,
  squareTitles,
  startFresh,
  titlesIn,
} from './helpers'

// Desktop: mouse and keyboard.

test.beforeEach(async ({ page }) => {
  await startFresh(page)
})

test('builds nested items, completes them automatically and remembers them', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['Flights', 'Packing'])
  await addInside(page, 'Packing', ['Clothes', 'Passport'])

  const packing = page.getByRole('checkbox', { name: 'Packing' })
  await expect(packing).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Clothes' }).check()
  await expect(packing).not.toBeChecked()
  await page.getByRole('checkbox', { name: 'Passport' }).check()
  await expect(packing).toBeChecked()
  await page.getByRole('checkbox', { name: 'Flights' }).check()
  await expect(page.locator('.page-progress')).toHaveClass(/is-completed/)

  // The open page and everything on it survive a reload.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Passport' })).toBeChecked()
  await back(page)
  await expect(page.locator('.square.is-completed')).toContainText('2/2')
})

test('changes ranks by dragging with the mouse', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['One', 'Two', 'Three'])
  const list = page.getByRole('list', { name: 'Inside "Trip"' })

  await drag(page, page.getByRole('button', { name: /Change rank of "Three"/ }), page.getByText('One', { exact: true }))
  await expect.poll(() => titlesIn(list)).toEqual(['Three', 'One', 'Two'])
  await expect(page.getByRole('button', { name: 'Change rank of "Three" (rank 1 of 3)' })).toBeVisible()

  await page.reload()
  await expect.poll(() => titlesIn(page.getByRole('list', { name: 'Inside "Trip"' }))).toEqual(['Three', 'One', 'Two'])
})

test('keeps a dragged item in its own list', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['Packing', 'Work'])
  await addInside(page, 'Packing', ['Flights', 'Hotel', 'Bags'])
  const inner = page.getByRole('list', { name: 'Inside "Packing"' })

  await drag(page, page.getByRole('button', { name: /Change rank of "Bags"/ }), page.getByText('Flights', { exact: true }))
  await expect.poll(() => titlesIn(inner)).toEqual(['Bags', 'Flights', 'Hotel'])

  // Dragged onto an item of the outer list, it stays inside "Packing".
  await drag(page, page.getByRole('button', { name: /Change rank of "Hotel"/ }), page.getByText('Work', { exact: true }))
  await expect.poll(() => titlesIn(inner)).toEqual(['Bags', 'Flights', 'Hotel'])
  await expect.poll(() => titlesIn(page.getByRole('list', { name: 'Inside "Trip"' }))).toEqual(['Packing', 'Work'])
})

test('changes ranks with the keyboard, also for tall items', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['One', 'Two', 'Three'])
  await addInside(page, 'One', ['Sub A', 'Sub B'])
  const list = page.getByRole('list', { name: 'Inside "Trip"' })

  await page.getByRole('button', { name: /Change rank of "One"/ }).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Space')
  await expect.poll(() => titlesIn(list)).toEqual(['Two', 'Three', 'One'])
  await expect.poll(() => titlesIn(page.getByRole('list', { name: 'Inside "One"' }))).toEqual(['Sub A', 'Sub B'])
})

test('Escape cancels a keyboard move and a plain click on the handle changes nothing', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['One', 'Two', 'Three'])
  const list = page.getByRole('list', { name: 'Inside "Trip"' })

  const handle = page.getByRole('button', { name: /Change rank of "One"/ })
  await handle.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await expect.poll(() => titlesIn(list)).toEqual(['One', 'Two', 'Three'])

  await handle.click()
  await expect.poll(() => titlesIn(list)).toEqual(['One', 'Two', 'Three'])
  await page.getByRole('checkbox', { name: 'Two' }).check()
  await expect(page.getByRole('checkbox', { name: 'Two' })).toBeChecked()
})

test('moves an item past tall expanded siblings', async ({ page }) => {
  await createSquare(page, 'Project')
  await addWithPlus(page, 'Project', ['Design', 'Build', 'Ship'])
  await addInside(page, 'Design', ['Sketch', 'Review', 'Approve'])
  await addInside(page, 'Build', ['Frontend', 'Backend'])
  const list = page.getByRole('list', { name: 'Inside "Project"' })

  await drag(page, page.getByRole('button', { name: /Change rank of "Ship"/ }), page.getByText('Design', { exact: true }))
  await expect.poll(() => titlesIn(list)).toEqual(['Ship', 'Design', 'Build'])
  await drag(page, page.getByRole('button', { name: /Change rank of "Design"/ }), page.getByText('Backend', { exact: true }))
  await expect.poll(() => titlesIn(list)).toEqual(['Ship', 'Build', 'Design'])
  const ranks = await list.evaluate((ul) =>
    Array.from(ul.children, (li) => li.querySelector(':scope > .todo-row .rank')?.textContent),
  )
  expect(ranks).toEqual(['1', '2', '3'])
})

test('completion cascades through five levels', async ({ page }) => {
  await createSquare(page, 'L1')
  await addWithPlus(page, 'L1', ['L2'])
  for (let level = 2; level < 5; level++) await addInside(page, `L${level}`, [`L${level + 1}`])
  await addInside(page, 'L3', ['L4b'])

  await page.getByRole('checkbox', { name: 'L5' }).check()
  await expect(page.getByRole('checkbox', { name: 'L4', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'L2' })).not.toBeChecked()
  await page.getByRole('checkbox', { name: 'L4b' }).check()
  for (const title of ['L2', 'L3']) await expect(page.getByRole('checkbox', { name: title })).toBeChecked()
  await back(page)
  await expect(page.locator('.square.is-completed')).toBeVisible()

  await openSquare(page, 'L1')
  await page.getByRole('checkbox', { name: 'L5' }).uncheck()
  for (const title of ['L2', 'L3', 'L4']) {
    await expect(page.getByRole('checkbox', { name: title, exact: true })).not.toBeChecked()
  }
})

test('keeps two open tabs in sync', async ({ page, context }) => {
  await createSquare(page, 'From tab one')
  await back(page)
  const other = await context.newPage()
  await other.goto('./')
  await expect(other.locator('.square-title', { hasText: 'From tab one' })).toBeVisible()

  await createSquare(other, 'From tab two')
  await expect.poll(() => squareTitles(page)).toEqual(['From tab one', 'From tab two'])
})

test('moves focus to the next row after deleting one, then to the + button', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['One', 'Two'])
  await page.getByRole('button', { name: 'Delete "One"' }).click()
  await expect(page.getByRole('checkbox', { name: 'Two' })).toBeFocused()
  await page.getByRole('button', { name: 'Delete "Two"' }).click()
  await expect(page.getByRole('button', { name: 'Add inside "Trip"', exact: true })).toBeFocused()
})

test("the browser's back button returns to the main page", async ({ page }) => {
  await createSquare(page, 'Trip')
  await page.goBack()
  await expect(page.locator('.square-title', { hasText: 'Trip' })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible()
})
