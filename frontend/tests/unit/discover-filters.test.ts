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
import { ValidationError } from "@/app/discover/lib/errors";

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
});
