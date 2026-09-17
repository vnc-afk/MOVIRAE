"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildAssistantUrl, readAssistantQuery } from "../lib/url-state";

export function useAssistantUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQueryState] = useState(() => readAssistantQuery(searchParams));

  useEffect(() => {
    const nextQuery = readAssistantQuery(searchParams);
    setQueryState((current) => (current === nextQuery ? current : nextQuery));
  }, [searchParams]);

  const setQuery = useCallback((nextQuery: string) => {
    const normalized = nextQuery.trim();
    setQueryState(normalized);
    const nextUrl = buildAssistantUrl(pathname, normalized);
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams}` : pathname;
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  return { query, setQuery };
}