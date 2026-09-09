"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { Message, NotificationItem, UserProfile } from "@/lib/types";
import type { MessagingSnapshot } from "@/lib/features/messages/service";
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

async function fetchNotificationsPage(cursor: string | null) {
  const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/notifications?limit=${PAGE_LIMIT}${cursorParam}`);
  if (!response.ok) {
    throw new Error(`Failed to load notifications (status ${response.status})`);
  }
  const json = await response.json().catch(() => null);
  return { value: Array.isArray(json?.value) ? json.value : [], nextCursor: json?.nextCursor ?? null };
}

async function fetchMessagesPage(cursor: string | null) {
  const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/messages/list?limit=${PAGE_LIMIT}${cursorParam}`);
  if (!response.ok) {
    throw new Error(`Failed to load messages (status ${response.status})`);
  }
  const json = await response.json().catch(() => null);
  return { value: Array.isArray(json?.value) ? json.value : [], nextCursor: json?.nextCursor ?? null };
}

async function fetchUsers() {
  const response = await fetch("/api/users");
  if (!response.ok) {
    throw new Error(`Failed to load users (status ${response.status})`);
  }
  const json = await response.json().catch(() => null);
  return Array.isArray(json?.value) ? json.value : [];
}

/**
 * Loads paginated notifications, messages, and user profiles for the notifications page.
 *
 * The hook also maintains a shared snapshot cache keyed by `notificationsKey` so
 * optimistic updates and SSE-driven updates can be rendered immediately.
 */
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
    fetchPage: fetchNotificationsPage,
  });

  const messagesQuery = usePaginatedApi<Message>({
    queryKey: ["messages", "paged", sessionIdOrEmail ?? "anonymous"],
    fetchPage: fetchMessagesPage,
  });

  const usersQuery = useQuery<UserProfile[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: true,
  });

  const notificationPages = notificationsQuery.data?.pages.map((page) => page.value) ?? [];
  const messagePages = messagesQuery.data?.pages.map((page) => page.value) ?? [];
  const users = usersQuery.data ?? [];

  const items = useSnapshotDedup(notificationPages);
  const messages = useSnapshotDedup(messagePages);

  const fetchedSnapshot = useMemo(
    () => ({ items, messages, users, sessionEmail }),
    [items, messages, users, sessionEmail]
  );

  const hasAnySnapshotData = Boolean(notificationsQuery.data || messagesQuery.data || usersQuery.data);

  function areSnapshotsEqual(
    left: MessagingSnapshot,
    right: MessagingSnapshot
  ) {
    if (left === right) return true;
    if (left.sessionEmail !== right.sessionEmail) return false;
    if (left.items.length !== right.items.length) return false;
    if (left.messages.length !== right.messages.length) return false;
    if (left.users.length !== right.users.length) return false;

    for (let i = 0; i < left.items.length; i += 1) {
      if (left.items[i].id !== right.items[i].id) return false;
    }

    for (let i = 0; i < left.messages.length; i += 1) {
      if (left.messages[i].id !== right.messages[i].id) return false;
    }

    for (let i = 0; i < left.users.length; i += 1) {
      if (left.users[i].id !== right.users[i].id) return false;
    }

    return true;
  }

  useEffect(() => {
    if (!hasAnySnapshotData) return;

    const currentSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);
    if (currentSnapshot && areSnapshotsEqual(currentSnapshot, fetchedSnapshot)) {
      return;
    }

    queryClient.setQueryData<MessagingSnapshot>(notificationsKey, fetchedSnapshot);
  }, [hasAnySnapshotData, notificationsKey, queryClient, fetchedSnapshot]);

  const cachedSnapshotQuery = useQuery<MessagingSnapshot>({
    queryKey: notificationsKey,
    queryFn: () => queryClient.getQueryData<MessagingSnapshot>(notificationsKey) ?? fetchedSnapshot,
    enabled: false,
    initialData: () => queryClient.getQueryData<MessagingSnapshot>(notificationsKey) ?? fetchedSnapshot,
    staleTime: Infinity,
  });

  const snapshot = cachedSnapshotQuery.data ?? fetchedSnapshot;
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
      if (notificationsQuery.hasNextPage) await notificationsQuery.fetchNextPage();
    },
    fetchNextMessages: async () => {
      if (messagesQuery.hasNextPage) await messagesQuery.fetchNextPage();
    },
    refetchNotifications: () => notificationsQuery.refetch(),
    refetchMessages: () => messagesQuery.refetch(),
    notificationsKey,
  };
}