# Architecture (Milestones 0-2)

## Surfaces

- PWA shell on GitHub Pages
- Project + thread + messages in IndexedDB
- File bodies in IndexedDB (`files` store)
- Preview via `iframe srcdoc` with `sandbox` (scripts allowed, not same-origin)

## Data

- `projects` — one seed project `hello-preview`
- `threads` / `messages` — chat notes and command results
- `files` — `{id, projectId, path, content, bytes, updatedAt}`
- `meta.activeProjectId`

Path rules: no `..`, no absolute paths, conservative filename charset.

## Preview

HTML files may reference project-relative `styles.css` / `app.js`. Those siblings become blob URLs before `srcdoc` assignment. Blob URLs are revoked on the next preview.

## Offline

`sw.js` caches the shell only. File data is not in the service worker cache. The agent is not claimed to work offline.

## Out of this slice

Model calls, web search, GitHub commits from inside the PWA, virtual terminal exec beyond preview scripts.
