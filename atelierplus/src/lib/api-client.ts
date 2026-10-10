// Multi-layer session token storage.
//
// The app is sometimes shown inside an embedded frame (preview, in-app browser).
// In that context browsers may:
//   - refuse third-party cookies,
//   - block localStorage/sessionStorage,
//   - refuse IndexedDB for cross-origin frames.
// We therefore keep the token in several places and use whichever is available:
//   1. An in-memory variable (always works for the current page life),
//   2. localStorage (best when available),
//   3. sessionStorage as fallback,
//   4. a non-HttpOnly cookie (works in more frames than HttpOnly ones),
//   5. IndexedDB as a last resort.
//
// When the token changes, we broadcast it to other tabs via BroadcastChannel.

const STORAGE_KEY = "atelierplus-session-token";
const COOKIE_NAME = "atelierplus_session_client";
const IDB_DB = "atelierplus-session";
const IDB_STORE = "tokens";
const BROADCAST_CHANNEL = "atelierplus-session";

let memoryToken: string | null = null;

function broadcastTokenUpdate(token: string): void {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.postMessage({ type: "token_updated", token });
      channel.close();
    }
  } catch {
    // BroadcastChannel unavailable or blocked: silent
  }
}

function broadcastTokenCleared(): void {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.postMessage({ type: "token_cleared" });
      channel.close();
    }
  } catch {
    // BroadcastChannel unavailable or blocked: silent
  }
}

function readCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE_NAME + "="));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
}

function writeCookieToken(token: string | null): void {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
    return;
  }
  // 30 days. Lax avoids cross-site sending; the Bearer header covers embedded frames.
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure`;
}

function writeWebStorage(storage: Storage | undefined, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, value);
    return storage.getItem(STORAGE_KEY) === value;
  } catch {
    return false;
  }
}

function readWebStorage(storage: Storage | undefined): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeIdb(token: string | null): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    if (token === null) {
      store.delete(STORAGE_KEY);
    } else {
      store.put(token, STORAGE_KEY);
    }
  } catch {
    // IndexedDB write failed: silent, other layers remain usable.
  } finally {
    db.close();
  }
}

async function readIdb(): Promise<string | null> {
  const db = await openIdb();
  if (!db) return null;
  try {
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const request = tx.objectStore(IDB_STORE).get(STORAGE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export function saveStoredToken(token: string): void {
  memoryToken = token;
  writeCookieToken(token);
  const wroteLs = writeWebStorage(
    typeof localStorage !== "undefined" ? localStorage : undefined,
    token,
  );
  if (!wroteLs) {
    writeWebStorage(typeof sessionStorage !== "undefined" ? sessionStorage : undefined, token);
  }
  void writeIdb(token);
  broadcastTokenUpdate(token);
}

export function clearStoredToken(): void {
  memoryToken = null;
  writeCookieToken(null);
  if (typeof localStorage !== "undefined") {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
  if (typeof sessionStorage !== "undefined") {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
  void writeIdb(null);
  broadcastTokenCleared();
}

/**
 * Synchronous read: best effort from memory / cookie / web storage.
 * The async `getStoredTokenAsync` can try IndexedDB when this returns null.
 */
export function getStoredToken(): string | null {
  if (memoryToken) return memoryToken;
  const cookie = readCookieToken();
  if (cookie) {
    memoryToken = cookie;
    return cookie;
  }
  const ls = readWebStorage(typeof localStorage !== "undefined" ? localStorage : undefined);
  if (ls) {
    memoryToken = ls;
    return ls;
  }
  const ss = readWebStorage(typeof sessionStorage !== "undefined" ? sessionStorage : undefined);
  if (ss) {
    memoryToken = ss;
    return ss;
  }
  return null;
}

export async function getStoredTokenAsync(): Promise<string | null> {
  const sync = getStoredToken();
  if (sync) return sync;
  const idb = await readIdb();
  if (idb) {
    memoryToken = idb;
    return idb;
  }
  return null;
}

export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers, credentials: "include" });
}
