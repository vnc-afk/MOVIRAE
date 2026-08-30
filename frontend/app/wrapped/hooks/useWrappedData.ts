/**
 * useWrappedData Hook
 *
 * Responsibilities:
 * - Fetch wrapped stats from API
 * - Manage real-time updates via EventSource
 * - Handle cache invalidation
 * - Memoize results
 *
 * Testable: Yes (mock fetch and EventSource)
 * Pure: Mostly (side effects isolated to useEffect)
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { queryKeys } from "@/lib/queryKeys";
import type { UserStats } from "@/lib/types";
import { WRAPPED_CONFIG } from "../lib/constants";

interface UseWrappedDataOptions {
  enabled?: boolean;
}

export function useWrappedData(options: UseWrappedDataOptions = {}) {
  const { enabled = true } = options;
  const { data: session, status } = useSession();
  const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const sessionKey = session?.user?.email ?? null;

  // Generate stable query key
  const wrappedQueryKey = useMemo(
    () => [...queryKeys.wrapped.current(), sessionKey ?? "anonymous"] as const,
    [sessionKey]
  );

  // Main query
  const query = useQuery<UserStats | null>({
    queryKey: wrappedQueryKey,
    queryFn: async () => {
      try {
        const response = await fetch("/api/wrapped", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.success ? data.data ?? null : null;
      } catch (error) {
        console.error("[Wrapped] Failed to fetch stats:", error);
        return null;
      }
    },
    enabled: enabled && status === "authenticated",
  });

  // Real-time subscription via EventSource
  useEffect(() => {
    if (!enabled || status !== "authenticated") {
      return;
    }

    const setupEventSource = () => {
      try {
        const eventSource = new EventSource("/api/reviews/events");

        eventSource.addEventListener("review-updated", () => {
          // Debounce refetch to avoid excessive updates
          if (refetchTimerRef.current) {
            clearTimeout(refetchTimerRef.current);
          }

          refetchTimerRef.current = setTimeout(() => {
            void query.refetch();
          }, WRAPPED_CONFIG.REFETCH_DELAY);
        });

        eventSourceRef.current = eventSource;
      } catch (error) {
        console.error("[Wrapped] Failed to setup EventSource:", error);
      }
    };

    setupEventSource();

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [enabled, status, query]);

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
