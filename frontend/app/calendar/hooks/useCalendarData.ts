"use client";

import { useEffect, useMemo } from "react";
import { createCalendarDataSource } from "../lib/calendarData";
import { useCalendarDedupe } from "./useCalendarDedupe";
import { useCalendarPagination } from "./useCalendarPagination";

export function useCalendarData(month: string) {
  const source = useMemo(() => createCalendarDataSource(), []);
  const { deduplicate, reset } = useCalendarDedupe();
  const pagination = useCalendarPagination(source, deduplicate, 100);

  useEffect(() => {
    reset();
    pagination.reset();
    void pagination.loadNext(month);
  }, [month, pagination.loadNext, pagination.reset, reset]);

  return pagination;
}