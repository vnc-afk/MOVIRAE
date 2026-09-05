"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useEventSource from "@/hooks/use-event-source";
import {
  appendMessageToSnapshot,
  appendNotificationToSnapshot,
  markConversationMessagesReadInSnapshot,
  markConversationMessagesReadInThread,
} from "@/lib/features/messages/service";
import type { MessageThreadSnapshot, MessagingSnapshot } from "@/lib/features/messages/service";
import type { NotificationItem, UserProfile } from "@/lib/types";
import { useMessageWebSocket } from "./useMessageWebSocket";

interface UseNotificationsRealtimeOptions {
  currentUser: UserProfile | null;
  notificationsKey: readonly unknown[];
  activeConversationPartnerId: string | null;
  threadQueryKey: readonly unknown[];
  refetchNotifications: () => Promise<unknown>;
}

/**
 * Subscribes to the notification SSE channel and message WebSocket, keeping
 * React Query cache in sync with server-side events.
 */
export function useNotificationsRealtime({
  currentUser,
  notificationsKey,
  activeConversationPartnerId,
  threadQueryKey,
  refetchNotifications,
}: UseNotificationsRealtimeOptions) {
  const queryClient = useQueryClient();
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEventSource(
    "/api/notifications/events",
    {
      "notification-created": (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as {
            recipientId?: string;
            notification?: NotificationItem;
          };

          if (!currentUser) return;

          // Ignore events that are not intended for the current authenticated user.
          if (payload.recipientId !== currentUser.id) {
            return; 
          }

          if (payload.notification) {
            queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
              if (!current) return current;
              return appendNotificationToSnapshot(current, payload.notification as NotificationItem);
            });
            return;
          }
          void refetchNotifications();
        } catch (error) {
          console.error("Failed to update notifications from SSE:", error);
        }
      },
    },
    { enabled: true, onError: () => console.error("Notifications SSE error") }
  );

  const sendTyping = useMessageWebSocket(
    async (event) => {
      if (
        (event.type === "typing-start" || event.type === "typing-stop") &&
        event.toId === currentUser?.id &&
        event.fromId === activeConversationPartnerId
      ) {
        setIsPartnerTyping(event.type === "typing-start");
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (event.type === "typing-start") {
          typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 2500);
        }
        return;
      }

      if (event.type !== "message-created" && event.type !== "message-read") return;

      try {
        const activeConversationKey = currentUser && activeConversationPartnerId
          ? [currentUser.id, activeConversationPartnerId].sort().join(":")
          : null;
        const isActiveConversation = event.conversationKey === activeConversationKey;

        const createdMessage = event.message;
        if (event.type === "message-created" && createdMessage) {
          queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
            if (!current) return current;
            return appendMessageToSnapshot(current, createdMessage);
          });

          if (isActiveConversation) {
            queryClient.setQueryData<MessageThreadSnapshot>(threadQueryKey, (current) => {
              if (!current || current.messages.some((message) => message.id === createdMessage.id)) {
                return current;
              }
              return {
                ...current,
                messages: [...current.messages, createdMessage],
              };
            });
          }
        } else if (event.type === "message-read" && event.fromId && event.toId) {
          queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
            if (!current) return current;
            return markConversationMessagesReadInSnapshot(current, event.fromId!, event.toId!);
          });

          if (isActiveConversation) {
            queryClient.setQueryData<MessageThreadSnapshot>(threadQueryKey, (current) => {
              if (!current) return current;
              return markConversationMessagesReadInThread(current, event.fromId!, event.toId!);
            });
          }
        }
      } catch (error) {
        console.error("Failed to update messages from WebSocket:", error);
      }
    },
    { enabled: Boolean(currentUser), userId: currentUser?.id }
  );

  useEffect(() => {
    setIsPartnerTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [activeConversationPartnerId]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, []);

  return { isPartnerTyping, sendTyping };
}
