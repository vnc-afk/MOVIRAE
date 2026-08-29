/**
 * useWrappedFormatters Hook
 *
 * Responsibilities:
 * - Provide memoized formatter instances
 * - Process stats for display
 * - Avoid recreation on re-render
 *
 * Testable: Yes (pure memoization)
 * Pure: Yes (no side effects)
 */

import { useMemo } from "react";
import type { UserStats } from "@/lib/types";
import * as Formatters from "../lib/formatters";
import * as Processors from "../lib/processors";
import * as Badges from "../lib/badges";
import type { ProcessedStats } from "../lib/types";

export function useWrappedFormatters() {
  // Memoize formatter instances
  const formatters = useMemo(
    () => ({
      dateFormatter: Formatters.dateFormatter,
      formatActivityDate: Formatters.formatActivityDate,
      formatActivityRange: Formatters.formatActivityRange,
      formatYear: Formatters.formatYear,
      formatHours: Formatters.formatHours,
      formatRating: Formatters.formatRating,
      formatCountries: Formatters.formatCountries,
      formatStatsForDisplay: Formatters.formatStatsForDisplay,
    }),
    []
  );

  // Memoize processor functions
  const processors = useMemo(
    () => ({
      getPeakWeekday: Processors.getPeakWeekday,
      getMaxValue: Processors.getMaxValue,
      getSummaryTitle: Processors.getSummaryTitle,
      generateBadges: Processors.generateBadges,
      processWrappedStats: Processors.processWrappedStats,
      transformMoodDataForRadar: Processors.transformMoodDataForRadar,
    }),
    []
  );

  // Process stats with memoization
  const processStats = useMemo(
    () => (stats: UserStats | null): ProcessedStats =>
      Processors.processWrappedStats(stats),
    []
  );

  // Get badges with memoization
  const getBadges = useMemo(
    () => (stats: UserStats): string[] =>
      Badges.computeEarnedBadges(stats),
    []
  );

  return {
    formatters,
    processors,
    processStats,
    getBadges,
  };
}
