import type { Movie } from "@/lib/types";

export function dedupeMovies(movies: Movie[], seen = new Set<string>()): Movie[] {
  return movies.filter((movie) => {
    if (seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
}