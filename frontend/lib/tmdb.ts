import { cache } from "react";
import type { Movie, CastMember } from "@/lib/types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_REVALIDATE_SECONDS = 60;
const TMDB_MEMORY_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

type TMDBRequestOptions = {
  suppressClientErrors?: boolean;
  signal?: AbortSignal;
};

interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  genres?: { id: number; name: string }[];
  genre_ids?: number[];
  poster_path: string | null;
  overview: string;
  runtime: number;
  spoken_languages: { name: string }[];
  production_countries: { iso_3166_1: string }[];
  director?: string;
  credits?: {
    cast: Array<{ name: string; character: string; profile_path: string }>;
    crew?: Array<{ name: string; job: string; department: string }>;
  };
}

interface TMDBGenre {
  id: number;
  name: string;
}

interface TMDBLanguage {
  iso_639_1: string | null;
  english_name: string;
  name: string;
}

interface TMDBCountry {
  iso_3166_1: string;
  english_name: string;
  native_name: string;
}

const genreMap = new Map<number, string>();
let genreMapInitPromise: Promise<void> | null = null;
const movieDetailsCache = new Map<string, { expiresAt: number; value: Promise<Movie | null> }>();
const tmdbJsonCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

const moodByGenre: Record<string, string[]> = {
  Action: ["Intense", "Thrilling"],
  Adventure: ["Thrilling"],
  Animation: ["Fun", "Uplifting"],
  Comedy: ["Fun", "Uplifting"],
  Crime: ["Dark", "Thrilling"],
  Documentary: ["Thought-Provoking"],
  Drama: ["Emotional", "Thought-Provoking"],
  Family: ["Uplifting", "Fun"],
  Fantasy: ["Thrilling", "Uplifting"],
  History: ["Thought-Provoking"],
  Horror: ["Dark", "Intense"],
  Music: ["Fun", "Romantic"],
  Mystery: ["Thrilling", "Dark"],
  Romance: ["Romantic", "Relaxing"],
  "Science Fiction": ["Thrilling", "Intense"],
  Thriller: ["Thrilling", "Dark"],
  War: ["Intense", "Thought-Provoking"],
  Western: ["Thrilling", "Intense"],
};

const tagByGenre: Record<string, string[]> = {
  Action: ["#action-packed", "#gripping"],
  Adventure: ["#action-packed", "#mind-bending"],
  Animation: ["#visually-stunning", "#feel-good"],
  Comedy: ["#feel-good", "#emotional"],
  Crime: ["#dark", "#gripping"],
  Documentary: ["#thought-provoking"],
  Drama: ["#emotional", "#slow-burn", "#thought-provoking"],
  Family: ["#feel-good", "#visually-stunning"],
  Fantasy: ["#mind-bending", "#visually-stunning"],
  History: ["#slow-burn", "#thought-provoking"],
  Horror: ["#dark", "#gripping", "#atmospheric"],
  Music: ["#feel-good", "#atmospheric"],
  Mystery: ["#mind-bending", "#gripping"],
  Romance: ["#emotional", "#feel-good"],
  "Science Fiction": ["#mind-bending", "#visually-stunning"],
  Thriller: ["#gripping", "#dark", "#atmospheric"],
  War: ["#dark", "#intense", "#slow-burn"],
  Western: ["#atmospheric", "#gripping"],
};


async function ensureGenreMap(): Promise<void> {
  if (genreMap.size > 0) return;
  if (!genreMapInitPromise) {
    genreMapInitPromise = initializeGenreMap().catch((error) => {
      console.error("Failed to lazily initialize genre map:", error);
      genreMapInitPromise = null;
    });
  }
  await genreMapInitPromise;
}

function reportTmdbError(message: string, error: unknown, options?: TMDBRequestOptions) {
  if (
    (error instanceof DOMException &&
      (error.name === "AbortError" || error.code === DOMException.ABORT_ERR)) ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return;
  }

  if (options?.suppressClientErrors && typeof window !== "undefined") {
    return;
  }

  console.error(message, error);
}

type TMDBFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

