import type { UserStats, Mood } from "@/lib/types";
import type { ProcessedStats } from "./types";
import { formatActivityDate, formatYear } from "./formatters";
import { computeEarnedBadges } from "./badges";
import { SUMMARY_THRESHOLDS } from "./constants";

/**
 * Pure data processors - no side effects, pure functions
 */

export function getPeakWeekday(
  weekdayBreakdown: Array<{ day: string; count: number }>
): { day: string; count: number } | null {
  if (weekdayBreakdown.length === 0) return null;

  return weekdayBreakdown.reduce((best, entry) => {
    if (!best || entry.count > best.count) return entry;
    return best;
  }, weekdayBreakdown[0]);
}

export function getMaxValue(data: Array<{ count: number }>): number {
  if (data.length === 0) return 1;
  return Math.max(1, ...data.map((entry) => entry.count));
}

export function getSummaryTitle(totalWatched: number): string {
  for (const config of SUMMARY_THRESHOLDS) {
    if (totalWatched >= config.threshold) {
      return config.title;
    }
  }
  return "You're a Curious Viewer";
}

// FIX: generateBadges deleted — this was a second, independent
// implementation of the exact same logic now living in lib/badges.ts's
// computeEarnedBadges. processWrappedStats below calls that instead.

export function processWrappedStats(stats: UserStats | null): ProcessedStats {
  const emptyStats: UserStats = {
    totalWatched: 0,
    totalHours: 0,
    avgRating: 0,
    favoriteGenre: "",
    topDirector: "",
    longestStreak: 0,
    countriesExplored: 0,
    monthlyBreakdown: [],
    genreBreakdown: [],
    ratingDistribution: [],
    moodBreakdown: [],
    platformBreakdown: [],
    contextBreakdown: [],
    weekdayBreakdown: [],
  };

  const safeStats = stats ?? emptyStats;

  return {
    stats: safeStats,
    derived: {
      wrappedYear: formatYear(safeStats.activityEnd),
      activityStartLabel: formatActivityDate(safeStats.activityStart),
      activityEndLabel: formatActivityDate(safeStats.activityEnd),
      peakWeekday: getPeakWeekday(safeStats.weekdayBreakdown),
      maxPlatformCount: getMaxValue(safeStats.platformBreakdown),
      maxContextCount: getMaxValue(safeStats.contextBreakdown),
      summaryTitle: getSummaryTitle(safeStats.totalWatched),
      badges: computeEarnedBadges(safeStats),
    },
  };
}

export function transformMoodDataForRadar(moodBreakdown: Array<{ mood: Mood; count: number }>) {
  return moodBreakdown.map((m) => ({
    mood: m.mood,
    value: m.count,
  }));
}