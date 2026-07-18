import type { Movie } from "@/lib/types";

export interface FilterState {
  query: string;
  genreId: string;
  runtimeRange: [number, number];
  sortBy: "rating" | "year" | "title" | "runtime";
}


export interface GenreOption {
  id: number;
  name: string;
}

export interface FilterPreset {
  id: string; 
  name: string; 
  filters: {
    genreId?: string;
    minRuntime?: number;
    maxRuntime?: number;
  };
}

export interface PaginationState {
  currentPage: number; 
  hasMore: boolean; 
  isFetching: boolean; 
}

export interface PaginationStateWithError extends PaginationState {
  error: Error | null;
}

export interface DiscoverState {
  movies: Movie[];
  isLoading: boolean;
  error: Error | null;
}

export const SORT_OPTIONS = [
  { value: "rating" as const, label: "Highest Rated" },
  { value: "year" as const, label: "Newest" },
  { value: "title" as const, label: "A-Z" },
  { value: "runtime" as const, label: "Shortest First" },
] as const;

export interface MovieWithMetadata extends Omit<Movie, "rating" | "year" | "runtime"> {
  rating?: number;
  year?: number;
  runtime?: number;
}


export interface PaginatedResponse<T> {
  results: T[];
  total_pages: number;
  total_results: number;
  page: number;
}


export interface HookErrorState {
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
}