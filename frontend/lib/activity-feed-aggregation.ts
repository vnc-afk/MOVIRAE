import { prisma } from "@/lib/prisma";
import { getMovieDetailsBatch } from "@/lib/tmdb";
import { buildUserProfile } from "@/lib/aggregation-utils";
import { getCachedAggregation, setCachedAggregation } from "@/lib/aggregation-cache";
import type { ActivityItem } from "@/lib/types";

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

  type ReviewFeedItem = {
    id: string;
    tmdbId: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      username: string | null;
      displayName: string | null;
      avatar: string | null;
      bio: string | null;
    };
  };

  type WatchlistFeedItem = {
    id: string;
    tmdbId: string;
    addedAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      username: string | null;
      displayName: string | null;
      avatar: string | null;
      bio: string | null;
    };
  };

  const feedItems = [
    ...reviews.map((review: ReviewFeedItem) => ({
      id: `review-${review.id}` as const,
      action: "reviewed" as const,
      user: buildUserProfile(review.user),
      movieId: review.tmdbId,
      rating: review.rating,
      comment: review.comment ?? undefined,
      date: review.createdAt.toISOString(),
    })),
    ...watchlist.map((watch: WatchlistFeedItem) => ({
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
    .filter((item) => movieMap.has(item.movieId) && item.user)
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

export async function getHomeActivityFeedSnapshot() {
  return getCachedAggregation("home-activity-feed", buildHomeActivityFeedSnapshot);
}

export async function refreshHomeActivityFeedSnapshot() {
  const value = await buildHomeActivityFeedSnapshot();
  await setCachedAggregation("home-activity-feed", value);
  return value;
}
