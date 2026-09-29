import { addMessage, HELP_TEXT, listMessages, parseIntent } from "./chat.js";
import { get, getAll, now, openDb, put, uid } from "./db.js";
import {
  estimateStorage,
  exportProject,
  formatBytes,
  FsError,
  importFiles,
  listFiles,
  readFile,
  removeFile,
  requestPersist,
  writeFile
} from "./fs.js";
import { buildPreviewHtml, clearPreview, mountPreview, pickDefaultEntry } from "./preview.js";
import { $, confirmDanger, downloadJson, formatTime, readFileInput, setPane, toast } from "./ui.js";

const SEED_FILES = {
  "index.html": `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Hello preview</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <main>\n    <p class="eyebrow">Forge Mobile</p>\n    <h1>Hello from the phone workspace.</h1>\n    <p>This page lives in IndexedDB and renders in the sandboxed preview pane.</p>\n    <button id="ping" type="button">Tap me</button>\n    <p id="out" hidden></p>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>\n`,
  "styles.css": `:root { color-scheme: light; }\n* { box-sizing: border-box; }\nbody {\n  margin: 0;\n  min-height: 100vh;\n  font-family: "IBM Plex Sans", system-ui, sans-serif;\n  background: radial-gradient(1200px 400px at 10% -10%, #ffe7b8, transparent 55%), #f3ead8;\n  color: #241c12;\n}\nmain { max-width: 28rem; padding: 2.5rem 1.4rem 3rem; }\n.eyebrow { letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.7rem; color: #8a6a32; margin: 0 0 0.6rem; }\nh1 { font-size: 1.85rem; line-height: 1.15; margin: 0 0 0.8rem; }\np { margin: 0 0 1rem; color: #4a4034; }\nbutton { appearance: none; border: 0; background: #241c12; color: #f3ead8; padding: 0.7rem 1rem; border-radius: 999px; font: inherit; }\n#out { margin-top: 1rem; }\n`,
  "app.js": `const button = document.getElementById("ping");\nconst out = document.getElementById("out");\nif (button && out) {\n  button.addEventListener("click", () => {\n    out.hidden = false;\n    out.textContent = "Preview scripts are running in a sandbox. " + new Date().toLocaleTimeString();\n  });\n}\n`,
  "NOTES.md": `# hello-preview\n\nSeed project for Forge Mobile milestones 0-2.\n\n- Edit files in the Files pane\n- Open Preview to render index.html\n- Chat commands: /ls  /open index.html  /preview\n`
};

const state = {
  project: null,
  threadId: null,
  files: [],
  activePath: "index.html",
  pane: "chat",
  dirty: false
};

async function ensureSeed() {
  let projects = await getAll("projects");
  if (!projects.length) {
    const project = {
      id: uid("proj"),
      name: "hello-preview",
      slug: "hello-preview",
      createdAt: now(),
      updatedAt: now()
    };
    await put("projects", project);
    for (const [path, content] of Object.entries(SEED_FILES)) {
      await writeFile(project.id, path, content);
    }
    const thread = { id: uid("thread"), projectId: project.id, title: "Workshop", createdAt: now() };
    await put("threads", thread);
    await addMessage(
      thread.id,
      "system",
      "Welcome to Forge Mobile. Files stay on this phone. Preview runs in a sandbox. Agent tools come next."
    );
    projects = [project];
  }

  const activeId = (await get("meta", "activeProjectId"))?.value || projects[0].id;
  const project = projects.find((row) => row.id === activeId) || projects[0];
  await put("meta", { key: "activeProjectId", value: project.id });

  let threads = await getAll("threads");
  threads = threads.filter((row) => row.projectId === project.id);
  if (!threads.length) {
    const thread = { id: uid("thread"), projectId: project.id, title: "Workshop", createdAt: now() };
    await put("threads", thread);
    threads = [thread];
  }
  return { project, threadId: threads[0].id };
}

