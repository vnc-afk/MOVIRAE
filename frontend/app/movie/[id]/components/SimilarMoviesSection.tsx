/**
 * SimilarMoviesSection Component
 * Displays similar movies carousel
 */

import { memo } from "react";
import { SimilarMovies } from "@/components/SimilarMovies";
import type { Movie } from "@/lib/types";

interface SimilarMoviesSectionProps {
  movies: Movie[];
}

export const SimilarMoviesSection = memo(function SimilarMoviesSection({ movies }: SimilarMoviesSectionProps) {
  if (!movies || movies.length === 0) {
    return null;
  }
  return <SimilarMovies movies={movies} />;
});
