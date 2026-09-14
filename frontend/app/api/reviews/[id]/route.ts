import { apiBadRequest, apiInternalError, apiNotFound, apiForbidden, apiSuccess, apiUnauthorized } from "@/app/movie/lib/api-response";
import { requireAuth, parseRequestJson } from "@/app/movie/lib/api-utils";
import { updateReviewSchema } from "@/app/movie/lib/api-schemas";
import { editReview, deleteReview } from "@/services/movies/movies.server";

export const runtime = "nodejs";

/**
 * Update an existing review by id.
 * Requires authentication and ownership validation.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth(request);
    const { id } = await params;

    const payload = await parseRequestJson(request);
    const parsed = updateReviewSchema.safeParse(payload);
    if (!parsed.success) return apiBadRequest(parsed.error.message);

    const result = await editReview(id, parsed.data, currentUser);
    if ("error" in result) {
      if (result.error === "not-found") return apiNotFound("Review");
      if (result.error === "unauthorized") return apiForbidden();
      return apiInternalError("Failed to update review");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }
    console.error("/api/reviews/[id] PUT error:", error);
    return apiInternalError("Failed to update review");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth(_request);
    const { id } = await params;

    const result = await deleteReview(id, currentUser);
    if ("error" in result) {
      if (result.error === "not-found") return apiNotFound("Review");
      if (result.error === "unauthorized") return apiForbidden();
      return apiInternalError("Failed to delete review");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }
    console.error("/api/reviews/[id] DELETE error:", error);
    return apiInternalError("Failed to delete review");
  }
}
