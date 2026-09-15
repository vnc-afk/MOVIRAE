"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildSoundtrackUrl, parseSoundtrackQuery } from "../lib/url-state";
import type { SoundtrackQuery } from "../lib/types";

export function useSoundtracksUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState<SoundtrackQuery>(() => parseSoundtrackQuery(searchParams));

  useEffect(() => {
    const next = parseSoundtrackQuery(searchParams);
    setQuery((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, [searchParams]);

  useEffect(() => {
    const nextUrl = buildSoundtrackUrl(pathname, query);
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams}` : pathname;
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [pathname, query, router, searchParams]);

  const updateQuery = useCallback((patch: Partial<SoundtrackQuery>) => {
    setQuery((current) => ({ ...current, ...patch }));
  }, []);

  const setSearch = useCallback((search: string) => updateQuery({ search, page: 1 }), [updateQuery]);
  const setPage = useCallback((page: number) => updateQuery({ page }), [updateQuery]);
  const setSelectedId = useCallback((selectedId: number | null) => updateQuery({ selectedId }), [updateQuery]);

  return {
    query,
    setSearch,
    setPage,
    setSelectedId,
  };
}
