import type { Movie } from "@/lib/types";

/**
 * Represents the current discover filter state and the selected sorting mode.
 */
export interface FilterState {
  query: string;
  genreId: string;
  runtimeRange: [number, number];
  sortBy: "rating" | "year" | "title" | "runtime";
  moods: string[];
  tags: string[];
  languages: string[];
  countries: string[];
}

export interface DiscoverMetadata {
  native: {
    genres: string[];
    languages: string[];
    countries: string[];
  };
  derived: {
    moods: string[];
    tags: string[];
  };
}

/**
 * A TMDB genre entry that can be rendered as a selectable chip in the discover UI.
 */
export interface GenreOption {
  id: number;
  name: string;
}

/**
 * A saved discover preset that captures the most important filter dimensions.
 */
export interface FilterPreset {
  id: string; 
  name: string; 
  filters: {
    genreId?: string;
    minRuntime?: number;
    maxRuntime?: number;
    moods?: string[];
    tags?: string[];
    languages?: string[];
    countries?: string[];
  };
}

/**
 * Tracks the current pagination position and loading state for a paged movie request.
 */
export interface PaginationState {
  currentPage: number; 
  hasMore: boolean; 
  isFetching: boolean; 
}

/**
 * Adds an optional request error to the pagination state for the discover page.
 */
export interface PaginationStateWithError extends PaginationState {
  error: Error | null;
}

/**
 * Represents the minimal movie list state used by the discover page shell.
 */
export interface DiscoverState {
  movies: Movie[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Preset order for the sort selector UI.
 */
export const SORT_OPTIONS = [
  { value: "rating" as const, label: "Highest Rated" },
  { value: "year" as const, label: "Newest" },
  { value: "title" as const, label: "A-Z" },
  { value: "runtime" as const, label: "Shortest First" },
] as const;

/**
 * Extends a movie with optional metadata fields that may be missing in partial API responses.
 */
export interface MovieWithMetadata extends Omit<Movie, "rating" | "year" | "runtime"> {
  rating?: number;
  year?: number;
  runtime?: number;
}

/**
 * Describes the generic pagination payload shape returned by paged TMDB-style APIs.
 */
export interface PaginatedResponse<T> {
  results: T[];
  total_pages: number;
  total_results: number;
  page: number;
}


/**
 * Normalizes common loading and error flags for hooks that surface asynchronous data.
 */
export interface HookErrorState {
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
}