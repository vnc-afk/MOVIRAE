import { RECOMMENDATIONS_CONFIG } from "./constants";
import type { Movie } from "@/lib/types";
import type { RecommendationSectionKey, RecommendationsSnapshot } from "./types";

/**
 * Fetches a JSON payload and unwraps the backend response envelope when present.
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const payload = await response.json();
  return payload?.data ?? payload;
}

/**
 * Requests the initial recommendations snapshot used to render the landing recommendations page.
 */
export async function fetchRecommendationsSnapshot(): Promise<RecommendationsSnapshot> {
  return await fetchJson<RecommendationsSnapshot>(RECOMMENDATIONS_CONFIG.API_PATH);
}

/**
 * Serializes the section name into the query string expected by the paged recommendations endpoint.
 */
function getSectionQuery(section: RecommendationSectionKey): string {
  return `section=${encodeURIComponent(section)}`;
}

/**
 * Fetches the next paginated slice for the top-picks recommendation section.
 */
export async function fetchTopPicksPage(page: number): Promise<Movie[]> {
  return await fetchJson<Movie[]>(`${RECOMMENDATIONS_CONFIG.PAGE_PATH}?${getSectionQuery("top-picks")}&page=${page}`);
}

/**
 * Fetches the next paginated slice for the taste-based recommendation section.
 */
export async function fetchSimilarMoviesPage(page: number): Promise<Movie[]> {
  return await fetchJson<Movie[]>(`${RECOMMENDATIONS_CONFIG.PAGE_PATH}?${getSectionQuery("similar")}&page=${page}`);
}

/**
 * Fetches the next paginated slice for the trending recommendation section.
 */
export async function fetchTrendingNowPage(page: number): Promise<Movie[]> {
  return await fetchJson<Movie[]>(`${RECOMMENDATIONS_CONFIG.PAGE_PATH}?${getSectionQuery("trending")}&page=${page}`);
}
