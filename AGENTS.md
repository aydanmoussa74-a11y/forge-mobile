# Forge Mobile

Phone-first local workspace. GitHub is the source of truth for this repo. The PWA workspace on a device is IndexedDB, not a second copy of git history.

## Stack (locked)

- Vanilla HTML, CSS, ES modules
- No bundler, no npm install required to run
- GitHub Pages for the live PWA
- naija-devkit is a separate product. Do not edit it from this repo.

## Layout

- `index.html` — chat-first PWA shell
- `js/db.js` — IndexedDB
- `js/fs.js` — project file tools
- `js/preview.js` — sandboxed HTML preview
- `js/chat.js` — thread + command parser
- `js/app.js` — milestone 0-2 orchestration

## Rules

- Do not put API keys, tokens, or `.env` values in files
- Working branch for later agent work: `forge/<slug>`
- Never force-push `main`
- One coherent slice per turn
- Family-safe product surface

## Current milestone

Shipped: 0 repo oxygen, 1 chat + project record, 2 filesystem + live preview.

Next: tool bus + virtual terminal, then model adapter, then free web fetch worker.