function getCachedValue<T>(cacheStore: Map<string, { expiresAt: number; value: Promise<T> }>, key: string) {
  const cached = cacheStore.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    cacheStore.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue<T>(
  cacheStore: Map<string, { expiresAt: number; value: Promise<T> }>,
  key: string,
  value: Promise<T>,
  ttlMs = TMDB_MEMORY_CACHE_TTL_MS
) {
  if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cacheStore.keys().next().value;
    if (oldestKey !== undefined) cacheStore.delete(oldestKey);
  }
  cacheStore.set(key, { expiresAt: Date.now() + ttlMs, value });
}

const fetchTmdbJson = cache(async <T>(url: string, signal?: AbortSignal): Promise<T | null> => {
  const cacheKey = `json:${url}`;
  const shouldUseMemoryCache = !signal;

  if (shouldUseMemoryCache) {
    const cached = getCachedValue(tmdbJsonCache as Map<string, { expiresAt: number; value: Promise<T | null> }>, cacheKey);
    if (cached) {
      return cached;
    }
  }

  const request = (async () => {
    const response = await fetch(url, {
      signal,
      next: { revalidate: TMDB_REVALIDATE_SECONDS },
      cache: "force-cache",
    } satisfies TMDBFetchInit);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  })();

  const trackedRequest = request.catch((error) => {
    tmdbJsonCache.delete(cacheKey);
    throw error;
  });

  if (shouldUseMemoryCache) {
    setCachedValue(tmdbJsonCache as Map<string, { expiresAt: number; value: Promise<T | null> }>, cacheKey, trackedRequest);
  }

  return trackedRequest;
});

/**
 * Initialize genre map from TMDB
 */
export async function initializeGenreMap() {
  if (!TMDB_API_KEY) {
    return;
  }

  try {
    const data = await fetchTmdbJson<{ genres?: TMDBGenre[] }>(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`
    );

    const genres = data?.genres;
    if (!Array.isArray(genres)) {
      return;
    }

    genres.forEach((genre: TMDBGenre) => {
      genreMap.set(genre.id, genre.name);
    });
  } catch (error) {
    console.error("Failed to initialize genre map:", error);
  }
}

/**
 * Get available movie genres from TMDB.
 */
export async function getGenres(options?: TMDBRequestOptions): Promise<TMDBGenre[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  try {
    const data = await fetchTmdbJson<{ genres?: TMDBGenre[] }>(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`,
      options?.signal
    );

    return Array.isArray(data?.genres) ? data.genres : [];
  } catch (error) {
    console.error("Failed to fetch genres:", error);
    return [];
  }
}

export async function getDiscoverMetadata(
  options?: TMDBRequestOptions
): Promise<{
  native: { genres: string[]; languages: string[]; countries: string[] };
  derived: { moods: string[]; tags: string[] };
}> {
  if (!TMDB_API_KEY) {
    return {
      native: { genres: [], languages: [], countries: [] },
      derived: { moods: [], tags: [] },
    };
  }

  const fallbackGenreNames = ["Action", "Comedy", "Drama", "Horror", "Romance", "Thriller"];

  try {
    const [genresResult, languagesResult, countriesResult] = await Promise.all([
      fetchTmdbJson<{ genres?: TMDBGenre[] }>(
        `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`,
        options?.signal
      ),
      fetchTmdbJson<TMDBLanguage[]>(
        `${TMDB_BASE_URL}/configuration/languages?api_key=${TMDB_API_KEY}`,
        options?.signal
      ),
      fetchTmdbJson<TMDBCountry[]>(
        `${TMDB_BASE_URL}/configuration/countries?api_key=${TMDB_API_KEY}`,
        options?.signal
      ),
    ]);

    const genreNames = Array.isArray(genresResult?.genres)
      ? genresResult.genres.map((genre) => genre.name)
      : fallbackGenreNames;

    const languages = Array.from(
      new Set(
        (Array.isArray(languagesResult) ? languagesResult : [])
          .map((language) => language.english_name || language.name)
          .filter(Boolean)
      )
    );

    const countries = Array.from(
      new Set(
        (Array.isArray(countriesResult) ? countriesResult : [])
          .map((country) => country.english_name || country.native_name || country.iso_3166_1)
          .filter(Boolean)
      )
    );

    const moodValues = Array.from(
      new Set(
        genreNames.flatMap((genre) => moodByGenre[genre] ?? [])
      )
    );

    const tagValues = Array.from(
      new Set(
        genreNames.flatMap((genre) => tagByGenre[genre] ?? [])
      )
    );

    return {
      native: {
        genres: genreNames,
        languages: languages.length > 0 ? languages : ["English", "Japanese", "French", "Spanish"],
        countries: countries.length > 0 ? countries : ["USA", "UK", "Japan", "Australia"],
      },
      derived: {
        moods: moodValues.length > 0 ? moodValues : ["Thrilling", "Relaxing", "Romantic", "Dark", "Uplifting"],
        tags: tagValues.length > 0 ? tagValues : ["#atmospheric", "#dark", "#gripping", "#feel-good", "#emotional", "#visually-stunning", "#mind-bending", "#slow-burn", "#action-packed"],
      },
    };
  } catch (error) {
    reportTmdbError("Failed to fetch discover metadata:", error, options);
    return {
      native: {
        genres: fallbackGenreNames,
        languages: ["English", "Japanese", "French", "Spanish"],
        countries: ["USA", "UK", "Japan", "Australia"],
      },
      derived: {
        moods: ["Thrilling", "Relaxing", "Romantic", "Dark", "Uplifting"],
        tags: ["#atmospheric", "#dark", "#gripping", "#feel-good", "#emotional", "#visually-stunning", "#mind-bending", "#slow-burn", "#action-packed"],
      },
    };
  }
}

