import type { Message, NotificationItem, UserProfile } from "@/lib/types";

export type MessagingSnapshot = {
  items: NotificationItem[];
  messages: Message[];
  users: UserProfile[];
  sessionEmail: string | null;
};

export type MessageThreadSnapshot = {
  partner: UserProfile | null;
  messages: Message[];
  sessionEmail: string | null;
};

export type ConversationSummary = {
  partner: UserProfile;
  messages: Message[];
  unreadCount: number;
  lastMessageAt: string;
  conversationKey: string;
};

export function getConversationKey(userAId: string, userBId: string) {
  return [userAId, userBId].sort().join(":");
}

export function getCurrentUserFromSnapshot(snapshot: MessagingSnapshot) {
  if (!snapshot.sessionEmail) return null;
  return snapshot.users.find((user) => user.email === snapshot.sessionEmail) ?? null;
}

export function getConversationPartnerId(message: Message, currentUserId: string) {
  if (message.fromId && message.fromId !== currentUserId) return message.fromId;
  if (message.toId && message.toId !== currentUserId) return message.toId;
  if (message.from?.id && message.from.id !== currentUserId) return message.from.id;
  if (message.to?.id && message.to.id !== currentUserId) return message.to.id;
  return null;
}

export function buildConversationSummaries(snapshot: MessagingSnapshot, currentUserId: string | null) {
  if (!currentUserId) return [];

  const conversations = new Map<string, ConversationSummary>();

  for (const message of snapshot.messages) {
    const partnerId = getConversationPartnerId(message, currentUserId);
    if (!partnerId) continue;

    const partner = snapshot.users.find((user) => user.id === partnerId);
    if (!partner) continue;

    const existing = conversations.get(partnerId);
    const conversationKey = getConversationKey(currentUserId, partnerId);
    const unreadCount = message.fromId === partnerId && message.toId === currentUserId && !message.isRead ? 1 : 0;

    if (!existing) {
      conversations.set(partnerId, {
        partner,
        messages: [message],
        unreadCount,
        lastMessageAt: message.date,
        conversationKey,
      });
      continue;
    }

    existing.messages.push(message);
    existing.unreadCount += unreadCount;
    if (existing.lastMessageAt < message.date) {
      existing.lastMessageAt = message.date;
    }
  }

  return Array.from(conversations.values()).sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
}

async function fetchJsonOrThrow(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed (status ${response.status})`);
  }
  return response.json();
}

export async function fetchMessagingSnapshot(): Promise<MessagingSnapshot> {
  const PAGE_LIMIT = 50;
  const [notificationsResponse, messagesResponse, usersResponse, sessionResponse] = await Promise.all([
    fetchJsonOrThrow(`/api/notifications?limit=${PAGE_LIMIT}`),
    fetchJsonOrThrow(`/api/messages/list?limit=${PAGE_LIMIT}`),
    fetchJsonOrThrow("/api/users"),
    fetchJsonOrThrow("/api/auth/session"),
  ]);

  return {
    items: Array.isArray(notificationsResponse.value) ? notificationsResponse.value : [],
    messages: Array.isArray(messagesResponse.value) ? messagesResponse.value : [],
    users: Array.isArray(usersResponse.value) ? usersResponse.value : [],
    sessionEmail: typeof sessionResponse?.user?.email === "string" ? sessionResponse.user.email : null,
  };
}

export async function fetchFriends(): Promise<UserProfile[]> {
  const response = await fetchJsonOrThrow("/api/users/friends");
  return Array.isArray(response.value) ? response.value : [];
}

export async function fetchMessageThread(userId: string): Promise<MessageThreadSnapshot> {
  const response = await fetch(`/api/messages/${userId}`).then((res) => res.json());
  const value = response?.value ?? null;

  return {
    partner: value?.partner ?? null,
    messages: Array.isArray(value?.messages) ? value.messages : [],
    sessionEmail: typeof value?.sessionEmail === "string" ? value.sessionEmail : null,
  };
}

export function makeTempMessageId() {
  return `temp-message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createOptimisticMessage(params: {
  id: string;
  from: UserProfile;
  to: UserProfile;
  text: string;
  type?: "TEXT" | "GIF";
  gifId?: string;
  gifUrl?: string;
  gifPreviewUrl?: string;
  gifTitle?: string;
  gifWidth?: number;
  gifHeight?: number;
  date?: string;
}): Message {
  return {
    id: params.id,
    from: params.from,
    to: params.to,
    fromId: params.from.id,
    toId: params.to.id,
    text: params.text,
    type: params.type ?? "TEXT",
    gifId: params.gifId,
    gifUrl: params.gifUrl,
    gifPreviewUrl: params.gifPreviewUrl,
    gifTitle: params.gifTitle,
    gifWidth: params.gifWidth,
    gifHeight: params.gifHeight,
    date: params.date ?? new Date().toISOString(),
    isRead: false,
  };
}

export function appendMessageToSnapshot(snapshot: MessagingSnapshot, message: Message): MessagingSnapshot {
  return {
    ...snapshot,
    messages: [...snapshot.messages, message],
  };
}

export function appendNotificationToSnapshot(snapshot: MessagingSnapshot, notification: NotificationItem): MessagingSnapshot {
  const nextItems = snapshot.items.some((item) => item.id === notification.id)
    ? snapshot.items.map((item) => (item.id === notification.id ? notification : item))
    : [notification, ...snapshot.items];

  return {
    ...snapshot,
    items: nextItems,
  };
}

export function appendMessageToThread<T extends { messages: Message[] }>(snapshot: T, message: Message): T {
  return {
    ...snapshot,
    messages: [...snapshot.messages, message],
  };
}

export function replaceMessageInSnapshot(snapshot: MessagingSnapshot, tempMessageId: string, message: Message): MessagingSnapshot {
  const nextMessages = snapshot.messages.map((item) => (item.id === tempMessageId ? message : item));

  return {
    ...snapshot,
    messages: nextMessages,
  };
}

export function replaceMessageInThread<T extends { messages: Message[] }>(snapshot: T, tempMessageId: string, message: Message): T {
  return {
    ...snapshot,
    messages: snapshot.messages.map((item) => (item.id === tempMessageId ? message : item)),
  };
}

export function markConversationMessagesReadInSnapshot(snapshot: MessagingSnapshot, currentUserId: string, otherUserId: string): MessagingSnapshot {
  return {
    ...snapshot,
    messages: snapshot.messages.map((message) => {
      const isConversationIncoming = message.fromId === otherUserId && message.toId === currentUserId;

      if (!isConversationIncoming || message.isRead) {
        return message;
      }

      return { ...message, isRead: true };
    }),
  };
}

export function markConversationMessagesReadInThread<T extends { messages: Message[] }>(snapshot: T, currentUserId: string, otherUserId: string): T {
  return {
    ...snapshot,
    messages: snapshot.messages.map((message) => {
      const isConversationIncoming = message.fromId === otherUserId && message.toId === currentUserId;

      if (!isConversationIncoming || message.isRead) {
        return message;
      }

      return { ...message, isRead: true };
    }),
  };
}

export function markNotificationReadInSnapshot(snapshot: MessagingSnapshot, notificationId: string): MessagingSnapshot {
  return {
    ...snapshot,
    items: snapshot.items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
  };
}

export function markAllNotificationsReadInSnapshot(snapshot: MessagingSnapshot): MessagingSnapshot {
  return {
    ...snapshot,
    items: snapshot.items.map((item) => ({ ...item, read: true })),
  };
}
