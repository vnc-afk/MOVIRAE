/**
 * Movie Detail API Layer
 * Handles all data fetching for movie details, streaming, and state
 */

import type { MovieApiResponse } from "../types";

/**
 * Fetch user's movie-related lists in parallel
 * Returns [watchlist, favorites, watched] IDs
 */
export async function fetchUserMovieState(movieId: string) {
  try {
    const responses = await Promise.all([
      fetch("/api/data/user-watchlist-current"),
      fetch("/api/data/user-favorites-current"),
      fetch("/api/data/user-watched-current"),
      fetch(`/api/watch-experiences/${movieId}`),
    ]);

    const [watchlistIds, favoriteIds, watchedIds] = await Promise.all(
      responses.slice(0, 3).map(async (response) => {
        if (!response.ok) return [];
        const json = await response.json().catch(() => null);
        return Array.isArray(json?.value) ? json.value : [];
      })
    );

    const watchExperienceResponse = responses[3];
    const watchExperienceJson = await watchExperienceResponse.json().catch(() => null);
    const watchExperience = watchExperienceResponse.ok ? watchExperienceJson?.value ?? null : null;

    return {
      watchlistIds,
      favoriteIds,
      watchedIds,
      watchExperience,
    };
  } catch (error) {
    console.error("Failed to load movie action state:", error);
    return {
      watchlistIds: [],
      favoriteIds: [],
      watchedIds: [],
      watchExperience: null,
    };
  }
}

/**
 * Update a movie action (watchlist, favorites, watched)
 */
export async function updateMovieAction(
  key: "user-watchlist-current" | "user-favorites-current" | "user-watched-current",
  movieId: string,
  active: boolean
): Promise<string[] | null> {
  try {
    const response = await fetch(`/api/data/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId, active }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      console.error("Movie action failed:", json?.error || response.statusText);
      return null;
    }

    const json = await response.json().catch(() => null);
    return Array.isArray(json?.value) ? json.value : null;
  } catch (error) {
    console.error("Error updating movie action:", error);
    return null;
  }
}

/**
 * Save watch experience for a movie
 */
export async function saveWatchExperience(movieId: string, experience: any) {
  try {
    const response = await fetch(`/api/watch-experiences/${movieId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(experience),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return { success: false, error: json?.error || "Unable to save watch experience." };
    }

    return { success: true, value: json?.value ?? experience };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
