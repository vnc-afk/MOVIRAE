import type { SharedList } from "@/lib/types";

/**
 * Simple in-memory pub/sub for shared-list lifecycle events.
 * Used to notify server-side or in-process consumers when a shared list
 * is created, updated, or deleted so clients can update caches optimistically.
 */
export type SharedListEvent = {
  type: "shared-list-updated";
  listId: string;
  action: "created" | "updated" | "deleted";
  timestamp: string;
  opId?: string;
  list?: SharedList;
};

type SharedListEventListener = (event: SharedListEvent) => void;

// Global listener set for shared-list events. Kept intentionally simple —
// the process is expected to be short-lived and this avoids external infra.
const listeners = new Set<SharedListEventListener>();

/**
 * Subscribe to shared list events. Returns an unsubscribe function.
 */
export function subscribeToSharedListEvents(listener: SharedListEventListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Publish a `shared-list-updated` event to all subscribers.
 * `opId` can be provided by callers to correlate optimistic UI operations.
 */
export function publishSharedListEvent(
  listId: string,
  action: SharedListEvent["action"],
  opId?: string,
  list?: SharedList
) {
  const payload: SharedListEvent = {
    type: "shared-list-updated",
    listId,
    action,
    timestamp: new Date().toISOString(),
    opId,
    list,
  };

  for (const listener of listeners) {
    listener(payload);
  }
}