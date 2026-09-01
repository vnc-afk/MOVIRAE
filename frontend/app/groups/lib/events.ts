import type { GroupDetailRecord } from "@/app/groups/lib/types";
import type { DiscussionRecord } from "@/app/groups/lib/discussions";
import type { NotificationItem } from "@/lib/types";

export type GroupEvent = {
  type: "group-updated";
  groupId: string;
  timestamp: string;
  opId?: string;
  group?: GroupDetailRecord;
  discussion?: DiscussionRecord;
  event?: unknown;
  eventId?: string;
  action?: "created" | "updated" | "deleted";
};

export type NotificationEvent = {
  type: "notification-created";
  notificationId: string;
  recipientId?: string;
  notification?: NotificationItem;
  timestamp: string;
};

export type MessageEvent = {
  type: "message-created" | "message-read";
  messageId?: string;
  conversationKey: string;
  fromId?: string;
  toId?: string;
  readerId?: string;
  timestamp: string;
};

type GroupEventListener = (event: GroupEvent) => void;
type NotificationEventListener = (event: NotificationEvent) => void;
type MessageEventListener = (event: MessageEvent) => void;

const listenersByGroup = new Map<string, Set<GroupEventListener>>();
const notificationListeners = new Set<NotificationEventListener>();
const messageListeners = new Set<MessageEventListener>();

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

export function subscribeToMessageEvents(listener: MessageEventListener) {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
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

export function publishNotificationEvent(notificationId: string): void;
export function publishNotificationEvent(payload: Omit<NotificationEvent, "type" | "timestamp">): void;
export function publishNotificationEvent(payloadOrId: string | Omit<NotificationEvent, "type" | "timestamp">) {
  if (notificationListeners.size === 0) return;

  const event: NotificationEvent =
    typeof payloadOrId === "string"
      ? { type: "notification-created", notificationId: payloadOrId, timestamp: new Date().toISOString() }
      : { type: "notification-created", ...payloadOrId, timestamp: new Date().toISOString() };

  for (const listener of notificationListeners) {
    listener(event);
  }
}

export function publishMessageEvent(event: Omit<MessageEvent, "timestamp">) {
  if (messageListeners.size === 0) return;

  const payload: MessageEvent = { ...event, timestamp: new Date().toISOString() };
  for (const listener of messageListeners) {
    listener(payload);
  }
}
