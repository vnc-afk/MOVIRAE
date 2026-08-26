import { RECOMMENDATIONS_CONFIG } from "./constants";
import type { RecommendationsSnapshot } from "./types";

const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Fetches a JSON payload and unwraps the backend response envelope when present.
 */
async function fetchJson<T>(url: string): Promise<T> {
  const existing = inFlightRequests.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = (async () => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const payload = await response.json();
    return payload?.data ?? payload;
  })();

  inFlightRequests.set(url, request);

  try {
    return (await request) as T;
  } finally {
    inFlightRequests.delete(url);
  }
}

/**
 * Requests the initial recommendations snapshot used to render the landing recommendations page.
 */
export async function fetchRecommendationsSnapshot(): Promise<RecommendationsSnapshot> {
  return await fetchJson<RecommendationsSnapshot>(RECOMMENDATIONS_CONFIG.API_PATH);
}

