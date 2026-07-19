import type { GroupDetailRecord, DiscussionRecord } from "@/lib/group-discussions";
import type { NotificationItem } from "@/lib/types";

/**
 * Group-related real-time event structures used by the in-memory pub/sub.
 */
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

/**
 * Notification events emitted when a notification is created server-side.
 */
export type NotificationEvent = {
  type: "notification-created";
  notificationId: string;
  recipientId?: string;
  notification?: NotificationItem;
  timestamp: string;
};

/**
 * Message events for lightweight chat/message updates.
 */
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

// In-memory listener registries used by the server SSE and in-process consumers.
const listenersByGroup = new Map<string, Set<GroupEventListener>>();
const notificationListeners = new Set<NotificationEventListener>();
const messageListeners = new Set<MessageEventListener>();

/**
 * Subscribe to events for a specific group. Returns an unsubscribe function.
 */
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

/**
 * Subscribe to global notification events. Returns an unsubscribe function.
 */
export function subscribeToNotifications(listener: NotificationEventListener) {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

/**
 * Subscribe to message events. Returns an unsubscribe function.
 */
export function subscribeToMessageEvents(listener: MessageEventListener) {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

/**
 * Publish a group event to all subscribers for that group.
 * The payload will be timestamped here to preserve ordering semantics.
 */
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

/**
 * Publish a notification event. Accepts either an id string or a partial payload.
 */
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

/**
 * Publish a message-related event to message subscribers.
 */
export function publishMessageEvent(event: Omit<MessageEvent, "timestamp">) {
  if (messageListeners.size === 0) return;

  const payload: MessageEvent = { ...event, timestamp: new Date().toISOString() };
  for (const listener of messageListeners) {
    listener(payload);
  }
}