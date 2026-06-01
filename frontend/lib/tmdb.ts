import { cache } from "react";
import type { Movie, CastMember } from "@/lib/types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_REVALIDATE_SECONDS = 60;
const TMDB_MEMORY_CACHE_TTL_MS = 60 * 1000;

type TMDBRequestOptions = {
  suppressClientErrors?: boolean;
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

const genreMap = new Map<number, string>();
const movieDetailsCache = new Map<string, { expiresAt: number; value: Promise<Movie | null> }>();
const tmdbJsonCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

function reportTmdbError(message: string, error: unknown, options?: TMDBRequestOptions) {
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

function setCachedValue<T>(cacheStore: Map<string, { expiresAt: number; value: Promise<T> }>, key: string, value: Promise<T>, ttlMs = TMDB_MEMORY_CACHE_TTL_MS) {
  cacheStore.set(key, { expiresAt: Date.now() + ttlMs, value });
}

const fetchTmdbJson = cache(async <T>(url: string): Promise<T | null> => {
  const cacheKey = `json:${url}`;
  const cached = getCachedValue(tmdbJsonCache as Map<string, { expiresAt: number; value: Promise<T | null> }>, cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const response = await fetch(url, {
      next: { revalidate: TMDB_REVALIDATE_SECONDS },
      cache: "force-cache",
    } satisfies TMDBFetchInit);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  })();

  setCachedValue(tmdbJsonCache as Map<string, { expiresAt: number; value: Promise<T | null> }>, cacheKey, request);
  return request;
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
export async function getGenres(): Promise<TMDBGenre[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  try {
    const data = await fetchTmdbJson<{ genres?: TMDBGenre[] }>(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`
    );

    return Array.isArray(data?.genres) ? data.genres : [];
  } catch (error) {
    console.error("Failed to fetch genres:", error);
    return [];
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

  try {
    const data = await fetchTmdbJson<{ results?: TMDBMovie[] }>(
      `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&page=${page}`
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

  try {
    const data = await fetchTmdbJson<{ results?: TMDBMovie[] }>(
      `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
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
        `${TMDB_BASE_URL}/movie/${normalizedMovieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
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
    movieDetailsCache.set(normalizedMovieId, {
      expiresAt: Date.now() + TMDB_MEMORY_CACHE_TTL_MS,
      value: Promise.resolve(movie),
    });
    return movie;
  });

  movieDetailsCache.set(normalizedMovieId, {
    expiresAt: Date.now() + TMDB_MEMORY_CACHE_TTL_MS,
    value: trackedRequest,
  });

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

  try {
    const data = await fetchTmdbJson<{ results?: TMDBMovie[] }>(
      `${TMDB_BASE_URL}/movie/${movieId}/similar?api_key=${TMDB_API_KEY}`
    );

    if (!data || !data.results) return [];

    return Promise.all(
      data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie))
    );
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
    tags: movieGenres.map((genre) => genre.name),
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

  try {
    const data = await fetchTmdbJson<{ results?: TMDBMovie[] }>(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`
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
