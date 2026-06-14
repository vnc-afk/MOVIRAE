import { getMoviesByGenre, getTrendingMovies } from "@/lib/tmdb";
import { RECOMMENDATIONS_CONFIG } from "./constants";
import type { Movie } from "@/lib/types";
import type { RecommendationsSnapshot } from "./types";

export async function fetchRecommendationsSnapshot(): Promise<RecommendationsSnapshot> {
  const [topPicks, trending, similar] = await Promise.all([
    getTrendingMovies(1),
    getTrendingMovies(2),
    getMoviesByGenre(RECOMMENDATIONS_CONFIG.RECOMMENDATION_GENRE_ID, 1),
  ]);

  return {
    topPicks,
    trending,
    similar,
    updatedAt: Date.now(),
  };
}

export async function fetchTopPicksPage(page: number): Promise<Movie[]> {
  return getTrendingMovies(page);
}

export async function fetchSimilarMoviesPage(page: number): Promise<Movie[]> {
  return getMoviesByGenre(RECOMMENDATIONS_CONFIG.RECOMMENDATION_GENRE_ID, page);
}

export async function fetchTrendingNowPage(page: number): Promise<Movie[]> {
  return getTrendingMovies(page);
}
