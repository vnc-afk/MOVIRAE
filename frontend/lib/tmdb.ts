import type { Movie, CastMember } from "@/data/mockData";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  genres: { id: number; name: string }[];
  poster_path: string;
  overview: string;
  runtime: number;
  spoken_languages: { name: string }[];
  production_countries: { iso_3166_1: string }[];
  director?: string;
  credits?: {
    cast: Array<{ name: string; character: string; profile_path: string }>;
  };
}

interface TMDBGenre {
  id: number;
  name: string;
}

const genreMap = new Map<number, string>();

/**
 * Initialize genre map from TMDB
 */
export async function initializeGenreMap() {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();
    data.genres.forEach((genre: TMDBGenre) => {
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
    const response = await fetch(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();

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
export async function getTrendingMovies(page = 1): Promise<Movie[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&page=${page}`
    );
    const data = await response.json();

    if (!data.results) return [];

    return Promise.all(
      data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie))
    );
  } catch (error) {
    console.error("Failed to fetch trending movies:", error);
    return [];
  }
}

/**
 * Search movies by query
 */
export async function searchMovies(query: string, page = 1): Promise<Movie[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
    );
    const data = await response.json();

    if (!data.results) return [];

    return Promise.all(
      data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie))
    );
  } catch (error) {
    console.error("Failed to search movies:", error);
    return [];
  }
}

/**
 * Get movie details by ID
 */
export async function getMovieDetails(movieId: string): Promise<Movie | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return null;
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
    );
    const movie = await response.json();

    return transformTMDBMovie(movie);
  } catch (error) {
    console.error("Failed to fetch movie details:", error);
    return null;
  }
}

/**
 * Get similar movies
 */
export async function getSimilarMovies(movieId: string): Promise<Movie[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}/similar?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();

    if (!data.results) return [];

    return Promise.all(
      data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie))
    );
  } catch (error) {
    console.error("Failed to fetch similar movies:", error);
    return [];
  }
}

/**
 * Transform TMDB movie response to app Movie interface
 */
async function transformTMDBMovie(tmdbMovie: TMDBMovie): Promise<Movie> {
  const posterUrl = tmdbMovie.poster_path
    ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
    : "https://via.placeholder.com/300x450?text=No+Poster";

  const cast: CastMember[] = (tmdbMovie.credits?.cast || [])
    .slice(0, 6)
    .map((actor: any) => ({
      name: actor.name,
      role: actor.character || "Unknown",
      avatar: actor.profile_path
        ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${actor.name}`,
    }));

  const year = new Date(tmdbMovie.release_date).getFullYear() || new Date().getFullYear();

  return {
    id: String(tmdbMovie.id),
    title: tmdbMovie.title,
    year,
    rating: Math.round((tmdbMovie.vote_average / 2) * 10) / 10, // Convert 0-10 to 0-5
    genre: tmdbMovie.genres?.[0]
      ? getGenreName(tmdbMovie.genres[0].id)
      : "Unknown",
    poster: posterUrl,
    synopsis: tmdbMovie.overview || "No synopsis available",
    director: "Director info unavailable", // TMDB doesn't include director in standard response
    cast,
    reviews: [], // Reviews will be empty from API, user-generated reviews can be stored separately
    tags: tmdbMovie.genres?.map((g: any) => g.name) || [],
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
  page = 1
): Promise<Movie[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`
    );
    const data = await response.json();

    if (!data.results) return [];

    return Promise.all(
      data.results.map((movie: TMDBMovie) => transformTMDBMovie(movie))
    );
  } catch (error) {
    console.error("Failed to fetch movies by genre:", error);
    return [];
  }
}
