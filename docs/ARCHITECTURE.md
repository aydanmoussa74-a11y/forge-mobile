# Architecture (Milestones 0-4)

## Surfaces

- PWA shell on GitHub Pages
- Project + thread + messages in IndexedDB
- File bodies in IndexedDB (`files` store)
- Preview via `iframe srcdoc` with `sandbox`
- Virtual terminal command parser (`js/commands.js`) + tool bus (`js/tools.js`)
- Planner first; optional OpenAI-compatible model if a key is stored on-device

## Data

- `projects` — one seed project `hello-preview`
- `threads` / `messages` — chat tickets (secrets redacted before write)
- `files` — `{id, projectId, path, content, bytes, updatedAt}`
- `memories` — last_turn checkpoint
- `meta.activeProjectId`, `meta.model_settings`, `meta.model_key`

Path rules: no `..`, no absolute paths, conservative filename charset.

## Loop

1. Parse as a terminal command, or plan from English
2. If the planner has no steps and a model key exists, ask the model for JSON steps
3. Run at most 6 tools
4. Write last_turn memory
5. Show a paper ticket of tool results

## Preview

HTML files may reference project-relative `styles.css` / `app.js`. Those siblings become blob URLs before `srcdoc` assignment.

## Offline

`sw.js` caches the shell only. File data is not in the service worker cache. The agent is not claimed to work offline.
