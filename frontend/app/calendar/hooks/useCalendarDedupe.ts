"use client";

import { useCallback, useRef } from "react";
import type { CalendarEvent } from "../lib/types";

export function useCalendarDedupe() {
  const idsRef = useRef(new Set<string>());
  const deduplicate = useCallback((events: CalendarEvent[]) => events.filter((event) => {
    if (idsRef.current.has(event.id)) return false;
    idsRef.current.add(event.id);
    return true;
  }), []);
  const reset = useCallback(() => { idsRef.current = new Set(); }, []);
  return { deduplicate, reset };
}