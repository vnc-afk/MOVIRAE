"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RECOMMENDATIONS_CONFIG } from "../lib/constants";
import type { RecommendationSectionKey } from "../lib/types";

function parseSectionKey(value: string | null): RecommendationSectionKey {
  if (value === "top-picks" || value === "similar" || value === "trending") {
    return value;
  }

  return RECOMMENDATIONS_CONFIG.DEFAULT_SECTION;
}

export function useRecommendationsUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSection = parseSectionKey(searchParams?.get(RECOMMENDATIONS_CONFIG.SECTION_QUERY_PARAM) ?? null);

  const [activeSection, setActiveSectionState] = useState<RecommendationSectionKey>(urlSection);

  useEffect(() => {
    const nextSection = parseSectionKey(searchParams?.get(RECOMMENDATIONS_CONFIG.SECTION_QUERY_PARAM) ?? null);
    if (nextSection !== activeSection) {
      setActiveSectionState(nextSection);
    }
  }, [activeSection, searchParams]);

  useEffect(() => {
    if (!searchParams?.has(RECOMMENDATIONS_CONFIG.SECTION_QUERY_PARAM)) {
      router.replace(
        `${pathname}?${RECOMMENDATIONS_CONFIG.SECTION_QUERY_PARAM}=${RECOMMENDATIONS_CONFIG.DEFAULT_SECTION}`,
        { scroll: false }
      );
    }
  }, [pathname, router, searchParams]);

  const setActiveSection = useCallback(
    (section: RecommendationSectionKey) => {
      setActiveSectionState(section);

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set(RECOMMENDATIONS_CONFIG.SECTION_QUERY_PARAM, section);

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return {
    activeSection,
    setActiveSection,
  };
}
