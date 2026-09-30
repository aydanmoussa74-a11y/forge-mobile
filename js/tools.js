import { parseCommandLine, TOOL_NAMES } from "./commands.js";
import { FsError, listFiles, readFile, removeFile, writeFile } from "./fs.js";
import { loadContext, rememberTurn } from "./memory.js";
import { buildPreviewHtml, mountPreview, pickDefaultEntry } from "./preview.js";
import { runJsSource } from "./sandbox.js";

export { parseCommandLine, TOOL_NAMES };

export async function runTool(name, args, ctx) {
  const started = Date.now();
  try {
    const result = await execute(name, args || {}, ctx);
    return { name, ok: result.ok !== false, ms: Date.now() - started, ...result };
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
    if (ctx.onFilesChanged) await ctx.onFilesChanged();
    return {
      summary: files.length ? files.map((file) => `${file.path}  ${file.bytes}b`).join("\n") : "No files.",
      files: files.map((file) => file.path)
    };
  }
  if (name === "pwd") {
    return { summary: ctx.projectName ? `/${ctx.projectName}` : "/workspace" };
  }
  if (name === "clear") {
    if (ctx.onClearTerm) ctx.onClearTerm();
    return { summary: "Terminal cleared." };
  }
  if (name === "cat") {
    if (!args.path) throw new Error("cat needs a path.");
    const file = await readFile(projectId, args.path);
    if (ctx.onOpenPath) await ctx.onOpenPath(file.path);
    return { summary: file.content.slice(0, 4000), path: file.path, bytes: file.bytes };
  }
  if (name === "write") {
    if (!args.path) throw new Error("write needs a path.");
    const file = await writeFile(projectId, args.path, args.content ?? "");
    if (ctx.onFilesChanged) await ctx.onFilesChanged();
    if (ctx.onOpenPath) await ctx.onOpenPath(file.path);
    return { summary: `Wrote ${file.path} (${file.bytes} bytes).`, path: file.path };
  }
  if (name === "edit") {
    if (!args.path) throw new Error("edit needs a path.");
    if (!args.find) throw new Error("edit needs find => replace.");
    const file = await readFile(projectId, args.path);
    if (!file.content.includes(args.find)) {
      throw new Error(`edit: text not found in ${file.path}.`);
    }
    const next = file.content.split(args.find).join(args.replace ?? "");
    const saved = await writeFile(projectId, file.path, next);
    if (ctx.onFilesChanged) await ctx.onFilesChanged();
    if (ctx.onOpenPath) await ctx.onOpenPath(saved.path);
    return { summary: `Edited ${saved.path}.`, path: saved.path };
  }
  if (name === "rm") {
    if (!args.path) throw new Error("rm needs a path.");
    const file = await removeFile(projectId, args.path);
    if (ctx.onFilesChanged) await ctx.onFilesChanged();
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
    if (ctx.onPreview) await ctx.onPreview(path);
    return { summary: `Previewing ${path}.`, path };
  }
  if (name === "memory") {
    const files = await listFiles(projectId);
    const context = await loadContext(projectId, files);
    if (args.summary) await rememberTurn(projectId, args.summary);
    return { summary: context.lastTurn ? "Memory loaded." : "Memory empty.", context };
  }
  if (name === "help") {
    return {
      summary: [
        "ls                    list files",
        "cat <path>            print a file",
        "write <path> text     create or replace",
        "edit <path> a => b    replace text",
        "rm <path>             delete a file",
        "js <path>             run JS in the 3s sandbox",
        "preview [path]        render HTML",
        "pwd / clear / help",
        "Or describe a page and the planner writes files."
      ].join("\n")
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}
