
/**
 * Load the current user's movie-related action state and watch experience.
 * This is used to hydrate the movie detail page when the user first opens it.
 */
export async function fetchUserMovieState(movieId: string) {
  try {
    const responses = await Promise.all([
      fetch("/api/watchlist"),
      fetch("/api/favorites"),
      fetch("/api/watched"),
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
 * Toggle a movie action for the current user and return the updated movie id list.
 */
export async function updateMovieAction(
  resource: "watchlist" | "favorites" | "watched",
  movieId: string,
  active: boolean
): Promise<string[] | null> {
  try {
    const response = await fetch(`/api/${resource}`, {
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
 * Persist the user's watch experience for this movie.
 * Returns the saved experience if successful, otherwise an error object.
 */
/**
 * Persist the user's watch experience for this movie to the backend.
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
