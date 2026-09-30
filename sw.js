const VERSION = "forge-mobile-m4-v1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./js/boot.js",
  "./js/db.js",
  "./js/fs.js",
  "./js/preview.js",
  "./js/chat.js",
  "./js/ui.js",
  "./js/app.js",
  "./js/sandbox.js",
  "./js/memory.js",
  "./js/tools.js",
  "./js/planner.js",
  "./js/model.js",
  "./js/loop.js",
  "./icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && request.destination !== "document") {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached || caches.match("./index.html"));
      return cached || network;
    })
  );
});
