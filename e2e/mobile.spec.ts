import { expect, test } from '@playwright/test'
import { addInside, addWithPlus, back, createSquare, squareTitles, startFresh, titlesIn, touchDrag } from './helpers'

// Runs on an emulated phone (see playwright.config.ts) with real touch input.

test.beforeEach(async ({ page }) => {
  await startFresh(page)
})

test('the main page is a grid of squares, two per row, ending with a + square', async ({ page }) => {
  // At first: only the + square, and no text anywhere.
  await expect(page.locator('.square')).toHaveCount(1)
  expect((await page.locator('#root').innerText()).trim()).toBe('')

  for (const title of ['Groceries', 'Trip', 'Work']) {
    await createSquare(page, title)
    await back(page)
  }
  const boxes = await page.locator('.square').evaluateAll((squares) =>
    squares.map((square) => {
      const { x, y, width, height } = square.getBoundingClientRect()
      return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
    }),
  )
  expect(boxes).toHaveLength(4)
  for (const box of boxes) {
    expect(box.width).toBe(boxes[0].width) // all the same size, the + square too
    expect(box.height).toBe(box.width) // square
  }
  expect(boxes[1].y).toBe(boxes[0].y) // two per row
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x)
  expect(boxes[2].y).toBeGreaterThan(boxes[0].y)
  expect(boxes[3].y).toBe(boxes[2].y)
  expect(boxes[0].width).toBeGreaterThan(page.viewportSize()!.width * 0.4)
  expect(await squareTitles(page)).toEqual(['Groceries', 'Trip', 'Work'])
})

test('+ opens a page to name the new square; its page has a round + button in the corner', async ({ page }) => {
  await page.getByRole('button', { name: 'Add', exact: true }).tap()
  const title = page.getByRole('textbox', { name: 'Title', exact: true })
  await expect(title).toBeFocused()
  await title.fill('Trip')
  await title.press('Enter')
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible()

  // No add bar: only the round + button, in the bottom-right corner.
  await expect(page.getByRole('textbox')).toHaveCount(0)
  const fab = page.getByRole('button', { name: 'Add inside "Trip"', exact: true })
  const box = (await fab.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.width).toBeGreaterThanOrEqual(56)
  expect(box.height).toBe(box.width)
  expect(await fab.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('50%')
  expect(viewport.width - (box.x + box.width)).toBeLessThan(24)
  expect(viewport.height - (box.y + box.height)).toBeLessThan(40)

  // It opens the title page; Enter comes back with the new item in the list.
  await fab.tap()
  await expect(page.getByText('Inside "Trip"')).toBeVisible()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Flights')
  await page.getByRole('textbox', { name: 'Title', exact: true }).press('Enter')
  await expect(page.getByRole('checkbox', { name: 'Flights' })).toBeVisible()
  await expect(page.locator('li', { has: page.getByRole('checkbox', { name: 'Flights' }) })).toHaveClass(/just-added/)

  // It stays in the corner while a long list scrolls, and the last row is not hidden behind it.
  await addWithPlus(page, 'Trip', Array.from({ length: 14 }, (_, i) => `Item ${i + 1}`))
  await page.evaluate(() => window.scrollTo(0, 0))
  const scrolled = (await fab.boundingBox())!
  expect(viewport.height - (scrolled.y + scrolled.height)).toBeLessThan(40)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const lastRow = (await page.locator('.todo-row', { hasText: 'Item 14' }).boundingBox())!
  expect(lastRow.y + lastRow.height).toBeLessThanOrEqual((await fab.boundingBox())!.y)

  // Coming back from the title page keeps the list where it was.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const before = await page.evaluate(() => Math.round(window.scrollY))
  expect(before).toBeGreaterThan(30)
  await fab.tap()
  await page.getByRole('button', { name: 'Back' }).tap()
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(before)

  // The phone's back gesture goes to the main page.
  await page.goBack()
  await expect(page.locator('.square-title', { hasText: 'Trip' })).toBeVisible()
})

test('"Add inside" on a row opens a bar right below it, only when tapped, on the same page', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['Packing', 'Flights'])
  const url = page.url()
  await expect(page.locator('.add-form')).toHaveCount(0)

  await page.locator('.todo-title', { hasText: /^Packing$/ }).tap()
  await page.getByRole('button', { name: 'Add inside "Packing"', exact: true }).tap()
  const input = page.getByRole('textbox', { name: 'New title inside "Packing"', exact: true })
  await expect(input).toBeFocused()
  expect(page.url()).toBe(url)

  // Below the row it belongs to, above the next row.
  const bar = (await page.locator('.add-form').boundingBox())!
  const rowBox = async (title: string) =>
    (await page.locator('.todo-row', { has: page.getByRole('checkbox', { name: title, exact: true }) }).boundingBox())!
  expect(bar.y).toBeGreaterThanOrEqual((await rowBox('Packing')).y + (await rowBox('Packing')).height - 1)
  expect(bar.y + bar.height).toBeLessThanOrEqual((await rowBox('Flights')).y + 1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)

  // Adding one item closes the bar (and the row's actions).
  await input.fill('Clothes')
  await input.press('Enter')
  await expect(page.getByRole('checkbox', { name: 'Clothes' })).toBeVisible()
  await expect(page.locator('.add-form')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add inside "Packing"', exact: true })).toBeHidden()

  // Cancel closes it without adding.
  await page.locator('.todo-title', { hasText: /^Packing$/ }).tap()
  await page.getByRole('button', { name: 'Add inside "Packing"', exact: true }).tap()
  await page.getByRole('textbox', { name: 'New title inside "Packing"', exact: true }).fill('Not added')
  await page.getByRole('button', { name: 'Cancel' }).tap()
  await expect(page.locator('.add-form')).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Not added' })).toHaveCount(0)
  expect(page.url()).toBe(url)
})

