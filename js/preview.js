import { extOf, listFiles, readFile } from "./fs.js";

const MIME = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  json: "application/json",
  md: "text/markdown",
  txt: "text/plain",
  svg: "image/svg+xml"
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapDocument(title, bodyHtml) {
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${escapeHtml(title)}</title>\n  <style>\n    body { margin: 0; font: 16px/1.45 system-ui, sans-serif; color: #1b1914; background: #f4efe6; }\n    main { padding: 24px; max-width: 720px; }\n    pre { white-space: pre-wrap; word-break: break-word; }\n  </style>\n</head>\n<body><main>${bodyHtml}</main></body>\n</html>`;
}

function rewriteRelative(html, resolveUrl) {
  return html.replace(
    /(src|href)\s*=\s*(['"])(?!https?:|data:|blob:|\/\/|#|mailto:)([^'"]+)\2/gi,
    (_all, attr, quote, ref) => `${attr}=${quote}${resolveUrl(ref)}${quote}`
  );
}

export async function buildPreviewHtml(projectId, entryPath) {
  const entry = await readFile(projectId, entryPath);
  const ext = extOf(entry.path);

  if (ext === "md" || ext === "txt") {
    return wrapDocument(entry.path, `<pre>${escapeHtml(entry.content)}</pre>`);
  }
  if (ext === "json") {
    let pretty = entry.content;
    try { pretty = JSON.stringify(JSON.parse(entry.content), null, 2); } catch {}
    return wrapDocument(entry.path, `<pre>${escapeHtml(pretty)}</pre>`);
  }
  if (ext !== "html" && ext !== "htm") {
    return wrapDocument(entry.path, `<p>No live preview for <code>${escapeHtml(entry.path)}</code>.</p><pre>${escapeHtml(entry.content)}</pre>`);
  }

  const files = await listFiles(projectId);
  const blobUrls = new Map();
  const revoke = [];

  for (const file of files) {
    const mime = MIME[extOf(file.path)] || "text/plain";
    const blob = new Blob([file.content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    blobUrls.set(file.path, url);
    revoke.push(url);
  }

  const resolveUrl = (ref) => {
    const cleaned = ref.replace(/^\.\//, "").replace(/^\//, "");
    return blobUrls.get(cleaned) || blobUrls.get(ref) || ref;
  };

  const html = rewriteRelative(entry.content, resolveUrl);
  return { html, revoke };
}

export function mountPreview(iframe, payload) {
  const previous = iframe.dataset.revoke;
  if (previous) {
    try {
      JSON.parse(previous).forEach((url) => URL.revokeObjectURL(url));
    } catch {}
  }

  const html = typeof payload === "string" ? payload : payload.html;
  const revoke = typeof payload === "string" ? [] : payload.revoke || [];
  iframe.dataset.revoke = JSON.stringify(revoke);
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-modals allow-popups-to-escape-sandbox"
  );
  iframe.srcdoc = html;
}

export function clearPreview(iframe) {
  const previous = iframe.dataset.revoke;
  if (previous) {
    try {
      JSON.parse(previous).forEach((url) => URL.revokeObjectURL(url));
    } catch {}
  }
  iframe.dataset.revoke = "[]";
  iframe.srcdoc = wrapDocument("Preview", "<p>Choose an HTML file to preview.</p>");
}

export async function pickDefaultEntry(projectId) {
  const files = await listFiles(projectId);
  const preferred = ["index.html", "index.htm", "preview.html", "app.html"];
  for (const name of preferred) {
    if (files.some((file) => file.path === name)) return name;
  }
  const html = files.find((file) => extOf(file.path) === "html" || extOf(file.path) === "htm");
  return html ? html.path : files[0]?.path || null;
}
