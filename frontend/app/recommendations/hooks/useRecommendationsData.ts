"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchRecommendationsSnapshot } from "@/services/recommendations/recommendations.client";
import { RECOMMENDATIONS_CONFIG } from "../lib/constants";
import type { RecommendationsSnapshot } from "../lib/types";


const EMPTY_SNAPSHOT: RecommendationsSnapshot = {
  topPicks: [],
  trending: [],
  similar: [],
  updatedAt: 0,
};

/**
 * Loads the recommendations snapshot and keeps it refreshed when review events are emitted.
 */
export function useRecommendationsData() {
  const recommendationsQuery = useQuery<RecommendationsSnapshot>({
    queryKey: queryKeys.recommendations.home(),
    queryFn: fetchRecommendationsSnapshot,
    enabled: true,
    retry: RECOMMENDATIONS_CONFIG.API_RETRY_ATTEMPTS,
  });

  const refetchRef = useRef(recommendationsQuery.refetch);
  useEffect(() => {
    refetchRef.current = recommendationsQuery.refetch;
  }, [recommendationsQuery.refetch]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      eventSource = new EventSource(RECOMMENDATIONS_CONFIG.REVIEW_EVENTS_PATH);
      // Debounce review-updated events so the recommendations cache refreshes once per burst of activity.
      eventSource.addEventListener("review-updated", () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        refreshTimer = setTimeout(
          () => {
            void refetchRef.current();
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
  }, []);

  return {
    snapshot: recommendationsQuery.data ?? EMPTY_SNAPSHOT,
    isLoading: recommendationsQuery.isPending,
    error: recommendationsQuery.error,
    refetch: recommendationsQuery.refetch,
  };
}