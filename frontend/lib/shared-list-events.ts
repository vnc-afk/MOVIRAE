import type { SharedList } from "@/lib/types";

export type SharedListEvent = {
  type: "shared-list-updated";
  listId: string;
  action: "created" | "updated" | "deleted";
  timestamp: string;
  opId?: string;
  list?: SharedList;
};

type SharedListEventListener = (event: SharedListEvent) => void;

const listeners = new Set<SharedListEventListener>();

export function subscribeToSharedListEvents(listener: SharedListEventListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

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