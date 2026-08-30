import type { FilterState } from "./types";
import { ValidationError } from "./errors";
import { FILTER_CONFIG } from "./constants";

export type { FilterState };

/**
 * Default discover state used when the page first mounts or a reset is requested.
 */
export const DEFAULT_FILTERS: FilterState = {
  query: "",
  genreId: "",
  runtimeRange: [FILTER_CONFIG.MIN_RUNTIME, FILTER_CONFIG.MAX_RUNTIME],
  sortBy: "rating",
  moods: [],
  tags: [],
  languages: [],
  countries: [],
};

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

function validateGenreId(genreId: string): string {
  if (!genreId) return "";

  if (!/^\d+$/.test(genreId)) {
    throw new ValidationError(`Invalid genre ID: ${genreId}`, { genreId });
  }

  return genreId;
}

/**
 * Reconstructs the discover filter state from the current URL search parameters.
 *
 * @param searchParams - URL parameter accessor used by Next.js route hooks.
 * @returns A validated filter state object.
 */
function parseMultiValueParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readFiltersFromSearchParams(
  searchParams: { get: (key: string) => string | null }
): FilterState {
  const query = searchParams.get("q")?.trim() ?? "";
  const genreId = validateGenreId(searchParams.get("genre") ?? "");
  const minRuntime = Number(searchParams.get("min") ?? DEFAULT_FILTERS.runtimeRange[0]);
  const maxRuntime = Number(searchParams.get("max") ?? DEFAULT_FILTERS.runtimeRange[1]);
  const sortBy = searchParams.get("sort");
  const moods = parseMultiValueParam(searchParams.get("moods"));
  const tags = parseMultiValueParam(searchParams.get("tags"));
  const languages = parseMultiValueParam(searchParams.get("languages"));
  const countries = parseMultiValueParam(searchParams.get("countries"));

  const runtimeRange = validateRuntimeRange(minRuntime, maxRuntime);
  const validatedSortBy = sortBy
    ? validateSortBy(sortBy)
    : DEFAULT_FILTERS.sortBy;

  return {
    query,
    genreId,
    runtimeRange,
    sortBy: validatedSortBy,
    moods,
    tags,
    languages,
    countries,
  };
}

/**
 * Serializes the current filter state back into a shareable URL pathname.
 *
 * @param pathname - Base route used to build the final URL.
 * @param filters - Current filter state to encode.
 * @returns A pathname with only non-default filters persisted.
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

  if (filters.moods.length) {
    params.set("moods", filters.moods.join(","));
  }

  if (filters.tags.length) {
    params.set("tags", filters.tags.join(","));
  }

  if (filters.languages.length) {
    params.set("languages", filters.languages.join(","));
  }

  if (filters.countries.length) {
    params.set("countries", filters.countries.join(","));
  }

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * Compares two filter objects to determine whether the discover URL needs an update.
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
    left.runtimeRange[1] === right.runtimeRange[1] &&
    JSON.stringify(left.moods) === JSON.stringify(right.moods) &&
    JSON.stringify(left.tags) === JSON.stringify(right.tags) &&
    JSON.stringify(left.languages) === JSON.stringify(right.languages) &&
    JSON.stringify(left.countries) === JSON.stringify(right.countries)
  );
}

/**
 * Decides which discover data source should drive the current request flow.
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
 * Counts how many non-default filter controls are currently affecting the results.
 */
export function countActiveFilters(filters: FilterState): number {
  return (
    (filters.genreId ? 1 : 0) +
    (filters.runtimeRange[0] > FILTER_CONFIG.MIN_RUNTIME ||
    filters.runtimeRange[1] < FILTER_CONFIG.MAX_RUNTIME
      ? 1
      : 0) +
    (filters.moods.length ? 1 : 0) +
    (filters.tags.length ? 1 : 0) +
    (filters.languages.length ? 1 : 0) +
    (filters.countries.length ? 1 : 0)
  );
}

/**
 * Returns a new array sorted according to the selected discover sort mode.
 *
 * @param movies - Movie collection to order in place.
 * @param sortBy - Selected sort mode.
 * @returns A sorted copy of the provided records.
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
 * Keeps only movies whose runtime falls within the requested duration window.
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
 * Removes repeated movie records while preserving the first occurrence for each unique ID.
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