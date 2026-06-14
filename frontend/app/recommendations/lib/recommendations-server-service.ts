import { getMoviesByGenre, getTrendingMovies } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";
import type { RecommendationSectionKey, RecommendationsSnapshot } from "./types";
import { RECOMMENDATIONS_CONFIG } from "./constants";

export async function getRecommendationsSnapshot(): Promise<RecommendationsSnapshot> {
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

export async function getRecommendationsPage(
  section: RecommendationSectionKey,
  page: number
): Promise<Movie[]> {
  switch (section) {
    case "top-picks":
      return await getTrendingMovies(page);
    case "similar":
      return await getMoviesByGenre(RECOMMENDATIONS_CONFIG.RECOMMENDATION_GENRE_ID, page);
    case "trending":
      return await getTrendingMovies(page);
    default:
      return [];
  }
}
