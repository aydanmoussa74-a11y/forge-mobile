# Forge Mobile

Local-first AI agent workspace that runs as a phone PWA. This repository is the product. Files you create in the app stay on the device until you export them.

`naija-devkit` is a separate repo and was not modified.

## Live app

https://aydanmoussa74-a11y.github.io/forge-mobile/

If that 404s, open the repo on GitHub mobile → Settings → Pages:

1. Source: Deploy from a branch
2. Branch: `main` / root
3. Save, wait about a minute, refresh

Or source: GitHub Actions (the `pages` workflow is already in the repo).

## What works now (Milestones 0–2)

- Installable PWA shell
- Chat thread persisted in IndexedDB
- On-device project filesystem
- Sandboxed live HTML preview
- Export / import JSON backup
- Seed project `hello-preview`

Not in this slice: model calls, paid search APIs, a real Linux terminal.

## Phone use

1. Open the live URL in Chrome
2. Install from the browser menu
3. Chat holds notes and commands
4. Files edits the local project
5. Preview runs `index.html`

Commands:

```text
/help
/ls
/open index.html
/preview
/new notes.txt hello
create demo.html that says hello from Lagos
```

## License

MIT
