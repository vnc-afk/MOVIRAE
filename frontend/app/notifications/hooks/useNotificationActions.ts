"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  appendMessageToSnapshot,
  appendMessageToThread,
  createOptimisticMessage,
  markAllNotificationsReadInSnapshot,
  markConversationMessagesReadInSnapshot,
  markConversationMessagesReadInThread,
  markNotificationReadInSnapshot,
  replaceMessageInSnapshot,
  replaceMessageInThread,
} from "@/lib/features/messages/service";
import type {
  ConversationSummary,
  MessageThreadSnapshot,
  MessagingSnapshot,
} from "@/lib/features/messages/service";
import type { Message, NotificationItem, UserProfile } from "@/lib/types";

interface UseNotificationActionsOptions {
  currentUser: UserProfile | null;
  activeConversation: ConversationSummary | null;
  activeConversationPartnerId: string | null;
  activeThread: MessageThreadSnapshot;
  notificationsKey: readonly unknown[];
  threadQueryKey: readonly unknown[];
  activeTab: "notifications" | "messages";
}

interface UseNotificationActionsResult {
  markNotificationRead: (notification: NotificationItem) => Promise<void>;
  markAllRead: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
}

/**
 * Provides notification and messaging actions with optimistic cache updates.
 *
 * This hook updates the shared notifications snapshot immediately for
 * a responsive UI, and rolls back changes if the server request fails.
 */
export function useNotificationActions({
  activeConversation,
  activeConversationPartnerId,
  activeThread,
  activeTab,
  currentUser,
  notificationsKey,
  threadQueryKey,
}: UseNotificationActionsOptions): UseNotificationActionsResult {
  const queryClient = useQueryClient();

  const markNotificationRead = useCallback(
    async (notification: NotificationItem) => {
      const previousSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);

      // Apply an optimistic update so the notification appears read instantly.
      if (previousSnapshot) {
        queryClient.setQueryData<MessagingSnapshot>(
          notificationsKey,
          markNotificationReadInSnapshot(previousSnapshot, notification.id)
        );
      }

      try {
        const response = await fetch(`/api/notifications/${notification.id}/read`, {
          method: "PATCH",
        });

        if (!response.ok) {
          throw new Error("Failed to mark notification read");
        }
      } catch (error) {
        console.error("Failed to mark notification read:", error);
        // Roll back optimistic changes when the server update fails.
        if (previousSnapshot) {
          queryClient.setQueryData(notificationsKey, previousSnapshot);
        }
      }
    },
    [notificationsKey, queryClient]
  );

  const markAllRead = useCallback(async () => {
    const previousSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);

    // Mark all notifications as read immediately for a fast response.
    if (previousSnapshot) {
      queryClient.setQueryData<MessagingSnapshot>(
        notificationsKey,
        markAllNotificationsReadInSnapshot(previousSnapshot)
      );
    }

    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }
    } catch (error) {
      console.error("Failed to mark all notifications read:", error);
      if (previousSnapshot) {
        queryClient.setQueryData(notificationsKey, previousSnapshot);
      }
    }
  }, [notificationsKey, queryClient]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!activeConversation || !currentUser) return;

      const trimmedText = text.trim();
      if (!trimmedText) return;

      const tempId = `temp-message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const optimisticMessage = createOptimisticMessage({
        id: tempId,
        from: currentUser,
        to: activeConversation.partner,
        text: trimmedText,
      });

      const previousSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);
      const previousThread = activeConversationPartnerId
        ? queryClient.getQueryData<MessageThreadSnapshot>(threadQueryKey)
        : undefined;

      // Render the new message immediately in both the notifications snapshot
      // and the current conversation thread while the network request is pending.

      if (previousSnapshot) {
        queryClient.setQueryData<MessagingSnapshot>(
          notificationsKey,
          appendMessageToSnapshot(previousSnapshot, optimisticMessage)
        );
      }

      if (previousThread) {
        queryClient.setQueryData<MessageThreadSnapshot>(
          threadQueryKey,
          appendMessageToThread(previousThread, optimisticMessage)
        );
      }

      try {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toUserId: activeConversation.partner.id,
            text: trimmedText,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const data = await response.json().catch(() => null);
        const message = data?.value as Message | undefined;

        if (message && previousSnapshot) {
          queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
            if (!current) return current;
            return replaceMessageInSnapshot(current, tempId, message);
          });
        }

        if (message && previousThread) {
          queryClient.setQueryData<MessageThreadSnapshot>(threadQueryKey, (current) => {
            if (!current) return current;
            return replaceMessageInThread(current, tempId, message);
          });
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        // Revert optimistic updates if the message could not be sent.
        if (previousSnapshot) {
          queryClient.setQueryData(notificationsKey, previousSnapshot);
        }
        if (previousThread) {
          queryClient.setQueryData(threadQueryKey, previousThread);
        }
      }
    },
    [activeConversation, activeConversationPartnerId, currentUser, notificationsKey, queryClient, threadQueryKey]
  );

  const markedReadRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      activeTab !== "messages" ||
      !currentUser ||
      !activeConversation ||
      activeThread.messages.length === 0
    ) {
      return;
    }

    const hasUnreadIncoming = activeThread.messages.some(
    (message) => message.fromId !== currentUser.id && !message.isRead
    );
    if (!hasUnreadIncoming) return;

    const markKey = activeConversation.partner.id;
    if (markedReadRef.current === markKey) return;

    // Optimistically mark the current conversation as read when the user views it.
    const previousSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);
    const previousThread = activeConversationPartnerId
      ? queryClient.getQueryData<MessageThreadSnapshot>(threadQueryKey)
      : undefined;
    markedReadRef.current = markKey;

    if (previousSnapshot) {
      queryClient.setQueryData<MessagingSnapshot>(
        notificationsKey,
        markConversationMessagesReadInSnapshot(previousSnapshot, currentUser.id, activeConversation.partner.id)
      );
    }

    if (previousThread && activeConversationPartnerId) {
      queryClient.setQueryData<MessageThreadSnapshot>(
        threadQueryKey,
        markConversationMessagesReadInThread(previousThread, currentUser.id, activeConversation.partner.id)
      );
    }

    void fetch(`/api/messages/${activeConversation.partner.id}/read`, {
      method: "PATCH",
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to mark conversation read");
      }
    }).catch((error) => {
      console.error("Failed to mark conversation read:", error);
      markedReadRef.current = null;
      if (previousSnapshot) {
        queryClient.setQueryData(notificationsKey, previousSnapshot);
      }
      if (previousThread && activeConversationPartnerId) {
        queryClient.setQueryData(threadQueryKey, previousThread);
      }
    });
  }, [
    activeConversation,
    activeConversationPartnerId,
    activeThread.messages,
    activeTab,
    currentUser,
    notificationsKey,
    queryClient,
    threadQueryKey,
  ]);

  return {
    markNotificationRead,
    markAllRead,
    sendMessage,
  };
}
