import { parseCommandLine, tokenize } from "../js/commands.js";
import { extractStepsFromModel } from "../js/model.js";
import { fileFromIdea, planTurn } from "../js/planner.js";
import { redactSecrets } from "../js/redact.js";

let failed = 0;
function assert(cond, name) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", name);
  } else {
    console.log("ok  ", name);
  }
}

assert(tokenize('write "a b.html" hi').join("|") === "write|a b.html|hi", "tokenize quotes");
assert(parseCommandLine("/ls").name === "ls", "parse ls");
assert(parseCommandLine("cat index.html").args.path === "index.html", "parse cat");
assert(parseCommandLine('write notes.txt hello from Lagos').args.content.includes("hello"), "parse write");
assert(parseCommandLine("edit index.html Hello => Hi").args.replace === "Hi", "parse edit");
assert(parseCommandLine("preview").name === "preview", "parse preview");
assert(parseCommandLine("build a tap counter page") === null, "natural language is not a command");

const counter = planTurn("build a tap counter page");
assert(counter.mode === "build", "counter plan mode");
assert(counter.steps.some((s) => s.tool === "write" && s.args.path === "index.html"), "counter writes html");
assert(counter.steps.at(-1).tool === "preview", "counter ends with preview");

const named = planTurn("create poster.html that says hello from Lagos");
assert(named.mode === "write" && named.steps[0].args.path === "poster.html", "named write");
assert(fileFromIdea("hi.md", "x").includes("x"), "fileFromIdea md");

const steps = extractStepsFromModel('{"steps":[{"tool":"ls","args":{}}]}');
assert(steps.length === 1 && steps[0].tool === "ls", "extract json steps");
assert(extractStepsFromModel("not json").length === 0, "extract garbage");

assert(redactSecrets("sk-abcdefghijklmnop").includes("••••"), "redact sk");
assert(redactSecrets("hello") === "hello", "redact leaves plain text");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall seams passed");
