import { type QueryKey } from "@tanstack/react-query";

const STORAGE_KEY = "movirae_prefetch_telemetry_v1";
const PREFETCH_TTL_MS = 5 * 60 * 1000; // Keep prefetch records for 5m
const MAX_PREFETCH_RECORDS = 500; // soft cap for in-memory prefetch store
const SAVE_DEBOUNCE_MS = 5000; // debounce localStorage writes

type TelemetrySnapshot = {
  attempts: number;
  skipped: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  hits: number;
  misses: number;
  lastUpdated: number;
};

type PrefetchTelemetryGlobals = {
  prefetchStore?: Map<string, number>;
  telemetry?: TelemetrySnapshot;
};

const globalTelemetry = globalThis as typeof globalThis & PrefetchTelemetryGlobals;

// Keep the store and aggregate state on globalThis so separate client chunks share it.
const prefetchStore = globalTelemetry.prefetchStore ?? new Map<string, number>();
globalTelemetry.prefetchStore = prefetchStore;

// aggregate telemetry (persisted to localStorage)
let telemetry: TelemetrySnapshot = globalTelemetry.telemetry ?? load() ?? {
  attempts: 0,
  skipped: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
  hits: 0,
  misses: 0,
  lastUpdated: Date.now(),
};
globalTelemetry.telemetry = telemetry;

let autoFlushIntervalId: ReturnType<typeof setInterval> | null = null;
let ttlCleanupIntervalId: ReturnType<typeof setInterval> | null = null;
const AUTO_FLUSH_MS = 30 * 1000; // 30 seconds (used only for local save)
let listenersRegistered = false;

// Optional debug logging
let debugMode = false;

function handleVisibilityChange() {
  if (document.visibilityState === "hidden") {
    void flushTelemetry();
  }
}

function handleBeforeUnload() {
  try {
    void flushTelemetry();
  } catch {}
}

let saveScheduled = false;
function save() {
  // Debounced write to avoid frequent synchronous localStorage I/O
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(telemetry));
      globalTelemetry.telemetry = telemetry;
    } catch {
      // ignore
    } finally {
      saveScheduled = false;
    }
  }, SAVE_DEBOUNCE_MS);
}

function load(): TelemetrySnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TelemetrySnapshot;
  } catch {
    return null;
  }
}

function hashKey(queryKey: QueryKey) {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return String(queryKey);
  }
}

function cleanupExpiredPrefetches() {
  const now = Date.now();
  for (const [key, timestamp] of prefetchStore.entries()) {
    if (now - timestamp > PREFETCH_TTL_MS) {
      prefetchStore.delete(key);
    }
  }
}

export function recordPrefetchAttempt() {
  telemetry.attempts++;
  telemetry.lastUpdated = Date.now();
  save();
}

export function recordPrefetchSkipped() {
  telemetry.skipped++;
  telemetry.lastUpdated = Date.now();
  save();
}

export function recordPrefetchSucceeded(queryKey: QueryKey) {
  telemetry.succeeded++;
  const keyHash = hashKey(queryKey);
  // Store in prefetch store so we can detect hits later
  prefetchStore.set(keyHash, Date.now());
  // Evict oldest entries when exceeding soft cap
  if (prefetchStore.size > MAX_PREFETCH_RECORDS) {
    // Find oldest key
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [k, ts] of prefetchStore.entries()) {
      if (ts < oldestTs) {
        oldestTs = ts;
        oldestKey = k;
      }
    }
    if (oldestKey) prefetchStore.delete(oldestKey);
  }
  telemetry.lastUpdated = Date.now();
  save();
}

export function recordPrefetchFailed() {
  telemetry.failed++;
  telemetry.lastUpdated = Date.now();
  save();
}

export function recordPrefetchCancelled() {
  telemetry.cancelled++;
  telemetry.lastUpdated = Date.now();
  save();
}

// ===== Hit/Miss Detection APIs =====

export function markHit(queryKey: QueryKey) {
  const keyHash = hashKey(queryKey);
  if (prefetchStore.has(keyHash)) {
    telemetry.hits++;
    if (debugMode) console.log(`[PREFETCH HIT] ${keyHash}`);
    // remove so we don't double-count
    prefetchStore.delete(keyHash);
    telemetry.lastUpdated = Date.now();
    save();
  } else {
    if (debugMode) console.log(`[PREFETCH HIT MISS] ${keyHash} not in store. Store keys: ${Array.from(prefetchStore.keys()).join(", ")}`);
  }
}

export function markMiss(queryKey: QueryKey) {
  const keyHash = hashKey(queryKey);
  if (!prefetchStore.has(keyHash)) {
    telemetry.misses++;
    if (debugMode) console.log(`[PREFETCH MISS] ${keyHash}`);
    telemetry.lastUpdated = Date.now();
    save();
  } else {
    if (debugMode) console.log(`[PREFETCH MISS CONTRADICTED] ${keyHash} found in store, not counting as miss`);
  }
}

export function getTelemetrySnapshot() {
  return { ...telemetry } as TelemetrySnapshot;
}

async function postJson(url: string, body: any) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function flushTelemetry(): Promise<boolean> {
  // Persist current counters to localStorage only. We no longer upload telemetry to the server
  // from client to avoid extra network/DB cost; operators can opt-in to server-side telemetry later.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(telemetry));
    globalTelemetry.telemetry = telemetry;
    return true;
  } catch {
    return false;
  }
}

export function startAutoFlush() {
  if (autoFlushIntervalId) return;

  // start TTL cleanup and periodic local save
  ttlCleanupIntervalId = setInterval(cleanupExpiredPrefetches, 5000);

  autoFlushIntervalId = setInterval(() => {
    try {
      // Only persist locally; avoid network uploads in lightweight mode
      void flushTelemetry();
    } catch {}
  }, AUTO_FLUSH_MS);

  // persist on visibility change and unload as a last-resort
  try {
    if (typeof window !== "undefined" && !listenersRegistered) {
      window.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("beforeunload", handleBeforeUnload);
      listenersRegistered = true;
    }
  } catch {}
}

export function stopAutoFlush() {
  if (autoFlushIntervalId) {
    clearInterval(autoFlushIntervalId);
    autoFlushIntervalId = null;
  }
  if (ttlCleanupIntervalId) {
    clearInterval(ttlCleanupIntervalId);
    ttlCleanupIntervalId = null;
  }
  if (typeof window !== "undefined" && listenersRegistered) {
    window.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("beforeunload", handleBeforeUnload);
    listenersRegistered = false;
  }
}

export function resetTelemetry() {
  telemetry = {
    attempts: 0,
    skipped: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    hits: 0,
    misses: 0,
    lastUpdated: Date.now(),
  };
  prefetchStore.clear();
  globalTelemetry.telemetry = telemetry;
  save();
}

export default {
  recordPrefetchAttempt,
  recordPrefetchSkipped,
  recordPrefetchSucceeded,
  recordPrefetchFailed,
  recordPrefetchCancelled,
  markHit,
  markMiss,
  getTelemetrySnapshot,
  resetTelemetry,
  flushTelemetry,
  startAutoFlush,
  stopAutoFlush,
  enableDebug: (enabled: boolean) => {
    debugMode = enabled;
  },
};
