/**
 * Reviews API Layer
 * Handles all review-related API calls with proper error handling
 */

import type { Review } from "@/lib/types";

async function parseApiResponse<T>(response: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const json = await response.json().catch(() => null);

  if (!response.ok || json?.success === false) {
    return { ok: false, error: json?.error?.message ?? json?.error ?? "Request failed." };
  }

  return { ok: true, data: json?.data as T };
}

/**
 * Fetch reviews for a movie
 */
export async function fetchMovieReviews(movieId: string): Promise<Review[]> {
  try {
    const response = await fetch(`/api/reviews/movie/${movieId}`);
    const result = await parseApiResponse<Review[]>(response);
    return result.ok && Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    console.error("Failed to fetch reviews:", error);
    return [];
  }
}

/**
 * Create a new review with optimistic operation tracking
 */
export async function createReview(
  tmdbId: string,
  rating: number,
  comment: string,
  headers: Record<string, string>
): Promise<{ success: boolean; data?: { value: Review; opId?: string }; error?: string }> {
  try {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers,
      body: JSON.stringify({ tmdbId, rating, comment }),
    });

    const result = await parseApiResponse<{ value: Review; opId?: string }>(response);

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to save review.",
    };
  }
}

/**
 * Update an existing review
 */
export async function updateReview(
  reviewId: string,
  tmdbId: string,
  rating: number,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/reviews/${reviewId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId, rating, comment }),
    });

    const result = await parseApiResponse(response);
    if (!result.ok) return { success: false, error: result.error };

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to save review.",
    };
  }
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" });
    const result = await parseApiResponse(response);
    if (!result.ok) return { success: false, error: result.error };

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to delete review.",
    };
  }
}

/**
 * Like/unlike a review
 */
export async function toggleReviewLike(reviewId: string): Promise<Review | null> {
  try {
    const response = await fetch(`/api/reviews/${reviewId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    // FIX: was `json?.value ?? null` — the route wraps its payload as
    // apiSuccess(result.value), i.e. `{ success, data: <review> }`. There
    // is no top-level `.value` key in that response at all, so this always
    // returned null regardless of whether the like actually succeeded.
    const result = await parseApiResponse<Review>(response);
    if (!result.ok) {
      console.error("Failed to toggle review like:", result.error);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error("Error toggling review like:", error);
    return null;
  }
}

/**
 * Reply to a review
 */
export async function replyToReview(
  reviewId: string,
  comment: string,
  headers: Record<string, string>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(`/api/reviews/${reviewId}/replies`, {
      method: "POST",
      headers,
      body: JSON.stringify({ comment }),
    });

    // FIX: same double-wrap issue as createReview — data is now the
    // unwrapped review payload, not the full response envelope.
    const result = await parseApiResponse(response);
    if (!result.ok) return { success: false, error: result.error };

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to add reply.",
    };
  }
}