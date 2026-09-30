const DEFAULT_MS = 3000;

export async function runJsSource(source, timeoutMs = DEFAULT_MS) {
  const code = String(source || "");
  if (!code.trim()) return { ok: false, output: "", error: "No JavaScript to run." };
  if (code.length > 80_000) return { ok: false, output: "", error: "Script is too large for the sandbox." };

  const workerSource = `
    const logs = [];
    const send = (type, value) => self.postMessage({ type, value, logs: logs.slice() });
    const asText = (value) => {
      try { return typeof value === "string" ? value : JSON.stringify(value); }
      catch { return String(value); }
    };
    self.console = {
      log: (...args) => logs.push(args.map(asText).join(" ")),
      info: (...args) => logs.push(args.map(asText).join(" ")),
      warn: (...args) => logs.push(args.map(asText).join(" ")),
      error: (...args) => logs.push(args.map(asText).join(" "))
    };
    self.onmessage = (event) => {
      try {
        const result = Function('"use strict";\n' + event.data)();
        send("ok", result === undefined ? "undefined" : asText(result));
      } catch (error) {
        send("err", error && error.message ? error.message : String(error));
      }
    };
  `;

  const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  return new Promise((resolve) => {
    let settled = false;
    const worker = new Worker(url);
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      finish({ ok: false, output: "", error: `Timed out after ${timeoutMs}ms.` });
    }, timeoutMs);
    worker.onmessage = (event) => {
      const data = event.data || {};
      const output = Array.isArray(data.logs) ? data.logs.join("\n") : "";
      if (data.type === "ok") finish({ ok: true, output, result: data.value, error: null });
      else finish({ ok: false, output, error: data.value || "Sandbox error." });
    };
    worker.onerror = (event) => {
      finish({ ok: false, output: "", error: event.message || "Sandbox worker failed." });
    };
    worker.postMessage(code);
  });
}
