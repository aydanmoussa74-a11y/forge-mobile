# Forge Mobile

Phone-first local workspace. GitHub is the source of truth for this repo. The PWA workspace on a device is IndexedDB, not a second copy of git history.

## Stack (locked)

- Vanilla HTML, CSS, ES modules
- No bundler, no npm install required to run
- GitHub Pages for the live PWA
- naija-devkit is a separate product. Do not edit it from this repo.

## Layout

- `index.html` — workshop floor (desk, case, proof, galley)
- `js/commands.js` — command parser
- `js/tools.js` — tool bus
- `js/planner.js` / `js/loop.js` / `js/model.js` — agent loop
- `js/fs.js` — project file tools
- `js/preview.js` — sandboxed HTML preview
- `js/sandbox.js` — 3s JS worker
- `tests/run.mjs` — planner / parser / redact seams

## Rules

- Do not put API keys, tokens, or `.env` values in files
- Model key stays in IndexedDB; UI shows last4 only
- Working branch for later agent work: `forge/<slug>`
- Never force-push `main`
- Family-safe product surface

## Current milestone

Shipped: 0–4 (shell, chat+files+preview, tool bus + virtual terminal, planner + optional model).

Next: free web fetch worker (DuckDuckGo / Wikipedia proxy) if asked.
