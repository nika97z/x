import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no layout, so scrolling is a no-op here.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
  localStorage.clear()
  // Every test starts on the main page.
  history.replaceState(null, '', '/')
})
