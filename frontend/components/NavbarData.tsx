"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import useEventSource from "@/hooks/use-event-source";
import { appendNotificationToSnapshot, buildConversationSummaries, fetchMessagingSnapshot, getCurrentUserFromSnapshot, type MessagingSnapshot } from "@/services/messages/messages.client";
import { queryKeys } from "@/lib/queryKeys";
import type { NotificationItem } from "@/lib/types";
import { useNavbarDataActions } from "./NavbarContext";

export default function NavbarData() {
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const { setUnreadCount } = useNavbarDataActions();
  const _user = (session?.user as any) ?? {};
  const sessionIdOrEmail = _user.id ?? _user.email ?? null;
  const notificationsKey = useMemo(() => queryKeys.notifications.all(sessionIdOrEmail), [sessionIdOrEmail]);

  const notificationsQuery = useQuery<MessagingSnapshot>({
    queryKey: notificationsKey,
    queryFn: fetchMessagingSnapshot,
    enabled: true,
  });

  useEventSource(
    "/api/notifications/events",
    {
      "notification-created": (ev) => {
        try {
          const payload = JSON.parse(ev.data) as { recipientId?: string; notification?: NotificationItem };
          const currentSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);
          const currentUser = currentSnapshot ? getCurrentUserFromSnapshot(currentSnapshot) : null;

          if (currentSnapshot && currentUser && payload.recipientId && payload.notification && payload.recipientId === currentUser.id) {
            queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
              if (!current) return current;
              return appendNotificationToSnapshot(current, payload.notification as NotificationItem);
            });
            return;
          }

          void notificationsQuery.refetch();
        } catch (error) {
          console.error("Navbar notification cache update failed:", error);
        }
      },
    },
    { enabled: status === "authenticated", onError: () => {} }
  );

  useEffect(() => {
    const snapshot = notificationsQuery.data;
    const currentUser = snapshot ? getCurrentUserFromSnapshot(snapshot) : null;
    const unreadNotificationCount = snapshot?.items.filter((notification) => !notification.read).length ?? 0;
    const unreadMessageCount = snapshot && currentUser ? buildConversationSummaries(snapshot, currentUser.id).reduce((total, conversation) => total + conversation.unreadCount, 0) : 0;

    setUnreadCount(unreadNotificationCount + unreadMessageCount);
  }, [notificationsQuery.data, setUnreadCount]);

  return null;
}
