
import { memo } from "react";
import { SimilarMovies } from "@/components/SimilarMovies";
import type { Movie } from "@/lib/types";

interface SimilarMoviesSectionProps {
  movies: Movie[];
}

/**
 * Shows recommended similar movies on the detail page when available.
 * Memoized to avoid re-renders when the parent component updates.
 */
export const SimilarMoviesSection = memo(function SimilarMoviesSection({ movies }: SimilarMoviesSectionProps) {
  if (!movies || movies.length === 0) {
    return null;
  }
  return <SimilarMovies movies={movies} />;
});