test('builds nested items with taps; the square shows the progress', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['Flights', 'Packing'])
  await addInside(page, 'Packing', ['Clothes', 'Passport'])

  for (const title of ['Flights', 'Clothes']) await page.getByRole('checkbox', { name: title }).tap()
  await expect(page.getByRole('checkbox', { name: 'Packing' })).not.toBeChecked()
  await back(page)
  await expect(page.locator('.square')).toContainText(['1/2'])

  await page.locator('.square', { hasText: 'Trip' }).tap()
  await page.getByRole('checkbox', { name: 'Passport' }).tap()
  await expect(page.getByRole('checkbox', { name: 'Packing' })).toBeChecked()
  await back(page)
  await expect(page.locator('.square.is-completed')).toContainText('2/2')
})

test('tapping an item with items inside explains how it completes', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['Packing'])
  await addInside(page, 'Packing', ['Clothes', 'Passport'])
  const packing = page.getByRole('checkbox', { name: 'Packing' })

  await packing.tap({ force: true })
  await expect(packing).not.toBeChecked()
  await expect(page.locator('.notice')).toContainText('will be done when everything inside it is done (2 left)')
})

test('changes ranks by dragging with a finger', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['One', 'Two', 'Three'])
  await addInside(page, 'One', ['Sub A', 'Sub B'])
  const list = page.getByRole('list', { name: 'Inside "Trip"' })

  await touchDrag(page, page.getByRole('button', { name: /Change rank of "Three"/ }), page.getByText('One', { exact: true }))
  await expect.poll(() => titlesIn(list)).toEqual(['Three', 'One', 'Two'])

  // A tall item (with items inside) moves down past a short one.
  await touchDrag(page, page.getByRole('button', { name: /Change rank of "One"/ }), page.getByText('Two', { exact: true }))
  await expect.poll(() => titlesIn(list)).toEqual(['Three', 'Two', 'One'])
  await expect.poll(() => titlesIn(page.getByRole('list', { name: 'Inside "One"' }))).toEqual(['Sub A', 'Sub B'])

  // An inner item dragged onto an outer one stays in its own list.
  await touchDrag(page, page.getByRole('button', { name: /Change rank of "Sub A"/ }), page.getByText('Three', { exact: true }))
  await expect.poll(() => titlesIn(page.getByRole('list', { name: 'Inside "One"' }))).toEqual(['Sub A', 'Sub B'])

  await page.reload()
  await expect.poll(() => titlesIn(page.getByRole('list', { name: 'Inside "Trip"' }))).toEqual(['Three', 'Two', 'One'])
})

