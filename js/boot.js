import { start } from "./app.js";

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

start().catch((error) => {
  const boot = document.getElementById("boot-error");
  if (boot) {
    boot.hidden = false;
    boot.textContent = error.message || "Forge failed to start.";
  }
  console.error(error);
});
