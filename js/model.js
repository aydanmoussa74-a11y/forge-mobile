import { get, now, put } from "./db.js";

const META_KEY = "model_settings";
const SECRET_KEY = "model_key";

function last4(value) {
  const text = String(value || "");
  if (!text) return "";
  return text.slice(-4);
}

export async function loadModelSettings() {
  const meta = await get("meta", META_KEY);
  const secret = await get("meta", SECRET_KEY);
  const settings = meta && meta.value ? meta.value : {};
  return {
    baseUrl: settings.baseUrl || "",
    model: settings.model || "",
    last4: settings.last4 || "",
    hasKey: Boolean(secret && secret.value)
  };
}

export async function saveModelSettings({ baseUrl, model, key }) {
  const existing = await loadModelSettings();
  const nextKey = key && key.trim() ? key.trim() : null;
  const storedKey = nextKey || ((await get("meta", SECRET_KEY))?.value ?? "");
  const snapshot = {
    baseUrl: String(baseUrl || "").trim().replace(/\/+$/, ""),
    model: String(model || "").trim(),
    last4: nextKey ? last4(nextKey) : existing.last4,
    updatedAt: now()
  };
  await put("meta", { key: META_KEY, value: snapshot });
  if (nextKey) await put("meta", { key: SECRET_KEY, value: storedKey });
  return { ...snapshot, hasKey: Boolean(storedKey) };
}

export async function clearModelKey() {
  await put("meta", { key: SECRET_KEY, value: "" });
  const settings = await loadModelSettings();
  await put("meta", { key: META_KEY, value: { ...settings, last4: "", updatedAt: now() } });
}

export async function completeChat({ messages }) {
  const settings = await loadModelSettings();
  const secret = await get("meta", SECRET_KEY);
  if (!settings.baseUrl || !settings.model || !secret || !secret.value) {
    const error = new Error("model_missing");
    error.code = "model_missing";
    throw error;
  }
  const url = `${settings.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret.value}`
    },
    body: JSON.stringify({ model: settings.model, temperature: 0.2, messages })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Model HTTP ${response.status}: ${body.slice(0, 180)}`);
  }
  const json = await response.json();
  const text = json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content
    : "";
  return String(text || "").trim();
}

export function extractStepsFromModel(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const fence = raw.match(/```json\s*([\s\S]+?)```/i);
  const candidate = fence ? fence[1] : raw;
  try {
    const parsed = JSON.parse(candidate);
    const steps = Array.isArray(parsed) ? parsed : parsed.steps;
    if (!Array.isArray(steps)) return [];
    return steps
      .map((step) => ({
        tool: String(step.tool || step.name || "").toLowerCase(),
        args: step.args || {}
      }))
      .filter((step) => step.tool);
  } catch {
    return [];
  }
}
