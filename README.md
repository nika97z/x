# Checklist

Lists inside lists: ranks you change by dragging, and items that complete themselves when everything inside is done.
It is made for phones first, and works on desktop too.

## Run it

```sh
npm install      # once
npm run dev      # then open the address it prints, e.g. http://localhost:5173
```

To see the phone layout on a PC: open DevTools (F12), press Ctrl+Shift+M and pick a phone.

### On your phone

- **Quick try (same Wi-Fi):** run `npm run dev:phone` and open the "Network" address it prints (e.g. `http://192.168.1.20:5173`)
  on your phone. Windows may ask to allow Node.js through the firewall.
- **Install it as an app (home screen, full screen, works offline):** the browser only allows this over **https**.
  Run `npm run build` and put the `dist/` folder on any static host with https (Netlify, Vercel, GitHub Pages, Cloudflare Pages…).
  Then open it on the phone and choose **Add to Home Screen** (iPhone: Share menu; Android: browser menu or the install prompt).

Everything is saved on the device (in the browser's storage), so each phone or browser has its own data.

## How it works

- **Main page:** your main items as squares, two per row, each with its progress (e.g. `2/5` and a bar).
  A square turns green when everything inside it is done. The last square, **+**, adds a new one.
- **+ square:** opens a page where you type the title. Enter opens the new item's page; going back without a title adds nothing.
- **An item's page:** tap a square to open it. The round **+** button in the bottom-right corner adds an item to its
  list: it opens a page with just the title field, and Enter saves it and brings you back to the list, where the new
  item is highlighted. Tap a row for **Add inside** (a bar opens right below that row only when you click it; Enter adds
  the item and closes the bar, Cancel closes it), **Edit** and **Delete**; items can go inside items at any depth. **⋯** at the top edits or deletes the item itself. The back arrow
  (or the phone's back button) returns to the main page, and each list keeps its scroll position.
- **Ranks:** every row shows its rank, its position in its own list (1, 2, 3…). Press and drag the **⠿ 1** handle up or
  down to change it. An item only moves within its own list, and what is inside it moves along.
  With a keyboard: focus the handle, press Space, use ↑/↓, then Space to drop (Escape cancels).
- **Automatic completion:** an item with items inside is done exactly when all of them are done (its checkbox is dashed
  until then). Tapping it explains how many are left.
- **Undo:** deleting shows an **Undo** button for a few seconds that puts everything back where it was.

## Scripts

| Command                 | What it does                                                    |
| ----------------------- | --------------------------------------------------------------- |
| `npm run dev`           | Start the app with hot reload                                   |
| `npm run dev:phone`     | Same, reachable from other devices on your network              |
| `npm run build`         | Type-check and build for production into `dist/`                |
| `npm run preview:phone` | Serve the production build on your network                      |
| `npm test`              | Unit and component tests (Vitest)                               |
| `npm run test:e2e`      | Browser tests: phone with touch, desktop, and the installed app (Playwright, uses Microsoft Edge) |
| `npm run lint`          | Lint (oxlint)                                                   |
| `npm run icons`         | Regenerate the app icons in `public/icons/`                     |

Set `PW_CHANNEL=chrome` to run the browser tests in Chrome instead of Edge.

## Code map

The code still uses its original internal names (`Todo`, `src/todos/…`, the `nested-todos` storage key); renaming the
storage key would lose saved data. None of these names appear in the app.

- `src/pages/HomePage.tsx`, `NewItemPage.tsx`, `ItemPage.tsx`: the three pages; `src/navigation.ts`: which page is open (URL hash)
- `src/todos/tree.ts`: the item tree as pure functions (add, complete, rename, delete, restore, move, and the completion rule)
- `src/todos/storage.ts`, `src/todos/store.ts`: saving, loading (repairs damaged data), Undo, messages, syncing between tabs
- `src/components/dnd.ts`: drag-and-drop rules that keep an item in its own list
- `src/components/TodoItem.tsx`, `TodoList.tsx`, `TodoTree.tsx`: the ranked rows on an item's page
- `src/App.css`: mobile-first styles (phone layout first, wider screens below `@media (min-width: 640px)`)
- `public/manifest.webmanifest`, `public/sw.js`: home-screen install and offline support
