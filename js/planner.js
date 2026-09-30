import { parseCommandLine } from "./commands.js";

function htmlPage(title, body, withScript = true) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main>
    ${body}
  </main>${withScript ? `\n  <script src="app.js"></script>` : ""}
</body>
</html>
`;
}

function defaultCss() {
  return `* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  background: #efe6d4;
  color: #1a1209;
}
main { max-width: 36rem; padding: 2rem 1.25rem 3rem; }
h1 { font-size: 2rem; line-height: 1.1; margin: 0 0 0.75rem; }
p { margin: 0 0 1rem; }
button, a.btn {
  display: inline-block;
  border: 1px solid #1a1209;
  background: #1a1209;
  color: #efe6d4;
  padding: 0.65rem 0.9rem;
  font: inherit;
  text-decoration: none;
}
.kicker { letter-spacing: 0.18em; text-transform: uppercase; font-size: 0.72rem; }
`;
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">");
}

export function titleFrom(text) {
  const cleaned = String(text || "")
    .replace(/^(build|make|create|write|add)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 64) || "Forge page";
}

export function fileFromIdea(path, idea) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".html")) {
    return htmlPage(idea.slice(0, 48), `<h1>${esc(idea)}</h1>\n    <p>Written by the Forge planner on this phone.</p>`);
  }
  if (lower.endsWith(".css")) return defaultCss();
  if (lower.endsWith(".js")) return `console.log(${JSON.stringify(idea)});\n`;
  if (lower.endsWith(".json")) return `${JSON.stringify({ note: idea }, null, 2)}\n`;
  return `${idea}\n`;
}

export function planTurn(text, files = []) {
  const raw = String(text || "").trim();
  if (!raw) return { mode: "empty", steps: [], note: "Empty message." };

  const named = raw.match(/^(?:create|make|write)\s+(?:an?\s+)?(\S+\.(?:html|css|js|md|txt|json))\s+(?:that\s+)?(?:says|with|containing)\s+([\s\S]+)$/i);
  if (named) {
    return {
      mode: "write",
      steps: [{ tool: "write", args: { path: named[1], content: fileFromIdea(named[1], named[2]) } }],
      note: `Write ${named[1]}`
    };
  }

  const command = parseCommandLine(raw);
  if (command) return { mode: "term", steps: [{ tool: command.name, args: command.args }], note: `Command ${command.name}` };

  if (/preview|show\s+it|open\s+preview/i.test(raw) && !/build|create|make/i.test(raw)) {
    return { mode: "preview", steps: [{ tool: "preview", args: { path: null } }], note: "Preview" };
  }
  if (/^(list|show)\s+files\b|^what files/i.test(raw)) {
    return { mode: "ls", steps: [{ tool: "ls", args: {} }], note: "List files" };
  }
  if (/\brun\b.*\.(js|mjs)\b/i.test(raw) || /^run\s+js/i.test(raw)) {
    const path = (raw.match(/(\S+\.js)/i) || [])[1] || "app.js";
    return { mode: "js", steps: [{ tool: "js", args: { path } }], note: `Run ${path}` };
  }
  if (/replace\s+(.+)\s+with\s+(.+)\s+in\s+(\S+)/i.test(raw)) {
    const match = raw.match(/replace\s+(.+)\s+with\s+(.+)\s+in\s+(\S+)/i);
    return {
      mode: "edit",
      steps: [{ tool: "edit", args: { path: match[3], find: match[1].trim(), replace: match[2].trim() } }],
      note: `Edit ${match[3]}`
    };
  }

  if (/counter|tap\s+me|click\s+counter/i.test(raw) && /page|html|app|build|make|create/i.test(raw)) {
    return planCounter(titleFrom(raw));
  }

  if (/landing|website|web page|homepage|site for|page that|html page|build .*page|make .*page|poster/i.test(raw)) {
    return planSite(titleFrom(raw), raw);
  }

  if (/add\s+styles?|write\s+css/i.test(raw)) {
    return { mode: "write", steps: [{ tool: "write", args: { path: "styles.css", content: defaultCss() } }], note: "Write styles.css" };
  }

  return { mode: "note", steps: [], note: raw };
}

function planSite(title, raw) {
  const heading = esc(title);
  const steps = [
    {
      tool: "write",
      args: {
        path: "index.html",
        content: htmlPage(
          title,
          `<p class="kicker">Forge Mobile</p>\n    <h1>${heading}</h1>\n    <p>${esc(raw).slice(0, 180)}</p>\n    <p>Edit this copy in the Files pane. Preview to see it live.</p>`
        )
      }
    },
    { tool: "write", args: { path: "styles.css", content: defaultCss() } },
    { tool: "write", args: { path: "app.js", content: `document.documentElement.dataset.ready = "1";\n` } },
    { tool: "preview", args: { path: "index.html" } }
  ];
  return { mode: "build", steps, note: `Build ${title}` };
}

function planCounter(title) {
  return {
    mode: "build",
    steps: [
      {
        tool: "write",
        args: {
          path: "index.html",
          content: htmlPage(title, `<h1>${esc(title)}</h1>\n    <p>Sandbox scripts can count taps.</p>\n    <button id="n" type="button">0</button>`)
        }
      },
      { tool: "write", args: { path: "styles.css", content: defaultCss() } },
      {
        tool: "write",
        args: {
          path: "app.js",
          content: `let n = 0;\nconst btn = document.getElementById("n");\nif (btn) btn.addEventListener("click", () => { n += 1; btn.textContent = String(n); });\n`
        }
      },
      { tool: "preview", args: { path: "index.html" } }
    ],
    note: "Build counter page"
  };
}

export const SYSTEM_PROMPT = `You are the Forge Mobile planner on a phone PWA.
You may only use these tools: ls, cat, write, edit, rm, js, preview, memory, help.
Prefer one coherent unit of work.
Do not ask for secrets. Do not invent Linux commands.
When building a page, write index.html, styles.css, app.js, then preview.
Return JSON only: {"steps":[{"tool":"write","args":{"path":"index.html","content":"..."}}]}`;
