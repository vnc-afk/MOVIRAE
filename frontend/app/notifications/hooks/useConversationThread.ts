"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchMessageThread } from "@/lib/features/messages/service";
import type { MessageThreadSnapshot } from "@/lib/features/messages/service";

interface ConversationThreadResult {
  threadQueryKey: readonly unknown[];
  activeThread: MessageThreadSnapshot;
  isLoadingThread: boolean;
  refetchThread: () => Promise<unknown>;
}

const DEFAULT_THREAD: MessageThreadSnapshot = {
  partner: null,
  messages: [],
  sessionEmail: null,
};

/**
 * Loads the currently selected message thread and keeps it cached by conversation.
 *
 * The hook returns a stable query key, thread data, and a refetch callback. The
 * thread query is only enabled when a conversation partner is selected.
 */
export function useConversationThread(
  activeConversationPartnerId: string | null,
  enabled: boolean
): ConversationThreadResult {
  const threadQueryKey = useMemo(
    () => queryKeys.messaging.thread(activeConversationPartnerId ?? "__idle__"),
    [activeConversationPartnerId]
  );

  const threadQuery = useQuery<MessageThreadSnapshot>({
    queryKey: threadQueryKey,
    queryFn: async () => fetchMessageThread(activeConversationPartnerId as string),
    enabled: enabled && Boolean(activeConversationPartnerId),
    refetchInterval: enabled && activeConversationPartnerId ? 2_000 : false,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    threadQueryKey,
    activeThread: threadQuery.data ?? DEFAULT_THREAD,
    isLoadingThread: threadQuery.isLoading,
    refetchThread: threadQuery.refetch,
  };
}
