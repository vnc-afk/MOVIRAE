"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  if (!response.ok) {
    throw new Error(`Failed to load notifications (status ${response.status})`);
  }
  const json = await response.json().catch(() => null);
  return Array.isArray(json?.value) ? json.value : [];
}

async function fetchMessagesPage(offset: number) {
  const response = await fetch(`/api/data/user-messages?limit=${PAGE_LIMIT}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Failed to load messages (status ${response.status})`);
  }
  const json = await response.json().catch(() => null);
  return Array.isArray(json?.value) ? json.value : [];
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

  const fetchedSnapshot = useMemo(
    () => ({ items, messages, users, sessionEmail }),
    [items, messages, users, sessionEmail]
  );

  // Seed the shared notifications cache after each successful fetch so that
  // optimistic updates and SSE writes can be merged into the same snapshot.
  useEffect(() => {
    queryClient.setQueryData<MessagingSnapshot>(notificationsKey, fetchedSnapshot);
  }, [notificationsKey, queryClient, fetchedSnapshot]);

  // FIX: this is the piece that was missing entirely. The component used to
  // render `fetchedSnapshot` directly — a value derived ONLY from the raw
  // paginated/user queries above. Every optimistic update elsewhere
  // (markNotificationRead, markAllRead, sendMessage, the SSE
  // notification-created/message-created handlers) wrote to
  // `notificationsKey` via queryClient.setQueryData, but nothing subscribed
  // to that key for rendering — so those writes were invisible until an
  // unrelated refetch happened to independently reflect the same change
  // from the server.
  //
  // Subscribing here makes notificationsKey the actual source of truth:
  // fetchedSnapshot seeds it on every real fetch, and this subscription
  // picks up both those seeds and any direct optimistic writes other hooks
  // make to the same key — which is exactly the pattern already used
  // correctly for threadQueryKey in useConversationThread.
  const cachedSnapshotQuery = useQuery<MessagingSnapshot>({
    queryKey: notificationsKey,
    queryFn: () => queryClient.getQueryData<MessagingSnapshot>(notificationsKey) ?? fetchedSnapshot,
    enabled: false, // never auto-fetches; this is a read-only subscription
    initialData: () => queryClient.getQueryData<MessagingSnapshot>(notificationsKey) ?? fetchedSnapshot,
    staleTime: Infinity,
  });

  const snapshot = cachedSnapshotQuery.data ?? fetchedSnapshot;

  // Use the cached snapshot as the render source of truth for notification UI.
  // This ensures the component observes updates written directly to `notificationsKey`.

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