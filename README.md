# Forge Mobile

Local-first AI agent workspace that runs as a phone PWA. This repository is the product. Files you create in the app stay on the device until you export them or later connect GitHub from inside the app.

`naija-devkit` is a separate repo and is not modified here.

## Live app

https://aydanmoussa74-a11y.github.io/forge-mobile/

If that 404s, enable GitHub Pages on this repo: Settings → Pages → Deploy from GitHub Actions. Then wait a minute.

## What works now (Milestones 0–4)

- Installable PWA workshop (desk / case / proof / galley)
- Chat tickets persisted in IndexedDB
- On-device project filesystem
- Virtual terminal: `ls`, `cat`, `write`, `edit`, `rm`, `js`, `preview`, `help`
- Deterministic planner for multi-file jobs (poster, counter, site)
- Optional OpenAI-compatible model key stored on-device (last4 only in UI)
- Sandboxed live HTML preview
- Export / import JSON backup
- Seed project `hello-preview`

Not in this slice: paid search APIs, virtual Linux, writing naija-devkit.

## Use on a phone

1. Open the live URL
2. Install the app from the browser menu
3. Desk holds jobs and tool tickets
4. Case edits the local project
5. Proof runs `index.html`
6. Galley is the virtual terminal

Useful commands:

```text
help
ls
cat index.html
write notes.txt hello
edit notes.txt hello => hello from Lagos
preview
js app.js
create demo.html that says hello from Lagos
build a tap counter page
```

## Tests

```text
node tests/run.mjs
```

## Why this stack

No laptop and no Termux means no build pipeline. The app is static ES modules so GitHub Pages can host it and Chrome on Android can install it.

## License

MIT
