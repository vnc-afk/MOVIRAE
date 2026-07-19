"use client";

import { useMemo } from "react";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";
import { fetchMessageThread } from "@/lib/messaging";
import type { MessageThreadSnapshot } from "@/lib/messaging";

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

  const threadQuery = usePrefetchAwareQuery<MessageThreadSnapshot>({
    queryKey: threadQueryKey,
    queryFn: async () => fetchMessageThread(activeConversationPartnerId as string),
    enabled: enabled && Boolean(activeConversationPartnerId),
    staleTime: 30_000,
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
