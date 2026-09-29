const DB_NAME = "forge-mobile";
const DB_VERSION = 1;

/** @type {IDBDatabase | null} */
let dbPromiseHandle = null;

export function openDb() {
  if (dbPromiseHandle) return dbPromiseHandle;
  dbPromiseHandle = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("threads")) {
        const store = db.createObjectStore("threads", { keyPath: "id" });
        store.createIndex("by_project", "projectId", { unique: false });
      }
      if (!db.objectStoreNames.contains("messages")) {
        const store = db.createObjectStore("messages", { keyPath: "id" });
        store.createIndex("by_thread", "threadId", { unique: false });
      }
      if (!db.objectStoreNames.contains("files")) {
        const store = db.createObjectStore("files", { keyPath: "id" });
        store.createIndex("by_project", "projectId", { unique: false });
        store.createIndex("by_project_path", ["projectId", "path"], { unique: true });
      }
      if (!db.objectStoreNames.contains("memories")) {
        const store = db.createObjectStore("memories", { keyPath: "id" });
        store.createIndex("by_project", "projectId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromiseHandle;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
  });
}

export async function put(storeName, value) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value);
  await txDone(tx);
  return value;
}

export async function get(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function del(storeName, key) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  await txDone(tx);
}

export async function getAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getByIndex(storeName, indexName, query) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).index(indexName).getAll(query);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export function uid(prefix = "id") {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function now() {
  return new Date().toISOString();
}
