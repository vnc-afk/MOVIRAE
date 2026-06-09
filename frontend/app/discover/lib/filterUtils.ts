import type { FilterState } from "./types";
import { ValidationError } from "./errors";
import { FILTER_CONFIG } from "./constants";

export type { FilterState };

export const DEFAULT_FILTERS: FilterState = {
  query: "",
  genreId: "",
  runtimeRange: [FILTER_CONFIG.MIN_RUNTIME, FILTER_CONFIG.MAX_RUNTIME],
  sortBy: "rating",
};

/**
 * Validates runtime range values
 * @throws ValidationError if values are invalid
 */
function validateRuntimeRange(
  min: number,
  max: number
): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new ValidationError("Runtime values must be finite numbers", {
      min,
      max,
    });
  }

  if (min < FILTER_CONFIG.MIN_RUNTIME) {
    throw new ValidationError(
      `Minimum runtime cannot be less than ${FILTER_CONFIG.MIN_RUNTIME}`,
      { provided: min, minimum: FILTER_CONFIG.MIN_RUNTIME }
    );
  }

  if (max > FILTER_CONFIG.MAX_RUNTIME) {
    throw new ValidationError(
      `Maximum runtime cannot exceed ${FILTER_CONFIG.MAX_RUNTIME}`,
      { provided: max, maximum: FILTER_CONFIG.MAX_RUNTIME }
    );
  }

  if (min > max) {
    throw new ValidationError("Minimum runtime cannot be greater than maximum", {
      min,
      max,
    });
  }

  return [Math.round(min), Math.round(max)];
}

/**
 * Validates a sort parameter
 * @throws ValidationError if invalid
 */
function validateSortBy(
  value: unknown
): FilterState["sortBy"] {
  const validSortValues: FilterState["sortBy"][] = [
    "rating",
    "year",
    "title",
    "runtime",
  ];

  if (!validSortValues.includes(value as any)) {
    throw new ValidationError(`Invalid sort value: ${value}`, {
      provided: value,
      valid: validSortValues,
    });
  }

  return value as FilterState["sortBy"];
}

/**
 * Validates a genre ID (must be numeric string)
 * @throws ValidationError if invalid
 */
function validateGenreId(genreId: string): string {
  if (!genreId) return ""; // Empty is valid (means no genre filter)

  if (!/^\d+$/.test(genreId)) {
    throw new ValidationError(`Invalid genre ID: ${genreId}`, { genreId });
  }

  return genreId;
}

/**
 * Read filter state from URL search params with validation
 * @throws ValidationError if params are malformed
 */
export function readFiltersFromSearchParams(
  searchParams: { get: (key: string) => string | null }
): FilterState {
  const query = searchParams.get("q")?.trim() ?? "";
  const genreId = validateGenreId(searchParams.get("genre") ?? "");
  const minRuntime = Number(searchParams.get("min") ?? DEFAULT_FILTERS.runtimeRange[0]);
  const maxRuntime = Number(searchParams.get("max") ?? DEFAULT_FILTERS.runtimeRange[1]);
  const sortBy = searchParams.get("sort");

  const runtimeRange = validateRuntimeRange(minRuntime, maxRuntime);
  const validatedSortBy = sortBy
    ? validateSortBy(sortBy)
    : DEFAULT_FILTERS.sortBy;

  return {
    query,
    genreId,
    runtimeRange,
    sortBy: validatedSortBy,
  };
}

/**
 * Build URL with filter params (only includes non-default values)
 */
export function buildFiltersUrl(pathname: string, filters: FilterState): string {
  const params = new URLSearchParams();

  if (filters.query.trim()) {
    params.set("q", filters.query.trim());
  }

  if (filters.genreId) {
    params.set("genre", filters.genreId);
  }

  if (filters.runtimeRange[0] > DEFAULT_FILTERS.runtimeRange[0]) {
    params.set("min", String(filters.runtimeRange[0]));
  }

  if (filters.runtimeRange[1] < DEFAULT_FILTERS.runtimeRange[1]) {
    params.set("max", String(filters.runtimeRange[1]));
  }

  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) {
    params.set("sort", filters.sortBy);
  }

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * Check if two filter states are equal
 */
export function areFiltersEqual(
  left: FilterState,
  right: FilterState
): boolean {
  return (
    left.query === right.query &&
    left.genreId === right.genreId &&
    left.sortBy === right.sortBy &&
    left.runtimeRange[0] === right.runtimeRange[0] &&
    left.runtimeRange[1] === right.runtimeRange[1]
  );
}

/**
 * Determine current mode based on filters
 */
export function getFilterMode(
  filters: FilterState
): "search" | "genre" | "default" {
  const trimmedQuery = filters.query.trim();
  if (trimmedQuery) return "search";
  if (filters.genreId) return "genre";
  return "default";
}

/**
 * Count active filters (excluding defaults)
 */
export function countActiveFilters(filters: FilterState): number {
  return (
    (filters.genreId ? 1 : 0) +
    (filters.runtimeRange[0] > FILTER_CONFIG.MIN_RUNTIME ||
    filters.runtimeRange[1] < FILTER_CONFIG.MAX_RUNTIME
      ? 1
      : 0)
  );
}

/**
 * Sort movies according to filter preference
 * @param movies - Array of movies to sort (not mutated)
 * @param sortBy - Sort criteria
 * @returns New sorted array
 */
export function sortMovies<T extends { rating?: number; year?: number; title?: string; runtime?: number }>(
  movies: readonly T[],
  sortBy: FilterState["sortBy"]
): T[] {
  const sorted = [...movies];

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "rating":
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "year":
        return (b.year ?? 0) - (a.year ?? 0);
      case "runtime":
        return (a.runtime ?? 0) - (b.runtime ?? 0);
      case "title":
        return (a.title ?? "").localeCompare(b.title ?? "");
      default:
        return 0;
    }
  });

  return sorted;
}

/**
 * Filter movies by runtime range
 * @param movies - Array of movies to filter (not mutated)
 * @param runtimeRange - [min, max] inclusive range
 * @returns New filtered array
 */
export function filterByRuntime<T extends { runtime?: number }>(
  movies: readonly T[],
  runtimeRange: [number, number]
): T[] {
  return movies.filter(
    (movie) =>
      (movie.runtime ?? 0) >= runtimeRange[0] &&
      (movie.runtime ?? 0) <= runtimeRange[1]
  );
}

/**
 * Deduplicate movies by ID while preserving order
 * @param movies - Array of movies to deduplicate
 * @returns New array with duplicates removed
 */
export function deduplicateMovies<T extends { id: string }>(
  movies: readonly T[]
): T[] {
  const seen = new Set<string>();
  return movies.filter((movie) => {
    if (seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
}