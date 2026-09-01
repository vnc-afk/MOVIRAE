"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import useEventSource from "@/hooks/use-event-source";
import { queryKeys } from "@/lib/queryKeys";
import { fetchUserStats } from "../lib/api-client";
import { STATS_CONFIG } from "../lib/constants";
import type { UserStats } from "@/lib/types";

export function useStatsData() {
  const { data: session, status } = useSession();
  const sessionKey = session?.user?.email ?? "anonymous";
  const statsQueryKey = useMemo(
    () => [...queryKeys.stats.current(), sessionKey] as const,
    [sessionKey]
  );

  const statsQuery = useQuery<UserStats | null>({
    queryKey: statsQueryKey,
    queryFn: fetchUserStats,
    enabled: status === "authenticated",
    retry: STATS_CONFIG.RETRY_ATTEMPTS,
    refetchOnMount: "always",
  });

  useEventSource(
    STATS_CONFIG.EVENTS_PATH,
    {
      "review-updated": () => {
        if (status === "authenticated") {
          void statsQuery.refetch();
        }
      },
    },
    { enabled: status === "authenticated" }
  );

  return {
    data: statsQuery.data ?? null,
    isLoading: statsQuery.isPending,
    error: statsQuery.error,
    refetch: statsQuery.refetch,
    status,
  };
}
