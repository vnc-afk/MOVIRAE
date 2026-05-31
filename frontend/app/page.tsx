"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { MovieCard } from "@/components/MovieCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SearchInput } from "@/components/SearchInput";
import { getTrendingMovies } from "@/lib/tmdb";
import { queryKeys } from "@/lib/queryKeys";
import type { ActivityItem, Movie } from "@/lib/types";
import heroBackdrop from "@/assets/hero-backdrop.jpg";

export default function Home() {
  const trendingQuery = usePrefetchAwareQuery<Movie[]>({
    queryKey: queryKeys.discover.seeds(),
    queryFn: () => getTrendingMovies(),
    enabled: true,
  });

  const activityQuery = usePrefetchAwareQuery<ActivityItem[]>({
    queryKey: queryKeys.home.activityFeed(),
    queryFn: async () => {
      const response = await fetch("/api/data/home-activity-feed");
      const data = await response.json();
      return Array.isArray(data?.value) ? data.value : [];
    },
    enabled: true,
  });

  const movies = trendingQuery.data ?? [];
  const activities = activityQuery.data ?? [];
  const loading = trendingQuery.isPending || activityQuery.isPending;

  return (
    <div className="pb-20 md:pb-0">
      {/* Hero section */}
      <section className="relative h-[340px] md:h-[420px] overflow-hidden">
        <img
          src={heroBackdrop.src}
          alt="Cinema backdrop"
          width={1920}
          height={800}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative container flex flex-col items-center justify-center h-full text-center gap-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-3xl md:text-5xl font-bold text-foreground"
          >
            Track films you&apos;ve watched.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-muted-foreground text-sm md:text-base max-w-md"
          >
            Save those you want to see. Tell your friends what&apos;s good.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full max-w-md md:hidden"
          >
            <SearchInput />
          </motion.div>
        </div>
      </section>

      <div className="container mt-8 space-y-12">
        {/* Trending movies */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-bold text-foreground">
              Trending This Week
            </h2>
            <button className="text-xs text-primary font-medium hover:underline">
              See all
            </button>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-secondary h-48 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {movies.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} index={i} priority={i < 4} />
              ))}
            </div>
          )}
        </section>

        {/* Activity feed */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-5">
            Friends Activity
          </h2>
          <div className="max-w-2xl">
            <ActivityFeed activities={activities} />
          </div>
        </section>
      </div>
    </div>
  );
}
