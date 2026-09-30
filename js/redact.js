const PATTERNS = [
  [/\bsk-[A-Za-z0-9_-]{10,}\b/g, "sk-••••"],
  [/\bgh[pousr]_[A-Za-z0-9_]{10,}\b/g, "gh•_••••"],
  [/\bgithub_pat_[A-Za-z0-9_]{10,}\b/g, "github_pat_••••"],
  [/\bAIza[A-Za-z0-9_-]{10,}\b/g, "AIza••••"],
  [/\bcf-[A-Za-z0-9_-]{16,}\b/g, "cf-••••"],
  [/\bBearer\s+[A-Za-z0-9._\-+=/]{12,}\b/gi, "Bearer ••••"]
];

export function redactSecrets(value) {
  let text = String(value || "");
  for (const [pattern, label] of PATTERNS) text = text.replace(pattern, label);
  return text;
}

export function containsSecret(value) {
  return redactSecrets(value) !== String(value || "");
}
