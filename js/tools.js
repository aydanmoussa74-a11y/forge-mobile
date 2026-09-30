import { FsError, listFiles, readFile, removeFile, writeFile } from "./fs.js";
import { loadContext, rememberTurn } from "./memory.js";
import { buildPreviewHtml, mountPreview, pickDefaultEntry } from "./preview.js";
import { runJsSource } from "./sandbox.js";

export const TOOL_NAMES = ["ls", "cat", "write", "rm", "js", "preview", "memory"];

export function parseCommandLine(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const line = raw.startsWith("/") ? raw.slice(1) : raw;
  const match = line.match(/^(\S+)(?:\s+([\s\S]+))?$/);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const rest = (match[2] || "").trim();
  if (name === "ls" || name === "files") return { name: "ls", args: {} };
  if (name === "help") return { name: "help", args: {} };
  if (name === "cat" || name === "open" || name === "read") return { name: "cat", args: { path: rest } };
  if (name === "preview") return { name: "preview", args: { path: rest || null } };
  if (name === "rm" || name === "delete") return { name: "rm", args: { path: rest } };
  if (name === "js" || name === "run") return { name: "js", args: { path: rest || "app.js" } };
  if (name === "write" || name === "new" || name === "touch" || name === "create") {
    const split = rest.match(/^(\S+)(?:\s+([\s\S]+))?$/);
    return { name: "write", args: { path: split ? split[1] : rest, content: split && split[2] ? split[2] : "" } };
  }
  return null;
}

export async function runTool(name, args, ctx) {
  const started = Date.now();
  try {
    const result = await execute(name, args || {}, ctx);
    return { name, ok: true, ms: Date.now() - started, ...result };
  } catch (error) {
    return {
      name,
      ok: false,
      ms: Date.now() - started,
      summary: error instanceof FsError ? error.message : error.message || String(error),
      error: error instanceof FsError ? error.code : "tool_error"
    };
  }
}

async function execute(name, args, ctx) {
  const projectId = ctx.projectId;
  if (name === "ls") {
    const files = await listFiles(projectId);
    ctx.onFilesChanged && (await ctx.onFilesChanged());
    return {
      summary: files.length ? files.map((file) => file.path).join("\n") : "No files.",
      files: files.map((file) => file.path)
    };
  }
  if (name === "cat") {
    if (!args.path) throw new Error("cat needs a path.");
    const file = await readFile(projectId, args.path);
    ctx.onOpenPath && (await ctx.onOpenPath(file.path));
    return { summary: file.content.slice(0, 4000), path: file.path, bytes: file.bytes };
  }
  if (name === "write") {
    if (!args.path) throw new Error("write needs a path.");
    const file = await writeFile(projectId, args.path, args.content ?? "");
    ctx.onFilesChanged && (await ctx.onFilesChanged());
    ctx.onOpenPath && (await ctx.onOpenPath(file.path));
    return { summary: `Wrote ${file.path} (${file.bytes} bytes).`, path: file.path };
  }
  if (name === "rm") {
    if (!args.path) throw new Error("rm needs a path.");
    const file = await removeFile(projectId, args.path);
    ctx.onFilesChanged && (await ctx.onFilesChanged());
    return { summary: `Deleted ${file.path}.`, path: file.path };
  }
  if (name === "js") {
    const path = args.path || "app.js";
    const file = args.source != null ? { path: "inline.js", content: args.source } : await readFile(projectId, path);
    const ran = await runJsSource(file.content);
    const lines = [ran.ok ? `js ${file.path}` : `js ${file.path} failed`];
    if (ran.output) lines.push(ran.output);
    if (ran.result && ran.result !== "undefined") lines.push(String(ran.result));
    if (ran.error) lines.push(ran.error);
    return { summary: lines.join("\n"), path: file.path, ok: ran.ok };
  }
  if (name === "preview") {
    const path = args.path || (await pickDefaultEntry(projectId));
    if (!path) throw new Error("Nothing to preview.");
    const payload = await buildPreviewHtml(projectId, path);
    if (ctx.iframe) mountPreview(ctx.iframe, payload);
    ctx.onPreview && (await ctx.onPreview(path));
    return { summary: `Previewing ${path}.`, path };
  }
  if (name === "memory") {
    const files = await listFiles(projectId);
    const context = await loadContext(projectId, files);
    if (args.summary) await rememberTurn(projectId, args.summary);
    return { summary: context.lastTurn ? "Memory updated." : "Memory empty.", context };
  }
  if (name === "help") {
    return {
      summary: [
        "ls                 list files",
        "cat <path>         print a file",
        "write <path> text  create or replace",
        "rm <path>          delete a file",
        "js <path>          run JS in the sandbox",
        "preview [path]     render HTML",
        "Or describe a page and the planner will write files."
      ].join("\n")
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}
