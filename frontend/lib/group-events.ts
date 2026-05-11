export type GroupEvent = {
  type: "group-updated";
  groupId: string;
  timestamp: string;
};

type GroupEventListener = (event: GroupEvent) => void;

const listenersByGroup = new Map<string, Set<GroupEventListener>>();

export function subscribeToGroupEvents(groupId: string, listener: GroupEventListener) {
  const listeners = listenersByGroup.get(groupId) ?? new Set<GroupEventListener>();
  listeners.add(listener);
  listenersByGroup.set(groupId, listeners);

  return () => {
    const nextListeners = listenersByGroup.get(groupId);
    if (!nextListeners) return;

    nextListeners.delete(listener);
    if (nextListeners.size === 0) {
      listenersByGroup.delete(groupId);
    }
  };
}

export function publishGroupEvent(groupId: string, event: Omit<GroupEvent, "groupId" | "timestamp">) {
  const listeners = listenersByGroup.get(groupId);
  if (!listeners || listeners.size === 0) return;

  const payload: GroupEvent = {
    ...event,
    groupId,
    timestamp: new Date().toISOString(),
  };

  for (const listener of listeners) {
    listener(payload);
  }
}