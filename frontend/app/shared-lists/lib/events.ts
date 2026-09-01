import type { SharedList } from "./types";

export type SharedListEvent = {
  type: "created" | "updated" | "deleted";
  listId: string;
  timestamp: string;
  opId?: string;
  list?: SharedList;
};

type SharedListEventListener = (event: SharedListEvent) => void;

const listenersByListId = new Map<string, Set<SharedListEventListener>>();
const globalListeners = new Set<SharedListEventListener>();

/**
 * Subscribe to events for a specific list or all lists
 * @param listIdOrListener - List ID (string) or listener function (for global subscription)
 * @param listener - Listener function (if first param is a list ID)
 */
export function subscribeToSharedListEvents(
  listIdOrListener: string | SharedListEventListener,
  listener?: SharedListEventListener
) {
  // Global subscription (no list ID, just a listener)
  if (typeof listIdOrListener === "function") {
    globalListeners.add(listIdOrListener);
    return () => {
      globalListeners.delete(listIdOrListener);
    };
  }

  // Per-list subscription
  const listId = listIdOrListener;
  const listListener = listener!;
  const listeners = listenersByListId.get(listId) ?? new Set<SharedListEventListener>();
  listeners.add(listListener);
  listenersByListId.set(listId, listeners);

  return () => {
    const nextListeners = listenersByListId.get(listId);
    if (!nextListeners) return;
    nextListeners.delete(listListener);
    if (nextListeners.size === 0) {
      listenersByListId.delete(listId);
    }
  };
}

export function publishSharedListEvent(
  listId: string,
  type: SharedListEvent["type"],
  opId?: string,
  list?: SharedList
) {
  const event: SharedListEvent = {
    type,
    listId,
    timestamp: new Date().toISOString(),
    opId,
    list,
  };

  // Publish to global listeners
  for (const listener of globalListeners) {
    listener(event);
  }

  // Publish to per-list listeners
  const listeners = listenersByListId.get(listId);
  if (listeners) {
    for (const listener of listeners) {
      listener(event);
    }
  }
}
