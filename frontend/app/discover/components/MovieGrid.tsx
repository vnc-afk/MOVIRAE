"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { MovieCard } from "@/components/MovieCard";
import type { Movie } from "@/lib/types";
import { GRID_CONFIG } from "../lib/constants";

interface MovieGridProps {
  movies: Movie[];
  isLoading: boolean;
}

const SkeletonCard = memo(({ index }: { index: number }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{
      duration: 0.2,
      delay: Math.min(index, 5) * 0.02,
      ease: "easeOut",
    }}
    className="space-y-3"
  >
    <div className="aspect-[2/3] overflow-hidden rounded-lg bg-gradient-to-br from-secondary to-secondary/50 poster-shadow">
      <motion.div
        animate={{
          backgroundPosition: ["200% center", "-200% center"],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
        className="w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
        style={{
          backgroundSize: "200% 100%",
        }}
      />
    </div>
    <div className="h-4 rounded bg-secondary" />
    <div className="h-3 w-2/3 rounded bg-secondary/70" />
  </motion.div>
));

SkeletonCard.displayName = "SkeletonCard";

const EmptyState = memo(() => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="text-center py-16"
  >
    <p className="text-muted-foreground">No films match your filters.</p>
  </motion.div>
));

EmptyState.displayName = "EmptyState";

const MovieGridContent = memo(({ movies }: { movies: Movie[] }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
  >
    {movies.map((movie, index) => (
      <MovieCard
        key={movie.id}
        movie={movie}
        index={index}
        priority={index < 12}
        disableEntranceAnimation
      />
    ))}
  </motion.div>
));

MovieGridContent.displayName = "MovieGridContent";

export const MovieGrid = memo(function MovieGrid({
  movies,
  isLoading,
}: MovieGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: GRID_CONFIG.SKELETON_COUNT }).map((_, index) => (
          <SkeletonCard key={`discover-skeleton-${index}`} index={index} />
        ))}
      </div>
    );
  }

  if (movies.length === 0) {
    return <EmptyState />;
  }

  return <MovieGridContent movies={movies} />;
});
