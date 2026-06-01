import { getAppData, setAppData } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { getMovieDetailsBatch } from "@/lib/tmdb";
import { getWatchExperienceStats } from "@/lib/watch-experiences";
import type { ActivityItem, Movie, UserProfile } from "@/lib/types";

const AGGREGATION_CACHE_TTL_MS = 60 * 1000;

const WEEKDAY_ORDER = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type CachedAggregation<T> = {
  generatedAt: string;
  value: T;
};

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

function buildUserProfile(user: any): UserProfile {
  const displayName = user?.displayName || user?.name || user?.email?.split("@")[0] || "Movie Lover";
  const username = user?.username || displayName.toLowerCase().replace(/\s+/g, "_");

  return {
    id: user?.id ?? "",
    email: user?.email || undefined,
    username,
    displayName,
    avatar: user?.avatar || user?.image || "",
    bio: user?.bio || "",
    followers: 0,
    following: 0,
    reviewCount: 0,
    watchlistCount: 0,
    favoriteMovies: [],
  };
}

function normalizeLabel(value: string | null | undefined) {
  if (!value) return "";
  return value.trim();
}

function isKnownValue(value: string | null | undefined) {
  const normalized = normalizeLabel(value);
  return normalized !== "" && normalized.toLowerCase() !== "unknown";
}

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

async function getCachedAggregation<T>(key: string, builder: () => Promise<T>): Promise<T> {
  const cached = await getAppData<CachedAggregation<T> | null>(key, null);

  if (cached && cached.generatedAt) {
    const ageMs = Date.now() - new Date(cached.generatedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < AGGREGATION_CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const value = await builder();
  await setAppData(key, { generatedAt: new Date().toISOString(), value } satisfies CachedAggregation<T>);
  return value;
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

  const monthlyCounts = watchExperienceStats.monthlyBreakdown.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.month] = entry.count;
    return acc;
  }, {});

  const weekdayCounts = watchExperienceStats.weekdayBreakdown.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.day] = entry.count;
    return acc;
  }, {});

  const platformCounts = watchExperienceStats.platformBreakdown.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.platform] = entry.count;
    return acc;
  }, {});

  const contextCounts = watchExperienceStats.contextBreakdown.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.context] = entry.count;
    return acc;
  }, {});

  const moodCounts = watchExperienceStats.moodBreakdown.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.mood] = entry.count;
    return acc;
  }, {});

  const ratingCounts = reviews.reduce<Record<number, number>>((acc, review) => {
    acc[review.rating] = (acc[review.rating] ?? 0) + 1;
    return acc;
  }, {});

  const totalRuntimeMinutes = watchedMovies.reduce((sum, movie) => {
    if (!Number.isFinite(movie.runtime) || movie.runtime <= 0) return sum;
    return sum + movie.runtime;
  }, 0);

  const genreCounts = watchedMovies.reduce<Record<string, number>>((acc, movie) => {
    const sources = Array.isArray(movie.tags) && movie.tags.length > 0 ? movie.tags : [movie.genre];

    for (const source of sources) {
      const genre = normalizeLabel(source);
      if (!isKnownValue(genre)) continue;
      acc[genre] = (acc[genre] ?? 0) + 1;
    }

    return acc;
  }, {});

  const genreTotal = Object.values(genreCounts).reduce((sum, count) => sum + count, 0);
  const genreBreakdown = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({
      genre,
      count,
      pct: genreTotal > 0 ? Math.round((count / genreTotal) * 100) : 0,
    }));

  const directorCounts = watchedMovies.reduce<Record<string, number>>((acc, movie) => {
    const director = normalizeLabel(movie.director);
    if (!isKnownValue(director)) return acc;
    acc[director] = (acc[director] ?? 0) + 1;
    return acc;
  }, {});

  const topDirector = Object.entries(directorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const countriesExplored = new Set(
    watchedMovies
      .map((movie) => normalizeLabel(movie.country))
      .filter((country) => isKnownValue(country))
  ).size;

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
    monthlyBreakdown: Object.entries(monthlyCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count })),
    genreBreakdown,
    ratingDistribution: Object.entries(ratingCounts)
      .map(([stars, count]) => ({ stars: Number(stars), count }))
      .sort((a, b) => a.stars - b.stars),
    moodBreakdown: Object.entries(moodCounts)
      .map(([mood, count]) => ({ mood, count }))
      .sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood)),
    platformBreakdown: Object.entries(platformCounts)
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count || a.platform.localeCompare(b.platform)),
    contextBreakdown: Object.entries(contextCounts)
      .map(([context, count]) => ({ context, count }))
      .sort((a, b) => b.count - a.count || a.context.localeCompare(b.context)),
    weekdayBreakdown: Object.entries(weekdayCounts)
      .map(([day, count]) => ({ day, count }))
      .sort(
        (a, b) =>
          WEEKDAY_ORDER.indexOf(a.day as (typeof WEEKDAY_ORDER)[number]) -
          WEEKDAY_ORDER.indexOf(b.day as (typeof WEEKDAY_ORDER)[number])
      ),
  };
}

async function buildHomeActivityFeedSnapshot(): Promise<ActivityItem[]> {
  const reviews = await prisma.review.findMany({
    select: {
      id: true,
      tmdbId: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const watchlist = await prisma.userWatchlistItem.findMany({
    select: {
      id: true,
      tmdbId: true,
      addedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
        },
      },
    },
    orderBy: { addedAt: "desc" },
    take: 8,
  });

  const feedItems = [
    ...reviews.map((review) => ({
      id: `review-${review.id}` as const,
      action: "reviewed" as const,
      user: buildUserProfile(review.user),
      movieId: review.tmdbId,
      rating: review.rating,
      comment: review.comment ?? undefined,
      date: review.createdAt.toISOString(),
    })),
    ...watchlist.map((watch) => ({
      id: `watch-${watch.id}` as const,
      action: "added_to_watchlist" as const,
      user: buildUserProfile(watch.user),
      movieId: watch.tmdbId,
      date: watch.addedAt.toISOString(),
    })),
  ];

  const uniqueMovieIds = Array.from(new Set(feedItems.map((item) => item.movieId))).slice(0, 10);
  const movies = await getMovieDetailsBatch(uniqueMovieIds);
  const movieMap = new Map(movies.map((movie) => [movie.id, movie]));

  return feedItems
    .filter((item) => movieMap.has(item.movieId))
    .map((item) => {
      const base = {
        id: item.id,
        action: item.action,
        user: item.user!,
        movie: movieMap.get(item.movieId)!,
        date: item.date,
      };

      if (item.action === "reviewed") {
        return {
          ...base,
          rating: item.rating,
          comment: item.comment,
        };
      }

      return base;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1)) as ActivityItem[];
}

export async function getUserStatsSnapshot(userId: string) {
  return getCachedAggregation(`user-stats:${userId}`, () => buildUserStatsSnapshot(userId));
}

export async function refreshUserStatsSnapshot(userId: string) {
  return buildUserStatsSnapshot(userId).then((value) => setAppData(`user-stats:${userId}`, {
    generatedAt: new Date().toISOString(),
    value,
  } satisfies CachedAggregation<UserStatsSnapshot>));
}

export async function getHomeActivityFeedSnapshot() {
  return getCachedAggregation("home-activity-feed", buildHomeActivityFeedSnapshot);
}

export async function refreshHomeActivityFeedSnapshot() {
  return buildHomeActivityFeedSnapshot().then((value) => setAppData("home-activity-feed", {
    generatedAt: new Date().toISOString(),
    value,
  } satisfies CachedAggregation<ActivityItem[]>));
}
