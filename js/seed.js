export const SEED_FILES = {
  "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hello preview</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main>
    <p class="kicker">Forge press</p>
    <h1>Hello from the phone workspace.</h1>
    <p>This page lives on-device and renders in the preview frame.</p>
    <button id="ping" type="button">Tap me</button>
    <p id="out" hidden></p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
  "styles.css": `body { margin: 0; font-family: Georgia, serif; background: #efe6d4; color: #1a1209; }
main { max-width: 28rem; padding: 2.5rem 1.3rem; }
.kicker { letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.7rem; }
button { border: 1px solid #1a1209; background: #1a1209; color: #efe6d4; padding: 0.7rem 1rem; font: inherit; }
`,
  "app.js": `const button = document.getElementById("ping");
const out = document.getElementById("out");
if (button && out) {
  button.addEventListener("click", () => {
    out.hidden = false;
    out.textContent = "Sandbox scripts are running. " + new Date().toLocaleTimeString();
  });
}
`,
  "NOTES.md": `# hello-preview\n\nMilestones 3-4: tool bus + planner + optional model.\nCommands: ls, cat, write, edit, js, preview.\n`
};
