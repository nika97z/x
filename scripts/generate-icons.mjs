// Renders the app icons (PNG) from SVG with the installed Microsoft Edge.
// Run with: npm run icons
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const check =
  '<path d="m9 16.5 4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
const rounded = `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#4f46e5"/>${check}</svg>`
/** Full-bleed square; the platform crops it, so the check is scaled into the safe zone. */
const fullBleed = (scale) =>
  `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#4f46e5"/>` +
  `<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${check}</g></svg>`

const icons = [
  ['public/icons/icon-192.png', 192, rounded],
  ['public/icons/icon-512.png', 512, rounded],
  ['public/icons/maskable-512.png', 512, fullBleed(0.75)],
  ['public/icons/apple-touch-icon.png', 180, fullBleed(0.9)],
]

await mkdir('public/icons', { recursive: true })
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' })
const page = await browser.newPage()
for (const [file, size, svg] of icons) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  )
  await page.screenshot({ path: file, omitBackground: true })
  console.log(`wrote ${file}`)
}
await browser.close()
