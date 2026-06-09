"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";
import type { Message, NotificationItem, UserProfile } from "@/lib/types";
import type { MessagingSnapshot } from "@/lib/messaging";
import { usePaginatedApi } from "./usePaginatedApi";
import { useSnapshotDedup } from "./useSnapshotDedup";
import { PAGE_LIMIT } from "../lib/constants";

interface NotificationsDataResult {
  notificationPages: NotificationItem[][];
  messagePages: Message[][];
  users: UserProfile[];
  snapshot: MessagingSnapshot;
  notificationsHasMore: boolean;
  messagesHasMore: boolean;
  isLoadingNotifications: boolean;
  isLoadingMessages: boolean;
  isFetchingNotifications: boolean;
  isFetchingMessages: boolean;
  fetchNextNotifications: () => Promise<void>;
  fetchNextMessages: () => Promise<void>;
  refetchNotifications: () => Promise<unknown>;
  refetchMessages: () => Promise<unknown>;
  notificationsKey: readonly unknown[];
}

async function fetchNotificationsPage(offset: number) {
  const response = await fetch(`/api/data/user-notifications?limit=${PAGE_LIMIT}&offset=${offset}`);
  const json = await response.json().catch(() => null);
  return Array.isArray(json?.value) ? json.value : [];
}

async function fetchMessagesPage(offset: number) {
  const response = await fetch(`/api/data/user-messages?limit=${PAGE_LIMIT}&offset=${offset}`);
  const json = await response.json().catch(() => null);
  return Array.isArray(json?.value) ? json.value : [];
}

async function fetchUsers() {
  const response = await fetch("/api/users");
  const json = await response.json().catch(() => null);
  return Array.isArray(json?.value) ? json.value : [];
}

export function useNotificationsData(
  sessionIdOrEmail: string | null,
  sessionEmail: string | null
): NotificationsDataResult {
  const queryClient = useQueryClient();
  const notificationsKey = useMemo(
    () => queryKeys.notifications.all(sessionIdOrEmail),
    [sessionIdOrEmail]
  );

  const notificationsQuery = usePaginatedApi<NotificationItem>({
    queryKey: ["notifications", "paged", sessionIdOrEmail ?? "anonymous"],
    pageLimit: PAGE_LIMIT,
    fetchPage: fetchNotificationsPage,
  });

  const messagesQuery = usePaginatedApi<Message>({
    queryKey: ["messages", "paged", sessionIdOrEmail ?? "anonymous"],
    pageLimit: PAGE_LIMIT,
    fetchPage: fetchMessagesPage,
  });

  const usersQuery = usePrefetchAwareQuery<UserProfile[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: true,
  });

  const notificationPages = notificationsQuery.data?.pages ?? [];
  const messagePages = messagesQuery.data?.pages ?? [];
  const users = usersQuery.data ?? [];

  const items = useSnapshotDedup(notificationPages);
  const messages = useSnapshotDedup(messagePages);

  const snapshot = useMemo(
    () => ({
      items,
      messages,
      users,
      sessionEmail,
    }),
    [items, messages, users, sessionEmail]
  );

  useEffect(() => {
    queryClient.setQueryData<MessagingSnapshot>(notificationsKey, snapshot);
  }, [notificationsKey, queryClient, snapshot]);

  return {
    notificationPages,
    messagePages,
    users,
    snapshot,
    notificationsHasMore: notificationsQuery.hasNextPage ?? false,
    messagesHasMore: messagesQuery.hasNextPage ?? false,
    isLoadingNotifications: notificationsQuery.isLoading,
    isLoadingMessages: messagesQuery.isLoading,
    isFetchingNotifications: notificationsQuery.isFetchingNextPage,
    isFetchingMessages: messagesQuery.isFetchingNextPage,
    fetchNextNotifications: async () => {
      if (notificationsQuery.hasNextPage) {
        await notificationsQuery.fetchNextPage();
      }
    },
    fetchNextMessages: async () => {
      if (messagesQuery.hasNextPage) {
        await messagesQuery.fetchNextPage();
      }
    },
    refetchNotifications: () => notificationsQuery.refetch(),
    refetchMessages: () => messagesQuery.refetch(),
    notificationsKey,
  };
}
