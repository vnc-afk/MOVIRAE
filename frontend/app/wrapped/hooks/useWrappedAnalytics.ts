/**
 * useWrappedAnalytics Hook
 *
 * Responsibilities:
 * - Queue analytics events
 * - Track slide views, interactions
 * - Batch send events for efficiency
 *
 * Testable: Yes (mock analytics API)
 * Pure: Mostly (side effects in useEffect for batching)
 */

import { useCallback, useRef, useEffect } from "react";
import type { AnalyticsEvent } from "../lib/types";

interface UseWrappedAnalyticsOptions {
  userId?: string;
  enabled?: boolean;
}

const BATCH_INTERVAL = 5000;
const MAX_QUEUED_EVENTS = 200; // NEW

export function useWrappedAnalytics(
  options: UseWrappedAnalyticsOptions = {}
) {
  const { userId, enabled = true } = options;
  const eventsQueueRef = useRef<AnalyticsEvent[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Flush queued events to analytics backend
  const flushEvents = useCallback(async () => {
    if (eventsQueueRef.current.length === 0 || !enabled) {
      return;
    }

    const events = eventsQueueRef.current;
    eventsQueueRef.current = [];

    try {
      await fetch("/api/telemetry/wrapped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          events,
          timestamp: Date.now(),
        }),
      });
      // ...inside flushEvents' catch block:
      } catch (error) {
        console.error("[Wrapped Analytics] Failed to flush events:", error);
        eventsQueueRef.current.unshift(...events);
        // FIX: without a cap, a sustained outage means every failed flush keeps
        // re-queuing on top of newly-tracked events forever. Trim from the
        // front (oldest) so the queue can't grow without bound — losing some
        // old analytics events during an extended outage is an acceptable
        // trade-off against unbounded memory growth.
        if (eventsQueueRef.current.length > MAX_QUEUED_EVENTS) {
          eventsQueueRef.current = eventsQueueRef.current.slice(-MAX_QUEUED_EVENTS);
        }
      }
  }, [userId, enabled]);

  // Queue an event
  const trackEvent = useCallback(
    (
      event: AnalyticsEvent["event"],
      slideId: string,
      metadata?: Record<string, unknown>
    ) => {
      if (!enabled) return;

      eventsQueueRef.current.push({
        event,
        slideId,
        timestamp: Date.now(),
        metadata,
      });

      // Reset batch timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(flushEvents, BATCH_INTERVAL);
    },
    [enabled, flushEvents]
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      void flushEvents();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [flushEvents]);

  return {
    trackEvent,
    flushEvents,
  };
}
