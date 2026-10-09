import { describe, expect, it } from "vitest";

import { computeEarnedBadges } from "@/app/wrapped/lib/badges";
import { formatActivityDate, formatActivityRange, formatHours, formatRating, formatStatsForDisplay } from "@/app/wrapped/lib/formatters";
import { getMaxValue, getPeakWeekday, getSummaryTitle, processWrappedStats, transformMoodDataForRadar } from "@/app/wrapped/lib/processors";
import type { UserStats } from "@/lib/types";

const stats = (overrides: Partial<UserStats> = {}): UserStats => ({
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
  ...overrides,
});

describe("wrapped data utilities", () => {
  it("formats display values and handles missing dates", () => {
    expect(formatActivityDate("2025-01-02T00:00:00Z")).toBe("Jan 2, 2025");
    expect(formatActivityDate(null)).toBeNull();
    expect(formatActivityRange("2025-01-02", "2025-01-04")).toBe("from Jan 2, 2025 to Jan 4, 2025");
    expect(formatActivityRange(null, "2025-01-04")).toBeNull();
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(1.4)).toBe("1 h");
    expect(formatHours(1200)).toBe("1.2k h");
    expect(formatRating(8)).toBe("8.0");
    expect(formatStatsForDisplay(3, 12, 8.25, 2)).toEqual({
      films: "3",
      hours: "12 h",
      rating: "8.3",
      countries: "2",
    });
  });

  it("computes processor boundaries and derived wrapped stats", () => {
    expect(getPeakWeekday([])).toBeNull();
    expect(getPeakWeekday([{ day: "Mon", count: 2 }, { day: "Tue", count: 5 }])).toEqual({ day: "Tue", count: 5 });
    expect(getMaxValue([])).toBe(1);
    expect(getMaxValue([{ count: 0 }, { count: 4 }])).toBe(4);
    expect(getSummaryTitle(0)).toBe("You're a Curious Viewer");
    expect(transformMoodDataForRadar([{ mood: "Fun", count: 3 }])).toEqual([{ mood: "Fun", value: 3 }]);

    const result = processWrappedStats(stats({
      totalWatched: 10,
      totalHours: 20,
      favoriteGenre: "Drama",
      weekdayBreakdown: [{ day: "Friday", count: 4 }],
      activityStart: "2025-01-01",
      activityEnd: "2025-12-31",
    }));
    expect(result.derived.peakWeekday).toEqual({ day: "Friday", count: 4 });
    expect(result.derived.wrappedYear).toBe(2025);
    expect(result.derived.badges).toContain("🎬 Moviegoer");
    expect(result.derived.badges).toContain("⭐ Drama Fan");
  });

  it("returns a fallback badge when no achievement is earned", () => {
    expect(computeEarnedBadges(stats())).toEqual(["👀 Explorer"]);
  });

  it("awards badges at exact thresholds without awarding higher tiers early", () => {
    expect(computeEarnedBadges(stats({ totalWatched: 10 }))).toContain("🎬 Moviegoer");
    expect(computeEarnedBadges(stats({ totalWatched: 99 }))).toContain("🎬 Moviegoer");
    expect(computeEarnedBadges(stats({ totalWatched: 100 }))).toContain("🎬 Cinephile");
    expect(computeEarnedBadges(stats({ totalWatched: 100 }))).not.toContain("🎬 Moviegoer");
    expect(computeEarnedBadges(stats({ longestStreak: 3 }))).toContain("🔥 Rising Streak");
    expect(computeEarnedBadges(stats({ longestStreak: 14 }))).toContain("🔥 Streak Master");
    expect(computeEarnedBadges(stats({ countriesExplored: 5 }))).toContain("🌍 World Explorer");
  });

  it("uses empty defaults when wrapped stats are unavailable", () => {
    expect(processWrappedStats(null)).toMatchObject({
      stats: { totalWatched: 0, totalHours: 0 },
      derived: {
        wrappedYear: new Date().getFullYear(),
        activityStartLabel: null,
        activityEndLabel: null,
        peakWeekday: null,
        maxPlatformCount: 1,
        maxContextCount: 1,
        summaryTitle: "You're a Curious Viewer",
        badges: ["👀 Explorer"],
      },
    });
  });
});
