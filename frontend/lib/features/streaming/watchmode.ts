import "server-only";

/**
 * WatchMode API Integration
 * Provides streaming availability information for movies
 */

const WATCHMODE_BASE_URL = "https://api.watchmode.com/v1";
const WATCHMODE_API_KEY = process.env.
WATCHMODE_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

interface WatchModeSource {
  source_id: number;
  name: string;
  type: "sub" | "rent" | "buy" | "free" | "tve";
  region: string;
  web_url: string | null;
  ios_url: string | null;
  android_url: string | null;
  tvos_url: string | null;
  android_tv_url: string | null;
  roku_url: string | null;
  format: string | null;
  price: number | null;
}

const displayNameMap: Record<string, string> = {
  Netflix: "Netflix",
  "Amazon Prime": "Amazon Prime",
  Hulu: "Hulu",
  "Disney+": "Disney+",
  "Apple TV+": "Apple TV+",
  "HBO Max": "HBO Max",
  Paramount: "Paramount+",
  Peacock: "Peacock",
  "Google Play": "Google Play",
  Vudu: "Vudu",
};

function toWatchModeTitleId(tmdbId: string) {
  return `movie-${tmdbId}`;
}

function normalizePlatformName(name: string) {
  return displayNameMap[name] || name.replace(/ Video$/, "").replace(/\s+Rent$/, "");
}

function buildRegionQuery(region?: string) {
  return region ? `&regions=${encodeURIComponent(region)}` : "";
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url: string, timeout = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry helper for temporary server errors (502, 504)
 */
async function fetchWithRetry(
  url: string,
  maxRetries = 2,
  timeout = 8000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, timeout);
      
      // Success or non-retryable error
      if (response.ok || ![502, 504].includes(response.status)) {
        return response;
      }

      // Retryable error (502, 504) - only retry if not the last attempt
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s...
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      // Network or timeout error - retry if not the last attempt
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}

async function getTmdbWatchProviders(tmdbId: string, region = "US") {
  if (!TMDB_API_KEY) {
    return [];
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const providers = data?.results?.[region]?.flatrate ?? [];
    return providers
      .map((provider: { provider_name?: string }) => provider.provider_name)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get streaming platforms for a movie using TMDB ID
 */
export async function getStreamingPlatforms(
  tmdbId: string,
  region?: string
): Promise<string[]> {
  if (!WATCHMODE_API_KEY) {
    console.warn("WATCHMODE_API_KEY is not set");
    return [];
  }

  try {
    const response = await fetchWithRetry(
      `${WATCHMODE_BASE_URL}/search/?apiKey=${WATCHMODE_API_KEY}&search_field=tmdb_movie_id&search_value=${encodeURIComponent(tmdbId)}&types=movie`
    );

    if (!response.ok) {
      // Only log if it's not a temporary error or after retries are exhausted
      if (![502, 504].includes(response.status)) {
        console.warn(
          "WatchMode search unavailable (status: " + response.status + "), using TMDB fallback"
        );
      }
      return await getTmdbWatchProviders(tmdbId, region);
    }

    const searchData = await response.json();
    const watchModeTitleId = searchData?.title_results?.[0]?.id;

    if (!watchModeTitleId) {
      return await getTmdbWatchProviders(tmdbId, region);
    }

    const sourcesResponse = await fetchWithRetry(
      `${WATCHMODE_BASE_URL}/title/${watchModeTitleId}/sources/?apiKey=${WATCHMODE_API_KEY}${buildRegionQuery(region)}`
    );

    if (!sourcesResponse.ok) {
      return await getTmdbWatchProviders(tmdbId, region);
    }

    const sources: WatchModeSource[] = await sourcesResponse.json();
    const platforms = new Set<string>();

    sources.forEach((source) => {
      if (source.type === "sub" || source.type === "free") {
        platforms.add(normalizePlatformName(source.name));
      }
    });

    const results = Array.from(platforms);
    return results.length > 0 ? results : await getTmdbWatchProviders(tmdbId, region);
  } catch (error) {
    console.warn("Streaming platform fetch failed, using TMDB fallback");
    return await getTmdbWatchProviders(tmdbId, region);
  }
}

/**
 * Get all available sources for a movie
 */
export async function getAllSources(
  tmdbId: string,
  region?: string
): Promise<WatchModeSource[]> {
  if (!WATCHMODE_API_KEY) {
    console.warn("WATCHMODE_API_KEY is not set");
    return [];
  }

  try {
    const response = await fetchWithRetry(
      `${WATCHMODE_BASE_URL}/title/${toWatchModeTitleId(tmdbId)}/sources/?apiKey=${WATCHMODE_API_KEY}${buildRegionQuery(region)}`
    );

    if (!response.ok) return [];

    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch all sources, returning empty list");
    return [];
  }
}

/**
 * List available regions
 */
export async function getAvailableRegions(): Promise<
  { country: string; name: string }[]
> {
  if (!WATCHMODE_API_KEY) {
    console.warn("WATCHMODE_API_KEY is not set");
    return [];
  }

  try {
    const response = await fetchWithRetry(
      `${WATCHMODE_BASE_URL}/regions/?apiKey=${WATCHMODE_API_KEY}`
    );

    if (!response.ok) return [];

    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch regions, returning empty list");
    return [];
  }
}
