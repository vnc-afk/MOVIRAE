import type { Movie } from "@/lib/types";

/**
 * Discover filter state
 * Stores all user-configurable filters for movie discovery
 */
export interface FilterState {
  query: string;
  genreId: string;
  runtimeRange: [number, number];
  sortBy: "rating" | "year" | "title" | "runtime";
}

/**
 * Genre option from TMDB API
 */
export interface GenreOption {
  id: number;
  name: string;
}

/**
 * User-saved filter preset
 */
export interface FilterPreset {
  id: string; // Unique identifier (auto-generated)
  name: string; // User-friendly name
  filters: {
    genreId?: string;
    minRuntime?: number;
    maxRuntime?: number;
  };
}

/**
 * Pagination state for infinite scroll
 */
export interface PaginationState {
  currentPage: number; // Current page being loaded
  hasMore: boolean; // Whether more pages exist
  isFetching: boolean; // Loading state
}

/**
 * Extended pagination state with error handling
 */
export interface PaginationStateWithError extends PaginationState {
  error: Error | null; // Last fetch error
}

/**
 * Discover data state
 */
export interface DiscoverState {
  movies: Movie[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Sort options for display in UI
 * Update SORT_OPTIONS when adding new sort types
 */
export const SORT_OPTIONS = [
  { value: "rating" as const, label: "Highest Rated" },
  { value: "year" as const, label: "Newest" },
  { value: "title" as const, label: "A-Z" },
  { value: "runtime" as const, label: "Shortest First" },
] as const;

/**
 * Movie data extended with optional fields for filtering
 * Used in filter utilities for type-safe sorting/filtering
 */
export interface MovieWithMetadata extends Omit<Movie, "rating" | "year" | "runtime"> {
  rating?: number;
  year?: number;
  runtime?: number;
}

/**
 * API response for paginated results
 */
export interface PaginatedResponse<T> {
  results: T[];
  total_pages: number;
  total_results: number;
  page: number;
}

/**
 * Error state for hooks
 */
export interface HookErrorState {
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
}