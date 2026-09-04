"use client";

import { useCallback, useRef, useState } from "react";
import type { CalendarDataSource } from "../lib/calendarData";
import type { CalendarEvent } from "../lib/types";

export function useCalendarPagination(source: CalendarDataSource, deduplicate: (events: CalendarEvent[]) => CalendarEvent[], pageSize = 20) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const reset = useCallback(() => {
    pageRef.current = 0;
    hasMoreRef.current = true;
    setEvents([]);
    setHasMore(true);
  }, []);

  const loadNext = useCallback(async (month: string) => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const page = await source.fetchPage(month, pageRef.current + 1, pageSize);
      const unique = deduplicate(page);
      pageRef.current += 1;
      setEvents((current) => [...current, ...unique]);
      const nextHasMore = page.length === pageSize && unique.length > 0;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Unable to load calendar items."));
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [deduplicate, pageSize, source]);

  return { events, isLoading, hasMore, error, loadNext, reset };
}