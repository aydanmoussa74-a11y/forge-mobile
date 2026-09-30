import { addMessage, listMessages } from "./chat.js";
import { get, getAll, now, openDb, put, uid } from "./db.js";
import {
  estimateStorage,
  exportProject,
  formatBytes,
  importFiles,
  listFiles,
  readFile,
  removeFile,
  requestPersist,
  writeFile
} from "./fs.js";
import { runTurn } from "./loop.js";
import { clearModelKey, loadModelSettings, saveModelSettings } from "./model.js";
import { buildPreviewHtml, clearPreview, mountPreview, pickDefaultEntry } from "./preview.js";
import { SEED_FILES } from "./seed.js";
import { parseCommandLine, runTool } from "./tools.js";
import { $, confirmDanger, downloadJson, formatTime, readFileInput, setBusy, setPane, toast } from "./ui.js";

const state = {
  project: null,
  threadId: null,
  files: [],
  activePath: "index.html",
  dirty: false,
  termHistory: [],
  termCursor: -1,
  ticket: []
};

async function ensureSeed() {
  let projects = await getAll("projects");
  if (!projects.length) {
    const project = { id: uid("proj"), name: "hello-preview", slug: "hello-preview", createdAt: now(), updatedAt: now() };
    await put("projects", project);
    for (const [path, content] of Object.entries(SEED_FILES)) await writeFile(project.id, path, content);
    const thread = { id: uid("thread"), projectId: project.id, title: "Workshop", createdAt: now() };
    await put("threads", thread);
    await addMessage(thread.id, "system", "Press is open. Planner writes files. Term runs ls, cat, write, edit, js, preview.");
    projects = [project];
  }
  const activeId = (await get("meta", "activeProjectId"))?.value || projects[0].id;
  const project = projects.find((row) => row.id === activeId) || projects[0];
  await put("meta", { key: "activeProjectId", value: project.id });
  let threads = (await getAll("threads")).filter((row) => row.projectId === project.id);
  if (!threads.length) {
    const thread = { id: uid("thread"), projectId: project.id, title: "Workshop", createdAt: now() };
    await put("threads", thread);
    threads = [thread];
  }
  return { project, threadId: threads[0].id };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """);
}

function renderMessages(messages) {
  const list = $("messages");
  list.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-card";
    empty.innerHTML = "<strong>Give the press a job.</strong><p>Try “build a tap counter page” or type ls in Term.</p>";
    list.append(empty);
    return;
  }
  for (const message of messages) {
    const article = document.createElement("article");
    article.className = `slip slip-${message.role}`;
    article.innerHTML = `<span class="slip-role">${escapeHtml(message.role)}</span><p>${escapeHtml(message.text)}</p><time>${formatTime(message.createdAt)}</time>`;
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

function renderReceipt(results, running) {
  const sheet = $("tool-sheet");
  const rows = results && results.length ? results : state.ticket;
  if (!rows.length && !running) {
    sheet.hidden = true;
    sheet.replaceChildren();
    return;
  }
  sheet.hidden = false;
  const body = rows.map((row) => {
    const line = escapeHtml(String(row.summary || row.tool || "").split("\n")[0]);
    const name = escapeHtml(row.name || row.tool || "tool");
    const mark = row.pending ? "…" : row.ok === false ? "fail" : "ok";
    return `<div class="row ${row.ok === false ? "fail" : ""} ${row.pending ? "pending" : ""}"><span>${name}</span><span>${line || mark}</span></div>`;
  }).join("");
  sheet.innerHTML = `<b>${running ? "Job in press" : "Tool ticket"}</b>${body}`;
}

function appendTerm(line) {
  const log = $("term-log");
  log.textContent += `${line}\n`;
  log.scrollTop = log.scrollHeight;
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
  else if (state.activePath && state.files.some((file) => file.path === state.activePath)) select.value = state.activePath;
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
  const row = await writeFile(state.project.id, path, $("editor").value);
  state.activePath = row.path;
  state.dirty = false;
  $("editor-meta").textContent = `Saved · ${formatBytes(row.bytes)}`;
  await refreshFiles();
  toast(`Saved ${row.path}`);
}

async function runPreview(path) {
  const entry = path || $("preview-entry").value || (await pickDefaultEntry(state.project.id));
  if (!entry) {
    clearPreview($("preview-frame"));
    $("preview-label").textContent = "No files yet";
    return;
  }
  $("preview-entry").value = entry;
  $("preview-label").textContent = entry;
  mountPreview($("preview-frame"), await buildPreviewHtml(state.project.id, entry));
}

function toolCtx() {
  return {
    projectId: state.project.id,
    projectName: state.project.name,
    files: state.files,
    iframe: $("preview-frame"),
    onFilesChanged: refreshFiles,
    onOpenPath: openPath,
    onClearTerm: () => { $("term-log").textContent = ""; },
    onPreview: async (path) => {
      setPane("preview");
      $("preview-entry").value = path;
      $("preview-label").textContent = path;
    },
    onToolStart: (step) => {
      state.ticket.push({ name: step.tool, tool: step.tool, pending: true, summary: "running" });
      renderReceipt(state.ticket, true);
    },
    onToolDone: (result) => {
      const last = state.ticket.find((row) => row.pending && row.name === result.name) || state.ticket[state.ticket.length - 1];
      if (last) Object.assign(last, result, { pending: false });
      renderReceipt(state.ticket, true);
    }
  };
}

async function refreshStorage() {
  const estimate = await estimateStorage();
  $("storage-pill").textContent = estimate.quota
    ? `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}`
    : formatBytes(estimate.usage);
}

async function refreshModelStamp() {
  const settings = await loadModelSettings();
  $("model-stamp").textContent = settings.hasKey ? "MODEL+PLAN" : "PLANNER";
  $("model-url").value = settings.baseUrl;
  $("model-name").value = settings.model;
  $("model-last4").textContent = settings.last4 ? `Key ending ${settings.last4}` : "No key stored.";
}

async function handlePrompt(text) {
  setBusy(true);
  state.ticket = [];
  try {
    await addMessage(state.threadId, "user", text);
    renderMessages(await listMessages(state.threadId));
    const turn = await runTurn(text, toolCtx());
    renderReceipt(turn.results);
    const body = [turn.note, ...turn.results.map((row) => row.summary)].filter(Boolean).join("\n\n");
    await addMessage(state.threadId, "assistant", body);
    renderMessages(await listMessages(state.threadId));
    if (turn.results.some((row) => row.name === "preview" && row.ok)) setPane("preview");
  } catch (error) {
    toast(error.message || "Turn failed", "error");
  } finally {
    setBusy(false);
  }
}

function bind() {
  document.querySelectorAll("[data-pane-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setPane(btn.dataset.paneBtn);
      if (btn.dataset.paneBtn === "preview") runPreview();
    });
  });
  document.querySelectorAll("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => handlePrompt(btn.dataset.chip));
  });
  $("composer").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = $("composer-input").value.trim();
    if (!text) return;
    $("composer-input").value = "";
    await handlePrompt(text);
  });
  $("composer-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("composer").requestSubmit();
    }
  });
  $("save-file").addEventListener("click", () => saveActive().catch((error) => toast(error.message, "error")));
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
    if (!path || !confirmDanger(`Delete ${path}?`)) return;
    await removeFile(state.project.id, path);
    state.activePath = state.files.find((file) => file.path !== path)?.path || "";
    await refreshFiles();
    if (state.activePath) await openPath(state.activePath);
    else {
      $("editor").value = "";
      $("editor-path").value = "";
    }
  });
  $("preview-run").addEventListener("click", () => runPreview());
  $("preview-reload").addEventListener("click", () => runPreview($("preview-entry").value));
  $("preview-entry").addEventListener("change", () => runPreview($("preview-entry").value));
  $("export-backup").addEventListener("click", async () => {
    downloadJson(`${state.project.slug}-backup.json`, await exportProject(state.project.id, state.project));
  });
  $("import-backup").addEventListener("click", () => $("import-input").click());
  $("import-input").addEventListener("change", async (event) => {
    try {
      const written = await importFiles(state.project.id, JSON.parse(await readFileInput(event.target)));
      await refreshFiles();
      toast(`Imported ${written.length} files`);
    } catch (error) {
      toast(error.message || "Import failed", "error");
    } finally {
      event.target.value = "";
    }
  });
  $("persist-btn").addEventListener("click", async () => {
    const ok = await requestPersist();
    toast(ok ? "Persistent storage granted." : "Persist was not granted. Export often.");
    await refreshStorage();
  });
  $("term-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const line = $("term-input").value.trim();
    if (!line) return;
    $("term-input").value = "";
    state.termHistory.push(line);
    state.termCursor = state.termHistory.length;
    appendTerm(`forge> ${line}`);
    const parsed = parseCommandLine(line) || { name: "help", args: {} };
    const result = await runTool(parsed.name, parsed.args, toolCtx());
    appendTerm(result.summary || result.error || "");
    renderReceipt([result]);
  });
  $("term-input").addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!state.termHistory.length) return;
      state.termCursor = Math.max(0, state.termCursor - 1);
      $("term-input").value = state.termHistory[state.termCursor] || "";
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.termCursor = Math.min(state.termHistory.length, state.termCursor + 1);
      $("term-input").value = state.termHistory[state.termCursor] || "";
    }
  });
  $("settings-btn").addEventListener("click", () => $("settings").showModal());
  $("model-save").addEventListener("click", async (event) => {
    event.preventDefault();
    await saveModelSettings({
      baseUrl: $("model-url").value,
      model: $("model-name").value,
      key: $("model-key").value
    });
    $("model-key").value = "";
    await refreshModelStamp();
    $("settings").close();
    toast("Model settings saved.");
  });
  $("model-clear").addEventListener("click", async () => {
    await clearModelKey();
    await refreshModelStamp();
    toast("Key cleared.");
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
  $("job-no").textContent = `JOB ${state.project.slug}`;
  bind();
  setPane("chat");
  renderMessages(await listMessages(state.threadId));
  await refreshFiles();
  if (state.files.some((file) => file.path === "index.html")) await openPath("index.html");
  else if (state.files[0]) await openPath(state.files[0].path);
  appendTerm("Forge virtual terminal. Type help.");
  await refreshStorage();
  await refreshModelStamp();
  $("app").classList.remove("is-booting");
}