/**
 * Get genre name from ID
 */
function getGenreName(genreId: number): string {
  return genreMap.get(genreId) || "Unknown";
}

/**
 * Fetch trending movies from TMDB
 */
export async function getTrendingMovies(page = 1, options?: TMDBRequestOptions): Promise<Movie[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  await ensureGenreMap();

  try {
    const data = await fetchTmdbJson<{ results?: TMDBMovie[] }>(
      `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&page=${page}`,
      options?.signal
    );

    if (!data || !data.results) return [];

    return Promise.all(
      data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie))
    );
  } catch (error) {
    reportTmdbError("Failed to fetch trending movies:", error, options);
    return [];
  }
}

/**
 * Search movies by query
 */
export async function searchMovies(query: string, page = 1, options?: TMDBRequestOptions): Promise<Movie[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  await ensureGenreMap();

  try {
    const data = await fetchTmdbJson<{ results?: TMDBMovie[] }>(
      `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`,
      options?.signal
    );

    if (!data || !data.results) return [];

    return Promise.all(
      data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie))
    );
  } catch (error) {
    reportTmdbError("Failed to search movies:", error, options);
    return [];
  }
}

/**
 * Get movie details by ID
 */
export async function getMovieDetails(movieId: string, options?: TMDBRequestOptions): Promise<Movie | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return null;
  }

  const normalizedMovieId = movieId.trim();
  if (!normalizedMovieId) {
    return null;
  }

  const cached = movieDetailsCache.get(normalizedMovieId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const request = (async () => {
    try {
      const movie = await fetchTmdbJson<TMDBMovie>(
        `${TMDB_BASE_URL}/movie/${normalizedMovieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`,
        options?.signal
      );

      if (!movie) {
        return null;
      }

      return transformTMDBMovie(movie);
    } catch (error) {
      reportTmdbError("Failed to fetch movie details:", error, options);
      return null;
    }
  })();

  const trackedRequest = request.then((movie) => {
    setCachedValue(movieDetailsCache, normalizedMovieId, Promise.resolve(movie), TMDB_MEMORY_CACHE_TTL_MS);
    return movie;
  });

  setCachedValue(movieDetailsCache, normalizedMovieId, trackedRequest, TMDB_MEMORY_CACHE_TTL_MS);

  return trackedRequest;
}

export async function getMovieDetailsBatch(movieIds: string[], options?: TMDBRequestOptions): Promise<Movie[]> {
  const uniqueIds = Array.from(new Set(movieIds.map((id) => id.trim()).filter(Boolean)));
  const results = await Promise.all(uniqueIds.map((movieId) => getMovieDetails(movieId, options)));
  return results.filter((movie): movie is Movie => movie !== null);
}

/**
 * Get similar movies
 */
