import { prisma } from "@/lib/prisma";
import { getMovieDetailsBatch } from "@/lib/tmdb";
import { getWatchExperienceStats } from "@/lib/features/watch/experiences";
import { getAppData } from "@/lib/app-data";
import { getCachedAggregation, setCachedAggregation } from "@/lib/aggregation-cache";
import { isKnownValue, normalizeLabel } from "@/lib/aggregation-utils";

const WEEKDAY_ORDER = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type UserStatsSnapshot = {
  totalWatched: number;
  totalHours: number;
  avgRating: number;
  favoriteGenre: string;
  topDirector: string;
  longestStreak: number;
  countriesExplored: number;
  activityStart: string | null;
  activityEnd: string | null;
  monthlyBreakdown: Array<{ month: string; count: number }>;
  genreBreakdown: Array<{ genre: string; count: number; pct: number }>;
  ratingDistribution: Array<{ stars: number; count: number }>;
  moodBreakdown: Array<{ mood: string; count: number }>;
  platformBreakdown: Array<{ platform: string; count: number }>;
  contextBreakdown: Array<{ context: string; count: number }>;
  weekdayBreakdown: Array<{ day: string; count: number }>;
};

function getDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function computeLongestStreak(values: Date[]) {
  const uniqueDays = Array.from(new Set(values.map((value) => getDayKey(value)))).sort();
  if (uniqueDays.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < uniqueDays.length; i += 1) {
    const previous = new Date(`${uniqueDays[i - 1]}T00:00:00.000Z`).getTime();
    const currentDay = new Date(`${uniqueDays[i]}T00:00:00.000Z`).getTime();
    const dayDifference = (currentDay - previous) / (1000 * 60 * 60 * 24);

    if (dayDifference === 1) {
      current += 1;
      longest = Math.max(longest, current);
      continue;
    }

    current = 1;
  }

  return longest;
}

function buildBreakdown(counts: Record<string, number>, sortFn = (a: [string, number], b: [string, number]) => b[1] - a[1]) {
  return Object.entries(counts)
    .sort(sortFn)
    .map(([label, count]) => ({ label, count }));
}

function buildGenreBreakdown(
  watchedMovies: Array<{ genre: string; tags?: string[] }>
) {
  const genreCounts = watchedMovies.reduce<Record<string, number>>((acc, movie) => {
    const sources = Array.isArray(movie.tags) && movie.tags.length > 0 ? movie.tags : [movie.genre];

    for (const source of sources) {
      const genre = normalizeLabel(source);
      if (!isKnownValue(genre)) continue;
      acc[genre] = (acc[genre] ?? 0) + 1;
    }

    return acc;
  }, {});

  const genreTotal = Object.values(genreCounts).reduce((sum: number, count: number) => sum + count, 0);
  return buildBreakdown(genreCounts).map(({ label, count }) => ({
    genre: label,
    count,
    pct: genreTotal > 0 ? Math.round((count / genreTotal) * 100) : 0,
  }));
}

function buildDirectorStats(watchedMovies: Array<{ director: string }>) {
  const directorCounts = watchedMovies.reduce<Record<string, number>>((acc, movie) => {
    const director = normalizeLabel(movie.director);
    if (!isKnownValue(director)) return acc;
    acc[director] = (acc[director] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(directorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function buildCountriesExplored(watchedMovies: Array<{ country: string }>) {
  return new Set(
    watchedMovies
      .map((movie) => normalizeLabel(movie.country))
      .filter((country) => isKnownValue(country))
  ).size;
}

function buildRatingDistribution(reviews: Array<{ rating: number }>) {
  const ratingCounts = reviews.reduce<Record<number, number>>((acc, review) => {
    acc[review.rating] = (acc[review.rating] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(ratingCounts)
    .map(([stars, count]) => ({ stars: Number(stars), count: Number(count) }))
    .sort((a, b) => a.stars - b.stars);
}

async function buildUserStatsSnapshot(userId: string): Promise<UserStatsSnapshot> {
  const [reviews, watchExperienceStats, watchedMovieIds] = await Promise.all([
    prisma.review.findMany({
      where: { userId },
      select: { rating: true },
      orderBy: { createdAt: "desc" },
    }),
    getWatchExperienceStats(userId),
    getAppData<string[]>(`user-watched-${userId}`, []),
  ]);

  const watchedMovieIdSet = new Set([
    ...watchedMovieIds,
    ...watchExperienceStats.records.map((entry) => entry.tmdbId),
  ]);

  const watchedMovies = await getMovieDetailsBatch(Array.from(watchedMovieIdSet));
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

  const totalRuntimeMinutes = watchedMovies.reduce((sum, movie) => {
    if (!Number.isFinite(movie.runtime) || movie.runtime <= 0) return sum;
    return sum + movie.runtime;
  }, 0);

  const genreBreakdown = buildGenreBreakdown(watchedMovies);
  const topDirector = buildDirectorStats(watchedMovies);
  const countriesExplored = buildCountriesExplored(watchedMovies);
  const ratingDistribution = buildRatingDistribution(reviews);

  const watchDates = watchExperienceStats.records
    .map((record) => (record.watchedAt instanceof Date ? record.watchedAt : new Date(record.watchedAt)))
    .filter((value) => !Number.isNaN(value.getTime()));

  const longestStreak = computeLongestStreak(watchDates);
  const sortedWatchDates = [...watchDates].sort((left, right) => left.getTime() - right.getTime());

  return {
    totalWatched: watchedMovieIdSet.size,
    totalHours: Number((totalRuntimeMinutes / 60).toFixed(1)),
    avgRating,
    favoriteGenre: genreBreakdown[0]?.genre ?? "",
    topDirector,
    longestStreak,
    countriesExplored,
    activityStart: sortedWatchDates[0]?.toISOString() ?? null,
    activityEnd: sortedWatchDates.at(-1)?.toISOString() ?? null,
    monthlyBreakdown: watchExperienceStats.monthlyBreakdown
      .slice()
      .sort((a, b) => a.month.localeCompare(b.month)),
    genreBreakdown,
    ratingDistribution,
    moodBreakdown: watchExperienceStats.moodBreakdown
      .slice()
      .sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood)),
    platformBreakdown: watchExperienceStats.platformBreakdown
      .slice()
      .sort((a, b) => b.count - a.count || a.platform.localeCompare(b.platform)),
    contextBreakdown: watchExperienceStats.contextBreakdown
      .slice()
      .sort((a, b) => b.count - a.count || a.context.localeCompare(b.context)),
    weekdayBreakdown: watchExperienceStats.weekdayBreakdown
      .slice()
      .sort(
        (a, b) =>
          WEEKDAY_ORDER.indexOf(a.day as (typeof WEEKDAY_ORDER)[number]) -
          WEEKDAY_ORDER.indexOf(b.day as (typeof WEEKDAY_ORDER)[number])
      ),
  };
}

export async function getUserStatsSnapshot(userId: string) {
  return getCachedAggregation(`user-stats:${userId}`, () => buildUserStatsSnapshot(userId));
}

export async function refreshUserStatsSnapshot(userId: string) {
  const value = await buildUserStatsSnapshot(userId);
  await setCachedAggregation(`user-stats:${userId}`, value);
  return value;
}
