"use client";

import { MovieCard } from "./MovieCard";
import type { Movie } from "@/data/mockData";

interface SimilarMoviesProps {
  movies: Movie[];
}

export function SimilarMovies({ movies }: SimilarMoviesProps) {
  if (movies.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold text-foreground mb-4">
        Similar Movies
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {movies.map((movie, i) => (
          <MovieCard key={movie.id} movie={movie} index={i} />
        ))}
      </div>
    </section>
  );
}
