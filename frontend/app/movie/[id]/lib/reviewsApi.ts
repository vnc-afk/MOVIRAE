/**
 * Reviews API Layer
 * Handles all review-related API calls with proper error handling
 */

import type { Review } from "@/lib/types";
import type { MovieApiResponse } from "../types";

/**
 * Fetch reviews for a movie
 */
export async function fetchMovieReviews(movieId: string): Promise<Review[]> {
  try {
    const response = await fetch(`/api/reviews/movie/${movieId}`);
    const json = await response.json().catch(() => null);
    
    if (response.ok && Array.isArray(json?.value)) {
      return json.value;
    }
    return [];
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
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers,
      body: JSON.stringify({ tmdbId, rating, comment }),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return { success: false, error: json?.error || "Unable to save review." };
    }

    return { success: true, data: json };
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

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return { success: false, error: json?.error || "Unable to save review." };
    }

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
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return { success: false, error: json?.error || "Unable to delete review." };
    }

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

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Failed to toggle review like:", json?.error);
      return null;
    }

    return json?.value ?? null;
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

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return { success: false, error: json?.error || "Unable to add reply." };
    }

    return { success: true, data: json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to add reply.",
    };
  }
}
