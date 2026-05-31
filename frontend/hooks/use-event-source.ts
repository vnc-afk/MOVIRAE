import { useEffect, useRef } from "react";

type Listener = (event: MessageEvent) => void;

type SharedEntry = {
  es: EventSource | null;
  listeners: Map<string, Set<Listener>>;
  refCount: number;
  retry: number;
  reconnectTimer: number | null;
};

const globalAny = globalThis as any;
globalAny.__eventSourceManager = globalAny.__eventSourceManager ?? new Map<string, SharedEntry>();
const manager: Map<string, SharedEntry> = globalAny.__eventSourceManager;

function ensureEntry(url: string) {
  let entry = manager.get(url);
  if (!entry) {
    entry = { es: null, listeners: new Map(), refCount: 0, retry: 0, reconnectTimer: null };
    manager.set(url, entry);
  }
  return entry;
}

function createConnection(url: string, entry: SharedEntry) {
  try {
    const es = new EventSource(url);
    entry.es = es;

    es.addEventListener("error", (err) => {
      try {
        es.close();
      } catch {}
      entry.es = null;
      entry.retry = Math.min(entry.retry + 1, 6);
      const delay = Math.min(1000 * Math.pow(2, entry.retry), 30000);
      if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = window.setTimeout(() => {
        if (entry && entry.refCount > 0) createConnection(url, entry);
      }, delay);
    });

    es.onmessage = (ev) => {
      const set = entry!.listeners.get("message");
      if (set) set.forEach((fn) => { try { fn(ev as MessageEvent); } catch (e) { console.error("useEventSource handler error:", e); } });
    };

    es.addEventListener("open", (ev) => {
      const set = entry!.listeners.get("open");
      if (set) set.forEach((fn) => { try { fn(ev as MessageEvent); } catch (e) { console.error("useEventSource handler error:", e); } });
    });
  } catch (err) {
    entry.es = null;
    entry.retry = Math.min(entry.retry + 1, 6);
    const delay = Math.min(1000 * Math.pow(2, entry.retry), 30000);
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = window.setTimeout(() => {
      if (entry && entry.refCount > 0) createConnection(url, entry);
    }, delay);
  }
}

export function useEventSource(
  url: string,
  listeners: Record<string, Listener | undefined> | null,
  options?: { enabled?: boolean; onError?: (err?: unknown) => void }
) {
  const opts = options ?? {};
  const enabled = opts.enabled ?? true;
  const listenersRef = useRef(listeners);
  const urlRef = useRef(url);

  useEffect(() => { listenersRef.current = listeners; }, [listeners]);
  useEffect(() => { urlRef.current = url; }, [url]);

  useEffect(() => {
    if (!enabled) return;

    const entry = ensureEntry(url);
    entry.refCount += 1;

    if (!entry.es) createConnection(url, entry);

    if (listenersRef.current) {
      for (const [eventName, handler] of Object.entries(listenersRef.current)) {
        if (!handler) continue;
        let set = entry.listeners.get(eventName);
        if (!set) {
          set = new Set();
          entry.listeners.set(eventName, set);
          try {
            entry.es?.addEventListener(eventName, (ev: MessageEvent) => {
              const s = entry!.listeners.get(eventName);
              if (s) s.forEach((fn) => { try { fn(ev); } catch (e) { console.error("useEventSource handler error:", e); } });
            });
          } catch (e) {
            // ignore
          }
        }
        set.add(handler as Listener);
      }
    }

    return () => {
      if (listenersRef.current) {
        for (const [eventName, handler] of Object.entries(listenersRef.current)) {
          if (!handler) continue;
          const set = entry.listeners.get(eventName);
          if (set) {
            set.delete(handler as Listener);
            if (set.size === 0) entry.listeners.delete(eventName);
          }
        }
      }

      entry.refCount = Math.max(0, entry.refCount - 1);
      if (entry.refCount === 0) {
        try {
          entry.es?.close();
        } catch {}
        if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
        manager.delete(url);
      }
    };
  }, [url, enabled]);
}

export default useEventSource;
