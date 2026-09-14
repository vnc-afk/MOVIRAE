import { apiInternalError, apiNotFound, apiSuccess, apiUnauthorized } from "@/app/movie/lib/api-response";
import { requireAuth, parseRequestJson, getOpId } from "@/app/movie/lib/api-utils";
import { toggleReviewLike } from "@/services/movies/movies.server";

export const runtime = "nodejs";

/**
 * Toggle a like for the given review.
 * Authenticated users can like or unlike their own review actions.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth(request);
    const { id } = await params;

    const body = await parseRequestJson(request);
    const opId = getOpId(request, body);

    const result = await toggleReviewLike(id, currentUser, opId);
    if ("error" in result) {
      if (result.error === "not-found") return apiNotFound("Review");
      if (result.error === "unauthorized") return apiUnauthorized();
      return apiInternalError("Failed to toggle like");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }
    console.error("/api/reviews/[id]/like POST error:", error);
    return apiInternalError("Failed to like review");
  }
}