import { getCurrentUser } from "@/app/movie/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { withRedisCached } from "@/lib/redis-cache";
import { getGenres, getMovieDetailsBatch, getMoviesByGenre, getTrendingMovies } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";
import type { RecommendationSectionKey, RecommendationsSnapshot } from "./types";

const PERSONALIZED_SIGNAL_WEIGHTS = {
  favorite: 18,
  watchlist: 7,
  rating4Plus: 12,
  rating3: 6,
  rating2: 2,
  rating1: 1,
  coldStartSignalThreshold: 3,
} as const;

function getRatingWeight(rating: number | undefined): number {
  if (rating == null) {
    return 0;
  }

  if (rating >= 4) {
    return PERSONALIZED_SIGNAL_WEIGHTS.rating4Plus;
  }

  if (rating === 3) {
    return PERSONALIZED_SIGNAL_WEIGHTS.rating3;
  }

  if (rating === 2) {
    return PERSONALIZED_SIGNAL_WEIGHTS.rating2;
  }

  return PERSONALIZED_SIGNAL_WEIGHTS.rating1;
}

async function getPersonalizedSimilarGenreId(): Promise<number | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.id) {
    return null;
  }

  const [reviews, favorites, watchlist] = await Promise.all([
    prisma.review.findMany({
      where: { userId: currentUser.id },
      select: { tmdbId: true, rating: true },
    }),
    prisma.userFavoriteMovie.findMany({
      where: { userId: currentUser.id },
      select: { tmdbId: true },
    }),
    prisma.userWatchlistItem.findMany({
      where: { userId: currentUser.id },
      select: { tmdbId: true },
    }),
  ]);

  const totalSignals = reviews.length + favorites.length + watchlist.length;
  if (totalSignals < PERSONALIZED_SIGNAL_WEIGHTS.coldStartSignalThreshold) {
    return null;
  }

  const tmdbIds = Array.from(
    new Set([
      ...reviews.map((review) => review.tmdbId),
      ...favorites.map((favorite) => favorite.tmdbId),
      ...watchlist.map((item) => item.tmdbId),
    ])
  );

  if (tmdbIds.length === 0) {
    return null;
  }

  const [genreCatalog, movies] = await Promise.all([
    getGenres({ suppressClientErrors: true }),
    getMovieDetailsBatch(tmdbIds, { suppressClientErrors: true }),
  ]);

  if (genreCatalog.length === 0 || movies.length === 0) {
    return null;
  }

  const genreNameToId = new Map(genreCatalog.map((genre) => [genre.name.toLowerCase(), genre.id]));
  const genreScores = new Map<number, number>();
  const favoriteIds = new Set(favorites.map((favorite) => favorite.tmdbId));
  const watchlistIds = new Set(watchlist.map((item) => item.tmdbId));
  const reviewScoreByMovie = new Map(reviews.map((review) => [review.tmdbId, review.rating]));

  for (const movie of movies) {
    const reviewWeight = getRatingWeight(reviewScoreByMovie.get(movie.id));
    const signalScore =
      (favoriteIds.has(movie.id) ? PERSONALIZED_SIGNAL_WEIGHTS.favorite : 0) +
      (watchlistIds.has(movie.id) ? PERSONALIZED_SIGNAL_WEIGHTS.watchlist : 0) +
      reviewWeight;

    if (signalScore === 0) {
      continue;
    }

    for (const tag of movie.tags) {
      const genreId = genreNameToId.get(tag.toLowerCase());
      if (genreId == null) {
        continue;
      }

      genreScores.set(genreId, (genreScores.get(genreId) ?? 0) + signalScore);
    }
  }

  if (genreScores.size === 0) {
    return null;
  }

  const [bestGenreId] = [...genreScores.entries()].sort(([, scoreA], [, scoreB]) => scoreB - scoreA)[0];
  return bestGenreId ?? null;
}

async function getPersonalizedSimilarMovies(page: number): Promise<Movie[]> {
  const genreId = await getPersonalizedSimilarGenreId();
  if (genreId == null) {
    return await getTrendingMovies(page);
  }

  return await getMoviesByGenre(genreId, page);
}

export async function getRecommendationsSnapshot(): Promise<RecommendationsSnapshot> {
  return withRedisCached(
    "recommendations",
    "snapshot",
    async () => {
      const [topPicks, trending, similar] = await Promise.all([
        getTrendingMovies(1),
        getTrendingMovies(2),
        getPersonalizedSimilarMovies(1),
      ]);

      return {
        topPicks,
        trending,
        similar,
        updatedAt: Date.now(),
      };
    },
    180
  );
}

export async function getRecommendationsPage(
  section: RecommendationSectionKey,
  page: number
): Promise<Movie[]> {
  const cacheKey = `${section}:${page}`;

  return withRedisCached(
    "recommendations",
    `page:${cacheKey}`,
    async () => {
      switch (section) {
        case "top-picks":
          return await getTrendingMovies(page);
        case "similar":
          return await getPersonalizedSimilarMovies(page);
        case "trending":
          return await getTrendingMovies(page);
        default:
          return [];
      }
    },
    180
  );
}
