import { rememberTurn } from "./memory.js";
import { completeChat, extractStepsFromModel, loadModelSettings } from "./model.js";
import { planTurn, SYSTEM_PROMPT } from "./planner.js";
import { runTool } from "./tools.js";

const MAX_STEPS = 6;

export async function runTurn(text, ctx) {
  const planned = planTurn(text, ctx.files || []);
  let steps = planned.steps.slice(0, MAX_STEPS);
  let source = "planner";

  if (!steps.length && planned.mode === "note") {
    const settings = await loadModelSettings();
    if (settings.hasKey && settings.baseUrl && settings.model) {
      try {
        const reply = await completeChat({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Files: ${(ctx.files || []).map((file) => file.path).join(", ") || "none"}\n\n${text}` }
          ]
        });
        const extracted = extractStepsFromModel(reply);
        if (extracted.length) {
          steps = extracted.slice(0, MAX_STEPS);
          source = "model";
        } else {
          return {
            source: "model",
            note: reply || "Model returned no tools.",
            results: [],
            filesChanged: []
          };
        }
      } catch (error) {
        if (error.code !== "model_missing") {
          return {
            source: "planner",
            note: `Model unavailable (${error.message}). Say help or describe a page to build.`,
            results: [],
            filesChanged: []
          };
        }
      }
    }
  }

  const results = [];
  const filesChanged = [];
  for (const step of steps) {
    if (ctx.onToolStart) ctx.onToolStart(step);
    const result = await runTool(step.tool, step.args, ctx);
    results.push(result);
    if (ctx.onToolDone) ctx.onToolDone(result);
    if (result.path) filesChanged.push(result.path);
    if (result.files) filesChanged.push(...result.files);
    if (!result.ok && step.tool === "write") break;
  }

  const uniqueFiles = [...new Set(filesChanged)];
  await rememberTurn(ctx.projectId, {
    text,
    source,
    note: planned.note,
    files: uniqueFiles,
    tools: results.map((row) => row.name)
  });

  if (!results.length) {
    return {
      source,
      note: "No tools ran. Try help, ls, or \u201ccreate about.html that says hello from Lagos\u201d.",
      results,
      filesChanged: uniqueFiles
    };
  }

  const failed = results.filter((row) => !row.ok);
  const note = failed.length
    ? `${planned.note}. ${failed.length} tool(s) failed.`
    : `${planned.note}. ${results.length} tool(s) ok.`;
  return { source, note, results, filesChanged: uniqueFiles };
}
