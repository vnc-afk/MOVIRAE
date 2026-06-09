"use client";

import { useQueryClient } from "@tanstack/react-query";
import useEventSource from "@/hooks/use-event-source";
import { appendNotificationToSnapshot } from "@/lib/messaging";
import type { MessagingSnapshot } from "@/lib/messaging";
import type { MessageThreadSnapshot } from "@/lib/messaging";
import type { NotificationItem, UserProfile } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";

interface UseNotificationsRealtimeOptions {
  currentUser: UserProfile | null;
  notificationsKey: readonly unknown[];
  activeConversationPartnerId: string | null;
  threadQueryKey: readonly unknown[];
  refetchNotifications: () => Promise<unknown>;
  refetchThread: () => Promise<unknown>;
}

export function useNotificationsRealtime({
  currentUser,
  notificationsKey,
  activeConversationPartnerId,
  threadQueryKey,
  refetchNotifications,
  refetchThread,
}: UseNotificationsRealtimeOptions) {
  const queryClient = useQueryClient();

  useEventSource(
    "/api/notifications/events",
    {
      "notification-created": (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as {
            recipientId?: string;
            notification?: NotificationItem;
          };

          if (
            currentUser &&
            payload.recipientId === currentUser.id &&
            payload.notification
          ) {
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

  useEventSource(
    "/api/messages/events",
    {
      "message-created": async () => {
        try {
          await refetchNotifications();
          if (activeConversationPartnerId) {
            await refetchThread();
          }
        } catch (error) {
          console.error("Failed to update messages from SSE:", error);
        }
      },
      "message-read": async () => {
        try {
          await refetchNotifications();
          if (activeConversationPartnerId) {
            await refetchThread();
          }
        } catch (error) {
          console.error("Failed to update messages from SSE:", error);
        }
      },
    },
    { enabled: true, onError: () => console.error("Messages SSE error") }
  );
}
