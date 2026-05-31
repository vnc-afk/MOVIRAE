"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Clock, Star } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { getTrendingMovies, getMoviesByGenre } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";

type RecommendationsSnapshot = {
  topPicks: Movie[];
  trending: Movie[];
  similar: Movie[];
  updatedAt: number;
};

export default function RecommendationsPage() {
  const recommendationsQuery = usePrefetchAwareQuery<RecommendationsSnapshot>({
    queryKey: queryKeys.recommendations.home(),
    queryFn: async () => {
      const topMovies = await getTrendingMovies(1);
      const trendingMovies = await getTrendingMovies(2);
      const actionMovies = await getMoviesByGenre(28, 1);

      return {
        topPicks: topMovies.slice(0, 6),
        trending: trendingMovies.slice(0, 6),
        similar: actionMovies.slice(0, 6),
        updatedAt: Date.now(),
      };
    },
    enabled: true,
  });

  const snapshot = recommendationsQuery.data ?? {
    topPicks: [],
    trending: [],
    similar: [],
    updatedAt: 0,
  };

  const topPicks = snapshot.topPicks;
  const trending = snapshot.trending;
  const similar = snapshot.similar;
  const loading = recommendationsQuery.isPending;

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let refreshTimer: number | null = null;

    try {
      eventSource = new EventSource("/api/reviews/events");
      eventSource.addEventListener("review-updated", () => {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          void recommendationsQuery.refetch();
        }, 500);
      });
    } catch {
      /* best-effort */
    }

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      eventSource?.close();
    };
  }, [recommendationsQuery]);

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_: unknown, i: number) => (
        <div key={i} className="bg-secondary h-48 rounded-lg animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              For You
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Personalized picks based on your watch history & ratings.
          </p>
        </motion.div>

        <section>
          <div className="flex items-center gap-2 mb-5">
            <Star className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Top Picks for You
            </h2>
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topPicks.map((movie: Movie, i: number) => (
                <MovieCard key={movie.id} movie={movie} index={i} priority={i < 4} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Similar to Popular Movies
            </h2>
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {similar.map((movie: Movie, i: number) => (
                <MovieCard key={movie.id} movie={movie} index={i} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Trending Now
            </h2>
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {trending.map((movie: Movie, i: number) => (
                <MovieCard key={movie.id} movie={movie} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
