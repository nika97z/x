import { expect, test } from '@playwright/test'
import { back, createSquare, squareTitles } from './helpers'

// Runs against the production build (`vite preview`), where the service worker is active.

test('can be installed: manifest and icons are served', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifestUrl = new URL(href!, page.url()).href
  const manifest = await (await request.get(manifestUrl)).json()
  expect(manifest).toMatchObject({ name: 'Checklist', display: 'standalone', start_url: './' })

  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await request.get(new URL(icon.src, manifestUrl).href)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('image/png')
  }
})

test('opens without a connection after the first visit', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // The page and every file it needs are cached.
  const missing = await page.evaluate(async () => {
    const cache = await caches.open('todos-v1')
    const needed = [
      location.href,
      ...Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'), (el) => el.src),
      ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), (el) => el.href),
    ]
    const results = await Promise.all(needed.map(async (url) => ((await cache.match(url)) ? null : url)))
    return results.filter(Boolean)
  })
  expect(missing).toEqual([])

  await createSquare(page, 'Made online')
  await back(page)

  await context.setOffline(true)
  await page.reload()
  await expect.poll(() => squareTitles(page)).toEqual(['Made online'])
  await createSquare(page, 'Made offline')
  await back(page)
  await expect.poll(() => squareTitles(page)).toEqual(['Made online', 'Made offline'])
  await context.setOffline(false)
})
