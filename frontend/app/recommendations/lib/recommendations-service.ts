import { RECOMMENDATIONS_CONFIG } from "./constants";
import type { Movie } from "@/lib/types";
import type { RecommendationSectionKey, RecommendationsSnapshot } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const payload = await response.json();
  return payload?.data ?? payload;
}

export async function fetchRecommendationsSnapshot(): Promise<RecommendationsSnapshot> {
  return await fetchJson<RecommendationsSnapshot>(RECOMMENDATIONS_CONFIG.API_PATH);
}

function getSectionQuery(section: RecommendationSectionKey): string {
  return `section=${encodeURIComponent(section)}`;
}

export async function fetchTopPicksPage(page: number): Promise<Movie[]> {
  return await fetchJson<Movie[]>(`${RECOMMENDATIONS_CONFIG.PAGE_PATH}?${getSectionQuery("top-picks")}&page=${page}`);
}

export async function fetchSimilarMoviesPage(page: number): Promise<Movie[]> {
  return await fetchJson<Movie[]>(`${RECOMMENDATIONS_CONFIG.PAGE_PATH}?${getSectionQuery("similar")}&page=${page}`);
}

export async function fetchTrendingNowPage(page: number): Promise<Movie[]> {
  return await fetchJson<Movie[]>(`${RECOMMENDATIONS_CONFIG.PAGE_PATH}?${getSectionQuery("trending")}&page=${page}`);
}
