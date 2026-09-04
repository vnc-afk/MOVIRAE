
import type { Review, ReviewTone } from "@/lib/types";

/**
 * Normalize API responses and surface a standard ok/error result shape.
 * Handles both non-2xx responses and API responses with success=false.
 */
async function parseApiResponse<T>(response: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const json = await response.json().catch(() => null);

  if (!response.ok || json?.success === false) {
    return { ok: false, error: json?.error?.message ?? json?.error ?? "Request failed." };
  }

  return { ok: true, data: json?.data as T };
}

/**
 * Load movie reviews from the API and return an empty list on failure.
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
 * Create a review and return the saved Review payload.
 * Headers are provided by optimistic operation tracking.
 */
export async function createReview(
  tmdbId: string,
  rating: number,
  comment: string,
  tone: ReviewTone | null,
  isSpoiler: boolean,
  headers: Record<string, string>
): Promise<{ success: boolean; data?: { value: Review; opId?: string }; error?: string }> {
  try {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers,
      body: JSON.stringify({ tmdbId, rating, comment, tone, isSpoiler }),
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
/**
 * Update an existing review with the user's latest rating and comment.
 */
export async function updateReview(
  reviewId: string,
  tmdbId: string,
  rating: number,
  comment: string,
  tone: ReviewTone | null,
  isSpoiler: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/reviews/${reviewId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId, rating, comment, tone, isSpoiler }),
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
 * Remove a review by id.
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


export async function toggleReviewLike(reviewId: string): Promise<Review | null> {
  try {
    const response = await fetch(`/api/reviews/${reviewId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
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