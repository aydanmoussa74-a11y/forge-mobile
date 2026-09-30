import { getByIndex, now, put, uid } from "./db.js";

export async function memoryGet(projectId, key) {
  const rows = await getByIndex("memories", "by_project", projectId);
  return rows.find((row) => row.key === key) || null;
}

export async function memoryPut(projectId, key, value) {
  const existing = await memoryGet(projectId, key);
  const row = {
    id: existing ? existing.id : uid("mem"),
    projectId,
    key,
    value,
    updatedAt: now()
  };
  await put("memories", row);
  return row;
}

export async function loadContext(projectId, files) {
  const last = await memoryGet(projectId, "last_turn");
  return {
    fileMap: files.map((file) => file.path),
    lastTurn: last ? last.value : null
  };
}

export async function rememberTurn(projectId, summary) {
  return memoryPut(projectId, "last_turn", {
    at: now(),
    summary,
    files: summary.files || []
  });
}
