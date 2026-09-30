import { getByIndex, now, put, uid } from "./db.js";
import { redactSecrets } from "./redact.js";

export async function listMessages(threadId) {
  const rows = await getByIndex("messages", "by_thread", threadId);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addMessage(threadId, role, text, extra = {}) {
  const row = {
    id: uid("msg"),
    threadId,
    role,
    text: redactSecrets(String(text || "")).slice(0, 8000),
    createdAt: now(),
    ...extra
  };
  await put("messages", row);
  return row;
}

export const HELP_TEXT = [
  "Forge Mobile milestones 3–4: tool bus + planner.",
  "Commands: ls, cat, write, edit, rm, js, preview, help",
  "Or: create index.html that says hello from Lagos"
].join("\n");
