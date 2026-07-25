import { apiInternalError, apiSuccess } from "@/app/movie/lib/api-response";
import { getCurrentUser } from "@/app/movie/lib/api-utils";
import { getMovieReviews } from "@/app/movie/lib/movie-service";

export const runtime = "nodejs";

/**
 * Get reviews for a specific TMDB movie.
 * This endpoint optionally uses the current user context to shape
 * the returned review metadata.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  try {
    const { tmdbId } = await params;
    const currentUser = await getCurrentUser();

    const value = await getMovieReviews(tmdbId, currentUser);
    return apiSuccess(value);
  } catch (error) {
    console.error("/api/reviews/movie/[tmdbId] GET error:", error);
    return apiInternalError("Failed to load reviews");
  }
}
