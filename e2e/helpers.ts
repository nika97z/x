import { expect, type Locator, type Page } from '@playwright/test'

/** Titles in one list, in rank order (without what is inside them). */
export async function titlesIn(list: Locator) {
  return list.evaluate((ul) =>
    Array.from(ul.children, (li) => li.querySelector(':scope > .todo-row .todo-title')?.textContent ?? ''),
  )
}

/** Titles of the squares on the main page, in order. */
export async function squareTitles(page: Page) {
  return page.locator('.square:not(.add-square) .square-title').allTextContents()
}

export async function startFresh(page: Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

/** Uses the + square and ends on the new item's page. */
export async function createSquare(page: Page, title: string) {
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Title', exact: true })
  await input.fill(title)
  await input.press('Enter')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

export async function back(page: Page) {
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible()
}

export async function openSquare(page: Page, title: string) {
  await page.locator('.square', { has: page.locator('.square-title', { hasText: new RegExp(`^${title}$`) }) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

/** Adds items to the page's own list with the round + button: one title page per item. */
export async function addWithPlus(page: Page, parent: string, titles: string[]) {
  for (const title of titles) {
    await page.getByRole('button', { name: `Add inside "${parent}"`, exact: true }).click()
    const input = page.getByRole('textbox', { name: 'Title', exact: true })
    await input.fill(title)
    await input.press('Enter')
    await expect(page.getByRole('checkbox', { name: title, exact: true })).toBeVisible()
  }
}

/**
 * Adds items inside a row: "Add inside" (behind the row's actions on phones) opens the bar
 * below it, and Enter adds one item and closes the bar.
 */
export async function addInside(page: Page, parent: string, titles: string[]) {
  for (const title of titles) {
    const add = page.getByRole('button', { name: `Add inside "${parent}"`, exact: true })
    if (!(await add.isVisible())) await page.getByRole('button', { name: `Actions for "${parent}"`, exact: true }).click()
    await add.click()
    const input = page.getByRole('textbox', { name: `New title inside "${parent}"`, exact: true })
    await input.fill(title)
    await input.press('Enter')
    await expect(page.getByRole('checkbox', { name: title, exact: true })).toBeVisible()
    await expect(input).toBeHidden()
  }
}

/** Drags with real mouse moves, the way a person would. */
export async function drag(page: Page, handle: Locator, target: Locator) {
  const from = (await handle.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8, { steps: 4 })
  await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 15 })
  await page.mouse.up()
}

/** Drags with a finger: touch events through the browser's input pipeline. */
export async function touchDrag(page: Page, handle: Locator, target: Locator) {
  const client = await page.context().newCDPSession(page)
  const from = (await handle.boundingBox())!
  const to = (await target.boundingBox())!
  const x = from.x + from.width / 2
  const startY = from.y + from.height / 2
  const endY = to.y + to.height / 2
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] })
  const steps = 16
  for (let step = 1; step <= steps; step++) {
    const y = startY + ((endY - startY) * step) / steps
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
    await page.waitForTimeout(16)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
}
