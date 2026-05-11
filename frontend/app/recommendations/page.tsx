"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Clock, Star } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { getTrendingMovies, getMoviesByGenre } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";

export default function RecommendationsPage() {
  const [topPicks, setTopPicks] = useState<Movie[]>([]);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const topMovies = await getTrendingMovies(1);
        setTopPicks(topMovies.slice(0, 6));

        const trendingMovies = await getTrendingMovies(2);
        setTrending(trendingMovies.slice(0, 6));

        const actionMovies = await getMoviesByGenre(28, 1); // Action genre
        setSimilar(actionMovies.slice(0, 6));
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, []);

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

        {/* Top picks */}
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
                <MovieCard key={movie.id} movie={movie} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* Because you watched */}
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

        {/* Trending */}
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
