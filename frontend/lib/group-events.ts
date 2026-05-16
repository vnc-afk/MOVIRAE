import type { GroupDetailRecord } from "@/lib/group-discussions";

export type GroupEvent = {
  type: "group-updated";
  groupId: string;
  timestamp: string;
  opId?: string;
  group?: GroupDetailRecord;
  event?: unknown;
  eventId?: string;
  action?: "created" | "updated" | "deleted";
};

export type NotificationEvent = {
  type: "notification-created";
  notificationId: string;
  timestamp: string;
};

type GroupEventListener = (event: GroupEvent) => void;
type NotificationEventListener = (event: NotificationEvent) => void;

const listenersByGroup = new Map<string, Set<GroupEventListener>>();
const notificationListeners = new Set<NotificationEventListener>();

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

export function subscribeToNotifications(listener: NotificationEventListener) {
  notificationListeners.add(listener);

  return () => {
    notificationListeners.delete(listener);
  };
}

export function publishGroupEvent(groupId: string, event: Omit<GroupEvent, "groupId" | "timestamp">, opId?: string) {
  const listeners = listenersByGroup.get(groupId);
  if (!listeners || listeners.size === 0) return;

  const payload: GroupEvent = {
    ...event,
    groupId,
    timestamp: new Date().toISOString(),
    opId,
  };

  for (const listener of listeners) {
    listener(payload);
  }
}

export function publishNotificationEvent(notificationId: string) {
  if (notificationListeners.size === 0) return;

  const payload: NotificationEvent = {
    type: "notification-created",
    notificationId,
    timestamp: new Date().toISOString(),
  };

  for (const listener of notificationListeners) {
    listener(payload);
  }
}