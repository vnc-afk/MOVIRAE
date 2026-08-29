/**
 * Badge configuration and computation
 * Isolated for easy testing and modification
 */

import type { UserStats } from "@/lib/types";
import { BADGE_CONFIG } from "./constants";

export interface BadgeConfig {
  id: string;
  condition: (stats: UserStats) => boolean;
  label: string;
  icon: string;
}

// FIX: thresholds now reference BADGE_CONFIG (constants.ts) instead of
// duplicating the same magic numbers a second time — previously this file
// and constants.ts each hardcoded 100/10/14/3/5 independently, which meant
// a threshold change in one place silently wouldn't apply to the other.
export const BADGE_DEFINITIONS: BadgeConfig[] = [
  {
    id: "cinephile",
    condition: (stats) => stats.totalWatched >= BADGE_CONFIG.CINEPHILE_THRESHOLD,
    label: "Cinephile",
    icon: "🎬",
  },
  {
    id: "moviegoer",
    condition: (stats) =>
      stats.totalWatched >= BADGE_CONFIG.MOVIEGOER_THRESHOLD &&
      stats.totalWatched < BADGE_CONFIG.CINEPHILE_THRESHOLD,
    label: "Moviegoer",
    icon: "🎬",
  },
  {
    id: "streak-master",
    condition: (stats) => stats.longestStreak >= BADGE_CONFIG.STREAK_MASTER_THRESHOLD,
    label: "Streak Master",
    icon: "🔥",
  },
  {
    id: "rising-streak",
    condition: (stats) =>
      stats.longestStreak >= BADGE_CONFIG.RISING_STREAK_THRESHOLD &&
      stats.longestStreak < BADGE_CONFIG.STREAK_MASTER_THRESHOLD,
    label: "Rising Streak",
    icon: "🔥",
  },
  {
    id: "world-explorer",
    condition: (stats) => stats.countriesExplored >= BADGE_CONFIG.WORLD_EXPLORER_THRESHOLD,
    label: "World Explorer",
    icon: "🌍",
  },
  {
    id: "traveler",
    condition: (stats) =>
      stats.countriesExplored > 0 && stats.countriesExplored < BADGE_CONFIG.WORLD_EXPLORER_THRESHOLD,
    label: "Traveler",
    icon: "🌍",
  },
  {
    id: "genre-fan",
    condition: (stats) => !!stats.favoriteGenre,
    label: "", // Dynamic based on favoriteGenre
    icon: "⭐",
  },
];

export function computeEarnedBadges(stats: UserStats): string[] {
  const badges = BADGE_DEFINITIONS.filter((badge) => badge.condition(stats)).map((badge) => {
    if (badge.id === "genre-fan") {
      return `${badge.icon} ${stats.favoriteGenre} Fan`;
    }
    return `${badge.icon} ${badge.label}`;
  });

  return badges.length > 0 ? badges : ["👀 Explorer"];
}