import type { CalendarEvent } from "./types";

export interface CalendarDataSource {
  fetchPage: (month: string, page: number, pageSize: number) => Promise<CalendarEvent[]>;
}

export function createCalendarDataSource(): CalendarDataSource {
  return {
    fetchPage: async (month, page, pageSize) => {
      const response = await fetch(`/api/calendar?month=${encodeURIComponent(month)}&page=${page}&limit=${pageSize}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view your calendar." : "Unable to load calendar items.");
      const payload = await response.json() as {
        success?: boolean;
        data?: { value?: CalendarEvent[] };
        error?: { message?: string };
      };
      if (!payload.success) throw new Error(payload.error?.message ?? "Unable to load calendar items.");
      return Array.isArray(payload.data?.value) ? payload.data.value : [];
    },
  };
}