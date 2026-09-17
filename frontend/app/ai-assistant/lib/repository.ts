import type { Movie } from "@/lib/types";
import type { MoviePageFetcher } from "./types";

export const fetchAssistantMovies: MoviePageFetcher = async (query, page, signal) => {
  const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}&page=${page}`, { signal });
  if (!response.ok) throw new Error("Unable to load movie recommendations");
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as Movie[]) : [];
};