test('deleting can be undone, for rows and for squares', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['One', 'Two', 'Three'])
  await page.locator('.todo-title', { hasText: /^Two$/ }).tap()
  await page.getByRole('button', { name: 'Delete "Two"' }).tap()
  await expect(page.locator('.notice')).toContainText('Deleted "Two"')
  await page.getByRole('button', { name: 'Undo' }).tap()
  await expect.poll(() => titlesIn(page.getByRole('list', { name: 'Inside "Trip"' }))).toEqual(['One', 'Two', 'Three'])

  await page.getByRole('button', { name: 'Actions for "Trip"' }).tap()
  await page.getByRole('button', { name: 'Delete "Trip"' }).tap()
  await expect(page.locator('.notice')).toContainText('Deleted "Trip" and 3 inside it')
  await expect(page.locator('.square')).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo' }).tap()
  await expect.poll(() => squareTitles(page)).toEqual(['Trip'])
})

test('edits titles by tapping them', async ({ page }) => {
  await createSquare(page, 'Trip')
  await page.getByRole('heading', { name: 'Trip' }).tap()
  const pageTitle = page.getByRole('textbox', { name: 'Title', exact: true })
  await pageTitle.fill('Holiday')
  await pageTitle.press('Enter')
  await expect(page.getByRole('heading', { name: 'Holiday' })).toBeVisible()

  await addWithPlus(page, 'Holiday', ['Old'])
  await page.locator('.todo-title', { hasText: /^Old$/ }).tap()
  await page.getByRole('button', { name: 'Edit "Old"' }).tap()
  const rowTitle = page.getByRole('textbox', { name: 'Title', exact: true })
  await rowTitle.fill('New')
  await rowTitle.press('Enter')
  await expect(page.getByRole('checkbox', { name: 'New' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit "New"' })).toBeHidden()
})

test('has finger-sized targets, readable titles and no sideways scrolling', async ({ page }) => {
  await createSquare(page, 'Level 1')
  await addWithPlus(page, 'Level 1', ['Level 2'])
  for (let level = 2; level < 7; level++) await addInside(page, `Level ${level}`, [`Level ${level + 1}`])
  await page.locator('.todo-title', { hasText: /^Level 7$/ }).tap()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)

  const row = page.locator('.todo-row', { has: page.getByRole('checkbox', { name: 'Level 7' }) })
  const targets = [
    row.locator('.drag-handle'),
    row.locator('.checkbox-hit'),
    row.locator('.more-button'),
    ...(await row.locator('.todo-actions button').all()),
    page.locator('.todo-row', { has: page.getByRole('checkbox', { name: 'Level 2' }) }).locator('.collapse-toggle'),
    page.getByRole('button', { name: 'Back' }),
    page.getByRole('button', { name: 'Actions for "Level 1"' }),
    page.getByRole('button', { name: 'Add inside "Level 1"', exact: true }),
  ]
  for (const target of targets) {
    const box = (await target.boundingBox())!
    expect(box.height, await target.evaluate((el) => el.className)).toBeGreaterThanOrEqual(44)
    expect(box.width, await target.evaluate((el) => el.className)).toBeGreaterThanOrEqual(34)
  }
  expect((await row.locator('.todo-title').boundingBox())!.width).toBeGreaterThan(80)
  // Text fields are 16px or larger, so iOS does not zoom in on them.
  await page.getByRole('button', { name: 'Add inside "Level 1"', exact: true }).tap()
  const fontSize = await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .evaluate((el) => getComputedStyle(el).fontSize)
  expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16)
})

test('never shows the word "todo"', async ({ page }) => {
  await createSquare(page, 'Trip')
  await addWithPlus(page, 'Trip', ['Packing'])
  await addInside(page, 'Packing', ['Clothes'])
  const texts = async () =>
    page.evaluate(() => {
      const parts = [document.title, document.body.innerText]
      for (const element of document.querySelectorAll('*')) {
        for (const name of ['aria-label', 'title', 'placeholder']) parts.push(element.getAttribute(name) ?? '')
      }
      return parts.join(' ')
    })
  expect(await texts()).not.toMatch(/todo/i)
  await back(page)
  expect(await texts()).not.toMatch(/todo/i)
})
