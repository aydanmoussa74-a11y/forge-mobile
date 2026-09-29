import { getByIndex, now, put, uid } from "./db.js";

export async function listMessages(threadId) {
  const rows = await getByIndex("messages", "by_thread", threadId);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addMessage(threadId, role, text, extra = {}) {
  const row = {
    id: uid("msg"),
    threadId,
    role,
    text: String(text || "").slice(0, 8000),
    createdAt: now(),
    ...extra
  };
  await put("messages", row);
  return row;
}

export function parseIntent(text) {
  const raw = String(text || "").trim();
  if (!raw) return { type: "empty" };

  const create = raw.match(/^\/(?:new|create|touch)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (create) return { type: "write", path: create[1], content: create[2] ?? "" };

  const open = raw.match(/^\/(?:open|edit)\s+(\S+)$/i);
  if (open) return { type: "open", path: open[1] };

  const preview = raw.match(/^\/preview(?:\s+(\S+))?$/i);
  if (preview) return { type: "preview", path: preview[1] || null };

  const list = raw.match(/^\/(?:ls|files)$/i);
  if (list) return { type: "list" };

  const help = raw.match(/^\/(?:help|commands)$/i);
  if (help) return { type: "help" };

  const named = raw.match(/^(?:create|make|write)\s+(?:an?\s+)?(\S+\.(?:html|css|js|md|txt|json))\s+(?:that\s+)?(?:says|with|containing)\s+([\s\S]+)$/i);
  if (named) return { type: "write", path: named[1], content: guessContent(named[1], named[2]) };

  return { type: "note", text: raw };
}

function guessContent(path, idea) {
  const lower = path.toLowerCase();
  const safe = idea.trim();
  if (lower.endsWith(".html")) {
    return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${escapeText(safe).slice(0, 48)}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <main>\n    <h1>${escapeText(safe)}</h1>\n    <p>Built on a phone in Forge Mobile.</p>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>\n`;
  }
  if (lower.endsWith(".css")) {
    return `body { font-family: system-ui, sans-serif; margin: 0; background: #f4efe6; color: #1b1914; }\nmain { padding: 24px; }\nh1 { font-size: 1.6rem; }\n`;
  }
  if (lower.endsWith(".js")) {
    return `console.log(${JSON.stringify(safe)});\n`;
  }
  if (lower.endsWith(".json")) {
    return `${JSON.stringify({ note: safe }, null, 2)}\n`;
  }
  return `${safe}\n`;
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const HELP_TEXT = [
  "This slice is chat + files + preview. The coding agent arrives in a later milestone.",
  "Commands:",
  "/new path [text] — create or replace a file",
  "/open path — edit a file",
  "/preview [path] — render HTML",
  "/ls — list project files",
  "Or: create index.html that says hello from Lagos"
].join("\n");
