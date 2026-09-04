"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CalendarQuery, CalendarView } from "../lib/types";

const currentMonth = new Date();
const DEFAULT_QUERY: CalendarQuery = {
  month: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`,
  view: "calendar",
};

function parseQuery(params: URLSearchParams): CalendarQuery {
  const rawMonth = params.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : DEFAULT_QUERY.month;
  return { month, view: params.get("view") === "list" ? "list" : "calendar" };
}

export function useCalendarUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => parseQuery(searchParams));

  useEffect(() => {
    const next = parseQuery(searchParams);
    setQuery((current) => current.month === next.month && current.view === next.view ? current : next);
  }, [searchParams]);

  const updateQuery = useCallback((patch: Partial<CalendarQuery>) => {
    setQuery((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ month: query.month });
    if (query.view !== DEFAULT_QUERY.view) params.set("view", query.view);
    const nextUrl = `${pathname}?${params.toString()}`;
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [pathname, query, router, searchParams]);

  return {
    query,
    setView: (view: CalendarView) => updateQuery({ view }),
    setMonth: (month: string) => updateQuery({ month }),
  };
}