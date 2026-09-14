import { apiInternalError, apiNotFound, apiSuccess, apiUnauthorized } from "@/app/movie/lib/api-response";
import { getOpId, parseRequestJson, requireAuth } from "@/app/movie/lib/api-utils";
import { toggleReviewHelpful } from "@/services/movies/movies.server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth(request);
    const { id } = await params;
    const body = await parseRequestJson(request);
    const result = await toggleReviewHelpful(id, currentUser, getOpId(request, body));

    if ("error" in result) return apiNotFound("Review");
    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return apiUnauthorized();
    console.error("/api/reviews/[id]/helpful POST error:", error);
    return apiInternalError("Failed to toggle helpful vote");
  }
}