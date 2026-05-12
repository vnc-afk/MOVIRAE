export type SharedListEvent = {
  type: "shared-list-updated";
  listId: string;
  action: "created" | "updated" | "deleted";
  timestamp: string;
};

type SharedListEventListener = (event: SharedListEvent) => void;

const listeners = new Set<SharedListEventListener>();

export function subscribeToSharedListEvents(listener: SharedListEventListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function publishSharedListEvent(listId: string, action: SharedListEvent["action"]) {
  const payload: SharedListEvent = {
    type: "shared-list-updated",
    listId,
    action,
    timestamp: new Date().toISOString(),
  };

  for (const listener of listeners) {
    listener(payload);
  }
}