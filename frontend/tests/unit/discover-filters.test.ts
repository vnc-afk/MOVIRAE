import { describe, expect, it } from "vitest";

import {
  areFiltersEqual,
  buildFiltersUrl,
  countActiveFilters,
  DEFAULT_FILTERS,
  deduplicateMovies,
  filterByRuntime,
  getFilterMode,
  readFiltersFromSearchParams,
  sortMovies,
} from "@/app/discover/lib/filterUtils";
import {
  AbortedError,
  DiscoverError,
  NetworkError,
  TimeoutError,
  ValidationError,
  normalizeError,
} from "@/app/discover/lib/errors";

describe("discover filter utilities", () => {
  it("round-trips non-default filters through a URL", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      query: "  space  ",
      genreId: "18",
      runtimeRange: [90, 150] as [number, number],
      sortBy: "year" as const,
      moods: ["dark", "funny"],
      tags: ["award"],
      languages: ["en"],
      countries: ["US"],
    };

    const url = buildFiltersUrl("/discover", filters);
    expect(url).toBe(
      "/discover?q=space&genre=18&min=90&max=150&sort=year&moods=dark%2Cfunny&tags=award&languages=en&countries=US"
    );
    expect(readFiltersFromSearchParams(new URLSearchParams(url.split("?")[1]))).toEqual({
      ...filters,
      query: "space",
    });
  });

  it("rejects invalid runtime, genre, and sort parameters", () => {
    expect(() => readFiltersFromSearchParams(new URLSearchParams("min=500"))).toThrow(ValidationError);
    expect(() => readFiltersFromSearchParams(new URLSearchParams("genre=drama"))).toThrow(ValidationError);
    expect(() => readFiltersFromSearchParams(new URLSearchParams("sort=unknown"))).toThrow(ValidationError);
  });

  it("rejects non-finite and reversed runtime ranges", () => {
    expect(() => readFiltersFromSearchParams(new URLSearchParams("min=abc"))).toThrow(
      "Runtime values must be finite numbers"
    );
    expect(() => readFiltersFromSearchParams(new URLSearchParams("min=150&max=90"))).toThrow(
      "Minimum runtime cannot be greater than maximum"
    );
  });

  it("trims and removes empty multi-value parameters", () => {
    expect(readFiltersFromSearchParams(new URLSearchParams("moods=%20dark,%20,%20funny%20&tags="))).toMatchObject({
      moods: ["dark", "funny"],
      tags: [],
    });
  });

  it("selects filter mode and counts active controls", () => {
    expect(getFilterMode(DEFAULT_FILTERS)).toBe("default");
    expect(getFilterMode({ ...DEFAULT_FILTERS, genreId: "35" })).toBe("genre");
    expect(getFilterMode({ ...DEFAULT_FILTERS, query: "comedy" })).toBe("search");
    expect(countActiveFilters({ ...DEFAULT_FILTERS, moods: ["uplifting"], runtimeRange: [90, 180] })).toBe(2);
  });

  it("sorts without mutating input and filters by inclusive runtime", () => {
    const movies = [
      { id: "b", title: "Beta", rating: 7, year: 2020, runtime: 120 },
      { id: "a", title: "Alpha", rating: 9, year: 2022, runtime: 90 },
    ];

    expect(sortMovies(movies, "rating").map((movie) => movie.id)).toEqual(["a", "b"]);
    expect(sortMovies(movies, "title").map((movie) => movie.id)).toEqual(["a", "b"]);
    expect(filterByRuntime(movies, [90, 120]).map((movie) => movie.id)).toEqual(["b", "a"]);
    expect(movies.map((movie) => movie.id)).toEqual(["b", "a"]);
    expect(deduplicateMovies([...movies, movies[0]]).map((movie) => movie.id)).toEqual(["b", "a"]);
  });

  it("compares every filter collection", () => {
    expect(areFiltersEqual(DEFAULT_FILTERS, { ...DEFAULT_FILTERS })).toBe(true);
    expect(areFiltersEqual(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, countries: ["JP"] })).toBe(false);
  });

  it("normalizes known and unknown errors into stable discover errors", () => {
    const existing = new ValidationError("bad filter");
    expect(normalizeError(existing)).toBe(existing);
    expect(normalizeError(new DOMException("cancelled", "AbortError"))).toBeInstanceOf(AbortedError);
    expect(normalizeError(new DOMException("deadline", "TimeoutError"))).toBeInstanceOf(TimeoutError);
    expect(normalizeError(new TypeError("fetch failed"))).toMatchObject({
      name: "NetworkError",
      code: "NETWORK_ERROR",
      message: "Network request failed",
    });
    expect(normalizeError(new Error("unexpected"))).toMatchObject({
      name: "DiscoverError",
      code: "UNKNOWN_ERROR",
      message: "unexpected",
    });
    expect(normalizeError(42)).toMatchObject({
      code: "UNKNOWN_ERROR",
      message: "42",
    });
  });
});
