/**
 * SimilarMoviesSection Component
 * Displays similar movies carousel
 */

import { SimilarMovies } from "@/components/SimilarMovies";
import type { Movie } from "@/lib/types";

interface SimilarMoviesSectionProps {
  movies: Movie[];
}

export function SimilarMoviesSection({ movies }: SimilarMoviesSectionProps) {
  if (!movies || movies.length === 0) {
    return null;
  }

  return <SimilarMovies movies={movies} />;
}
