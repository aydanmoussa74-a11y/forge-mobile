import { parseCommandLine } from "./tools.js";

function htmlPage(title, body, withScript = true) {
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${esc(title)}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <main>\n    ${body}\n  </main>${withScript ? `\n  <script src="app.js"></script>` : ""}\n</body>\n</html>\n`;
}

function defaultCss() {
  return `* { box-sizing: border-box; }\nbody { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #efe6d4; color: #1a1209; }\nmain { max-width: 36rem; padding: 2rem 1.25rem 3rem; }\nh1 { font-size: 2rem; line-height: 1.1; margin: 0 0 0.75rem; }\np { margin: 0 0 1rem; }\nbutton, a.btn { display: inline-block; border: 1px solid #1a1209; background: #1a1209; color: #efe6d4; padding: 0.65rem 0.9rem; font: inherit; text-decoration: none; }\n`;
}

function esc(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function titleFrom(text) {
  const cleaned = String(text || "").replace(/^(build|make|create|write|add)\s+/i, "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 64) || "Forge page";
}

export function planTurn(text, files = []) {
  const raw = String(text || "").trim();
  if (!raw) return { mode: "empty", steps: [], note: "Empty message." };
  const command = parseCommandLine(raw);
  if (command) return { mode: "term", steps: [{ tool: command.name, args: command.args }], note: `Command ${command.name}` };
  const named = raw.match(/^(?:create|make|write)\s+(?:an?\s+)?(\S+\.(?:html|css|js|md|txt|json))\s+(?:that\s+)?(?:says|with|containing)\s+([\s\S]+)$/i);
  if (named) {
    return { mode: "write", steps: [{ tool: "write", args: { path: named[1], content: fileFromIdea(named[1], named[2]) } }], note: `Write ${named[1]}` };
  }
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
  if (/counter|tap\s+me|button/i.test(raw) && /page|html|app|build|make|create/i.test(raw)) {
    return planCounter(titleFrom(raw));
  }
  if (/landing|website|web page|homepage|site for|page that|html page|build .*page/i.test(raw)) {
    return planSite(titleFrom(raw), raw);
  }
  if (/add\s+styles?|write\s+css/i.test(raw)) {
    return { mode: "write", steps: [{ tool: "write", args: { path: "styles.css", content: defaultCss() } }], note: "Write styles.css" };
  }
  return { mode: "note", steps: [], note: raw };
}

function fileFromIdea(path, idea) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".html")) return htmlPage(idea.slice(0, 48), `<h1>${esc(idea)}</h1>\n    <p>Written by the Forge planner on this phone.</p>`);
  if (lower.endsWith(".css")) return defaultCss();
  if (lower.endsWith(".js")) return `console.log(${JSON.stringify(idea)});\n`;
  if (lower.endsWith(".json")) return `${JSON.stringify({ note: idea }, null, 2)}\n`;
  return `${idea}\n`;
}

function planSite(title, raw) {
  const heading = esc(title);
  return {
    mode: "build",
    note: `Build ${title}`,
    steps: [
      { tool: "write", args: { path: "index.html", content: htmlPage(title, `<p class="kicker">Forge Mobile</p>\n    <h1>${heading}</h1>\n    <p>${esc(raw).slice(0, 180)}</p>\n    <p>Edit this copy in the Files pane. Preview to see it live.</p>`) } },
      { tool: "write", args: { path: "styles.css", content: defaultCss() + `.kicker { letter-spacing: 0.18em; text-transform: uppercase; font-size: 0.72rem; }\n` } },
      { tool: "write", args: { path: "app.js", content: `document.documentElement.dataset.ready = "1";\n` } },
      { tool: "preview", args: { path: "index.html" } }
    ]
  };
}

function planCounter(title) {
  return {
    mode: "build",
    note: "Build counter page",
    steps: [
      { tool: "write", args: { path: "index.html", content: htmlPage(title, `<h1>${esc(title)}</h1>\n    <p>Sandbox scripts can count taps.</p>\n    <button id="n" type="button">0</button>`) } },
      { tool: "write", args: { path: "styles.css", content: defaultCss() } },
      { tool: "write", args: { path: "app.js", content: `let n = 0;\nconst btn = document.getElementById("n");\nif (btn) btn.addEventListener("click", () => { n += 1; btn.textContent = String(n); });\n` } },
      { tool: "preview", args: { path: "index.html" } }
    ]
  };
}

export const SYSTEM_PROMPT = `You are the Forge Mobile planner on a phone PWA.\nYou may only use these tools: ls, cat, write, rm, js, preview.\nPrefer one coherent unit of work.\nDo not ask for secrets. Do not invent Linux commands.\nWhen building a page, write index.html, styles.css, then preview.\nReturn either tool calls or a short plan.`;
