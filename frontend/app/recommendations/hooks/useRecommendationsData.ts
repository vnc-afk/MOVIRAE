"use client";

import { useEffect } from "react";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";
import { fetchRecommendationsSnapshot } from "../lib/recommendationsService";
import { RECOMMENDATIONS_CONFIG } from "../lib/constants";
import type { RecommendationsSnapshot } from "../lib/types";

export function useRecommendationsData() {
  const recommendationsQuery = usePrefetchAwareQuery<RecommendationsSnapshot>({
    queryKey: queryKeys.recommendations.home(),
    queryFn: fetchRecommendationsSnapshot,
    enabled: true,
    retry: RECOMMENDATIONS_CONFIG.API_RETRY_ATTEMPTS,
  });

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      eventSource = new EventSource(RECOMMENDATIONS_CONFIG.REVIEW_EVENTS_PATH);
      eventSource.addEventListener("review-updated", () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        refreshTimer = setTimeout(
          () => {
            void recommendationsQuery.refetch();
          },
          RECOMMENDATIONS_CONFIG.REVIEW_REFRESH_DEBOUNCE_MS
        );
      });
    } catch {
      // Best-effort refresh only
    }

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      eventSource?.close();
    };
  }, [recommendationsQuery]);

  return {
    snapshot:
      recommendationsQuery.data ?? {
        topPicks: [],
        trending: [],
        similar: [],
        updatedAt: Date.now(),
      },
    isLoading: recommendationsQuery.isPending,
    error: recommendationsQuery.error,
    refetch: recommendationsQuery.refetch,
  };
}