export async function getSimilarMovies(movieId: string, options?: TMDBRequestOptions): Promise<Movie[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  await ensureGenreMap();

  try {
    const data = await fetchTmdbJson<{ results?: TMDBMovie[] }>(
      `${TMDB_BASE_URL}/movie/${movieId}/similar?api_key=${TMDB_API_KEY}`,
      options?.signal
    );

    if (!data || !data.results) return [];

    return Promise.all(data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie)));
  } catch (error) {
    reportTmdbError("Failed to fetch similar movies:", error, options);
    return [];
  }
}
/**
 * Transform TMDB movie response to app Movie interface
 */
async function transformTMDBMovie(tmdbMovie: TMDBMovie): Promise<Movie> {
  const posterUrl = tmdbMovie.poster_path
    ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
    : "";

  const movieGenres = Array.isArray(tmdbMovie.genres)
    ? tmdbMovie.genres
    : (tmdbMovie.genre_ids || []).map((id) => ({ id, name: getGenreName(id) }));

  const cast: CastMember[] = (tmdbMovie.credits?.cast || [])
    .slice(0, 6)
    .map((actor: any) => ({
      name: actor.name,
      role: actor.character || "Unknown",
      avatar: actor.profile_path
        ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${actor.name}`,
    }));

  // Extract director from crew
  const director =
    tmdbMovie.credits?.crew
      ?.find((member: any) => member.job === "Director")
      ?.name || "Unknown";

  const year = new Date(tmdbMovie.release_date).getFullYear() || new Date().getFullYear();

  // Derive tags from genres
  const derivedTags = Array.from(
    new Set(
      movieGenres.flatMap((genre) => tagByGenre[genre.name] ?? [])
    )
  );

  return {
    id: String(tmdbMovie.id),
    title: tmdbMovie.title,
    year,
    rating: Math.round((tmdbMovie.vote_average / 2) * 10) / 10, // Convert 0-10 to 0-5
    genre: movieGenres[0]
      ? movieGenres[0].name
      : "Unknown",
    poster: posterUrl,
    synopsis: tmdbMovie.overview || "No synopsis available",
    director,
    cast,
    reviews: [], // Reviews will be empty from API, user-generated reviews can be stored separately
    tags: derivedTags,
    streamingOn: [], // WatchMode will provide this
    runtime: tmdbMovie.runtime || 0,
    language: tmdbMovie.spoken_languages?.[0]?.name || "Unknown",
    country: tmdbMovie.production_countries?.[0]?.iso_3166_1 || "Unknown",
    moods: [], // Can be inferred from genre, or user-defined
  };
}

/**
 * Get movies by genre
 */
export async function getMoviesByGenre(
  genreId: number,
  page = 1,
  options?: TMDBRequestOptions
): Promise<Movie[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  await ensureGenreMap();

  try {
    const data = await fetchTmdbJson<{ results?: TMDBMovie[] }>(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`,
      options?.signal
    );

    if (!data || !data.results) return [];

    return Promise.all(
      data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie))
    );
  } catch (error) {
    reportTmdbError("Failed to fetch movies by genre:", error, options);
    return [];
  }
}

/**
 * Get videos for a movie (trailers, teasers, clips)
 */
export async function getMovieVideos(movieId: string, options?: TMDBRequestOptions): Promise<
  Array<{
    id: string;
    key: string;
    name: string;
    site: string;
    type: string;
    official?: boolean;
    published_at?: string;
  }>
> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  try {
    const data = await fetchTmdbJson<{ results?: Array<any> }>(
      `${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`,
      options?.signal
    );

    if (!data || !Array.isArray(data.results)) return [];

    const results = data.results.map((v: any) => ({
      id: String(v.id),
      key: v.key,
      name: v.name,
      site: v.site,
      type: v.type,
      official: v.official,
      published_at: v.published_at,
    }));

    // prefer trailers from YouTube, and prefer official trailers first
    results.sort((a, b) => {
      const score = (r: any) => (r.site === "YouTube" ? 100 : 0) + (r.type === "Trailer" ? 10 : 0) + (r.official ? 1 : 0);
      return score(b) - score(a);
    });

    return results;
  } catch (error) {
    reportTmdbError("Failed to fetch movie videos:", error, options);
    return [];
  }
}