function renderMessages(messages) {
  const list = $("messages");
  list.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-card";
    empty.innerHTML = "<strong>Start the thread.</strong><p>Save a note or use /help for file commands.</p>";
    list.append(empty);
    return;
  }
  for (const message of messages) {
    const article = document.createElement("article");
    article.className = `bubble bubble-${message.role}`;
    article.innerHTML = `<p>${escapeHtml(message.text)}</p><time>${formatTime(message.createdAt)}</time>`;
    list.append(article);
  }
  list.scrollTop = list.scrollHeight;
}

function renderFiles() {
  const list = $("file-list");
  list.replaceChildren();
  for (const file of state.files) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "file-row";
    btn.classList.toggle("is-active", file.path === state.activePath);
    btn.innerHTML = `<span>${escapeHtml(file.path)}</span><em>${formatBytes(file.bytes)}</em>`;
    btn.addEventListener("click", () => openPath(file.path));
    list.append(btn);
  }
  $("file-count").textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """);
}

async function refreshFiles() {
  state.files = await listFiles(state.project.id);
  renderFiles();
  const select = $("preview-entry");
  const current = select.value;
  select.replaceChildren();
  for (const file of state.files) {
    const option = document.createElement("option");
    option.value = file.path;
    option.textContent = file.path;
    select.append(option);
  }
  if (state.files.some((file) => file.path === current)) select.value = current;
  else if (state.activePath && state.files.some((file) => file.path === state.activePath)) {
    select.value = state.activePath;
  }
}

async function openPath(path) {
  try {
    const file = await readFile(state.project.id, path);
    state.activePath = file.path;
    state.dirty = false;
    $("editor-path").value = file.path;
    $("editor").value = file.content;
    $("editor-meta").textContent = `${formatBytes(file.bytes)} · ${formatTime(file.updatedAt)}`;
    renderFiles();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function saveActive() {
  const path = $("editor-path").value.trim() || state.activePath;
  const content = $("editor").value;
  try {
    const row = await writeFile(state.project.id, path, content);
    state.activePath = row.path;
    state.dirty = false;
    $("editor-meta").textContent = `Saved · ${formatBytes(row.bytes)}`;
    await refreshFiles();
    toast(`Saved ${row.path}`);
    await touchProject();
    return row;
  } catch (error) {
    toast(error.message, "error");
    throw error;
  }
}

async function touchProject() {
  state.project.updatedAt = now();
  await put("projects", state.project);
}

async function runPreview(path) {
  const entry = path || $("preview-entry").value || (await pickDefaultEntry(state.project.id));
  if (!entry) {
    clearPreview($("preview-frame"));
    $("preview-label").textContent = "No files yet";
    return;
  }
  try {
    $("preview-entry").value = entry;
    $("preview-label").textContent = entry;
    const payload = await buildPreviewHtml(state.project.id, entry);
    mountPreview($("preview-frame"), payload);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function refreshStorage() {
  const estimate = await estimateStorage();
  const used = formatBytes(estimate.usage);
  const quota = formatBytes(estimate.quota);
  $("storage-pill").textContent = estimate.quota ? `${used} / ${quota}` : used;
  $("storage-pill").title = estimate.persist ? "Persistent storage granted" : "Storage may be evicted on Android";
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const input = $("composer-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await addMessage(state.threadId, "user", text);
  const intent = parseIntent(text);
  let reply = "Saved to the thread.";
  try {
    if (intent.type === "help") reply = HELP_TEXT;
    else if (intent.type === "list") {
      await refreshFiles();
      reply = state.files.length ? state.files.map((file) => `• ${file.path}`).join("\n") : "No files in this project.";
    } else if (intent.type === "open") {
      await openPath(intent.path);
      setPane("files");
      reply = `Opened ${intent.path}.`;
    } else if (intent.type === "write") {
      const content = intent.content || "";
      await writeFile(state.project.id, intent.path, content);
      await refreshFiles();
      await openPath(intent.path);
      setPane("files");
      reply = content ? `Wrote ${intent.path}.` : `Created empty ${intent.path}.`;
    } else if (intent.type === "preview") {
      const path = intent.path || (await pickDefaultEntry(state.project.id));
      setPane("preview");
      await runPreview(path);
      reply = path ? `Previewing ${path}.` : "Nothing to preview yet.";
    } else if (intent.type === "note") {
      reply = "Noted. Use /help for file commands. The agent loop is not in this milestone.";
    }
  } catch (error) {
    reply = error instanceof FsError ? error.message : `Could not run that: ${error.message}`;
  }
  await addMessage(state.threadId, "assistant", reply);
  renderMessages(await listMessages(state.threadId));
}

function bind() {
  document.querySelectorAll("[data-pane-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.pane = btn.dataset.paneBtn;
      setPane(state.pane);
      if (state.pane === "preview") runPreview();
    });
  });
  $("composer").addEventListener("submit", handleChatSubmit);
  $("composer-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("composer").requestSubmit();
    }
  });
  $("save-file").addEventListener("click", () => saveActive().catch(() => {}));
  $("editor").addEventListener("input", () => {
    state.dirty = true;
    $("editor-meta").textContent = "Unsaved";
  });
  $("new-file").addEventListener("click", async () => {
    const path = window.prompt("New file path", "notes.txt");
    if (!path) return;
    try {
      await writeFile(state.project.id, path, "");
      await refreshFiles();
      await openPath(path);
    } catch (error) {
      toast(error.message, "error");
    }
  });
  $("delete-file").addEventListener("click", async () => {
    const path = state.activePath;
    if (!path) return;
    if (!confirmDanger(`Delete ${path}? This cannot be undone.`)) return;
    try {
      await removeFile(state.project.id, path);
      state.activePath = state.files.find((file) => file.path !== path)?.path || "";
      await refreshFiles();
      if (state.activePath) await openPath(state.activePath);
      else {
        $("editor").value = "";
        $("editor-path").value = "";
        $("editor-meta").textContent = "No file";
      }
      toast(`Deleted ${path}`);
    } catch (error) {
      toast(error.message, "error");
    }
  });
  $("preview-run").addEventListener("click", () => runPreview());
  $("preview-reload").addEventListener("click", () => runPreview($("preview-entry").value));
  $("preview-entry").addEventListener("change", () => runPreview($("preview-entry").value));
  $("export-backup").addEventListener("click", async () => {
    const bundle = await exportProject(state.project.id, state.project);
    downloadJson(`${state.project.slug}-backup.json`, bundle);
  });
  $("import-backup").addEventListener("click", () => $("import-input").click());
  $("import-input").addEventListener("change", async (event) => {
    try {
      const text = await readFileInput(event.target);
      const bundle = JSON.parse(text);
      const written = await importFiles(state.project.id, bundle);
      await refreshFiles();
      toast(`Imported ${written.length} files`);
      if (written[0]) await openPath(written[0].path);
    } catch (error) {
      toast(error.message || "Import failed", "error");
    } finally {
      event.target.value = "";
    }
  });
  $("persist-btn").addEventListener("click", async () => {
    const ok = await requestPersist();
    toast(ok ? "Browser granted persistent storage." : "Persist was not granted. Export backups often.");
    await refreshStorage();
  });
  window.addEventListener("beforeunload", (event) => {
    if (state.dirty) event.preventDefault();
  });
}

export async function start() {
  await openDb();
  const seeded = await ensureSeed();
  state.project = seeded.project;
  state.threadId = seeded.threadId;
  $("project-name").textContent = state.project.name;
  bind();
  setPane("chat");
  renderMessages(await listMessages(state.threadId));
  await refreshFiles();
  if (state.files.some((file) => file.path === "index.html")) await openPath("index.html");
  else if (state.files[0]) await openPath(state.files[0].path);
  await refreshStorage();
  $("app").classList.remove("is-booting");
}
