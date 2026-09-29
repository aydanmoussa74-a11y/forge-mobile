import { del, getByIndex, now, put } from "./db.js";

const MAX_FILE_BYTES = 400_000;
const FORBIDDEN = new Set(["", ".", ".."]);

export class FsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FsError";
    this.code = code;
  }
}

export function normalizePath(input) {
  if (typeof input !== "string") throw new FsError("bad_path", "Path must be a string.");
  let path = input.trim().replace(/\\/g, "/");
  if (path.startsWith("/")) path = path.slice(1);
  if (!path) throw new FsError("bad_path", "Path is empty.");
  const parts = [];
  for (const part of path.split("/")) {
    if (FORBIDDEN.has(part)) {
      if (part === "..") throw new FsError("bad_path", "Parent traversal is not allowed.");
      continue;
    }
    if (!/^[A-Za-z0-9._@+-]+$/.test(part)) {
      throw new FsError("bad_path", `Illegal path segment: ${part}`);
    }
    parts.push(part);
  }
  if (!parts.length) throw new FsError("bad_path", "Path is empty.");
  if (parts.join("/").length > 180) throw new FsError("bad_path", "Path is too long.");
  return parts.join("/");
}

export function fileId(projectId, path) {
  return `${projectId}:${path}`;
}

export async function listFiles(projectId) {
  const rows = await getByIndex("files", "by_project", projectId);
  return rows.slice().sort((a, b) => a.path.localeCompare(b.path));
}

export async function readFile(projectId, rawPath) {
  const path = normalizePath(rawPath);
  const rows = await getByIndex("files", "by_project_path", [projectId, path]);
  const row = rows[0];
  if (!row) throw new FsError("not_found", `${path} does not exist.`);
  return row;
}

export async function writeFile(projectId, rawPath, content) {
  const path = normalizePath(rawPath);
  if (typeof content !== "string") throw new FsError("bad_content", "File content must be text.");
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > MAX_FILE_BYTES) {
    throw new FsError("too_large", `File exceeds ${MAX_FILE_BYTES} bytes.`);
  }
  const existing = (await getByIndex("files", "by_project_path", [projectId, path]))[0];
  const row = {
    id: existing ? existing.id : fileId(projectId, path),
    projectId,
    path,
    content,
    bytes,
    updatedAt: now(),
    createdAt: existing ? existing.createdAt : now()
  };
  await put("files", row);
  return row;
}

export async function removeFile(projectId, rawPath) {
  const path = normalizePath(rawPath);
  const existing = (await getByIndex("files", "by_project_path", [projectId, path]))[0];
  if (!existing) throw new FsError("not_found", `${path} does not exist.`);
  await del("files", existing.id);
  return existing;
}

export async function renameFile(projectId, fromPath, toPath) {
  const source = await readFile(projectId, fromPath);
  const destPath = normalizePath(toPath);
  const clash = (await getByIndex("files", "by_project_path", [projectId, destPath]))[0];
  if (clash) throw new FsError("exists", `${destPath} already exists.`);
  await writeFile(projectId, destPath, source.content);
  await del("files", source.id);
  return readFile(projectId, destPath);
}

export function extOf(path) {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i + 1).toLowerCase() : "";
}

export function isPreviewable(path) {
  return ["html", "htm"].includes(extOf(path));
}

export async function exportProject(projectId, project) {
  const files = await listFiles(projectId);
  return {
    version: 1,
    exportedAt: now(),
    project: { id: project.id, name: project.name, slug: project.slug },
    files: files.map((file) => ({ path: file.path, content: file.content }))
  };
}

export async function importFiles(projectId, bundle) {
  if (!bundle || !Array.isArray(bundle.files)) {
    throw new FsError("bad_backup", "Backup is missing a files array.");
  }
  const written = [];
  for (const file of bundle.files) {
    written.push(await writeFile(projectId, file.path, String(file.content ?? "")));
  }
  return written;
}

export async function estimateStorage() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { usage: 0, quota: 0, persist: false };
  }
  const estimate = await navigator.storage.estimate();
  const persist = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return { usage: estimate.usage || 0, quota: estimate.quota || 0, persist };
}

export async function requestPersist() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  return navigator.storage.persist();
}

export function formatBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = n;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
