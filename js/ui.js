export const $ = (id) => document.getElementById(id);

export function setPane(name) {
  document.querySelectorAll("[data-pane]").forEach((node) => {
    node.hidden = node.dataset.pane !== name;
  });
  document.querySelectorAll("[data-pane-btn]").forEach((btn) => {
    const active = btn.dataset.paneBtn === name;
    btn.setAttribute("aria-selected", String(active));
    btn.classList.toggle("is-active", active);
  });
}

export function toast(message, tone = "info") {
  const host = $("toast");
  host.textContent = message;
  host.dataset.tone = tone;
  host.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    host.hidden = true;
  }, 3200);
}

export function formatTime(iso) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function confirmDanger(message) {
  return window.confirm(message);
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function readFileInput(input) {
  return new Promise((resolve, reject) => {
    const file = input.files && input.files[0];
    if (!file) return reject(new Error("No file selected."));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Read failed."));
    reader.readAsText(file);
  });
}
