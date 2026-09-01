import type { Mood, WatchContext, WatchPlatform } from "@/lib/types";

export const WATCH_PLATFORMS = [
  "Cinema",
  "Netflix",
  "Amazon Prime",
  "Hulu",
  "Disney+",
  "Apple TV+",
  "HBO Max",
  "Blu-ray",
  "DVD",
] as const satisfies readonly WatchPlatform[];

export const WATCH_CONTEXTS = [
  "Solo",
  "With Friends",
  "Date Night",
  "Family",
  "Movie Club",
] as const satisfies readonly WatchContext[];

export const WATCH_MOODS = [
  "Thrilling",
  "Relaxing",
  "Romantic",
  "Dark",
  "Uplifting",
  "Thought-Provoking",
  "Fun",
  "Intense",
] as const satisfies readonly Mood[];
