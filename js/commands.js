export const TOOL_NAMES = ["ls", "cat", "write", "edit", "rm", "js", "preview", "memory", "help", "clear", "pwd"];

export function tokenize(input) {
  const text = String(input || "");
  const tokens = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && i + 1 < text.length) {
        current += text[i + 1];
        i += 1;
      } else if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseCommandLine(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const line = raw.startsWith("/") ? raw.slice(1) : raw;
  const tokens = tokenize(line);
  if (!tokens.length) return null;
  const name = tokens[0].toLowerCase();
  const restTokens = tokens.slice(1);
  const rest = line.slice(tokens[0].length).trim();

  if (name === "ls" || name === "files") return { name: "ls", args: {} };
  if (name === "help" || name === "commands") return { name: "help", args: {} };
  if (name === "clear" || name === "cls") return { name: "clear", args: {} };
  if (name === "pwd") return { name: "pwd", args: {} };
  if (name === "preview") return { name: "preview", args: { path: restTokens[0] || null } };
  if (name === "cat" || name === "open" || name === "read") {
    return { name: "cat", args: { path: restTokens[0] || "" } };
  }
  if (name === "rm" || name === "delete") {
    return { name: "rm", args: { path: restTokens[0] || "" } };
  }
  if (name === "js" || name === "run") {
    return { name: "js", args: { path: restTokens[0] || "app.js" } };
  }
  if (name === "memory") {
    return { name: "memory", args: { summary: restTokens.join(" ") || "" } };
  }
  if (name === "edit" || name === "patch") {
    const path = restTokens[0] || "";
    const joined = restTokens.slice(1).join(" ");
    const split = joined.split(/\s+=>\s+|\s+->\s+/);
    return {
      name: "edit",
      args: {
        path,
        find: split[0] || "",
        replace: split.length > 1 ? split.slice(1).join(" => ") : ""
      }
    };
  }
  if (name === "write" || name === "new" || name === "touch" || name === "create") {
    return {
      name: "write",
      args: {
        path: restTokens[0] || "",
        content: restTokens.slice(1).join(" ")
      }
    };
  }
  if (TOOL_NAMES.includes(name)) return { name, args: { rest } };
  return null;
}

export function looksLikeCommand(input) {
  return Boolean(parseCommandLine(input));
}
