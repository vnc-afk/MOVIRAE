import { apiInternalError, apiNotFound, apiSuccess, apiUnauthorized } from "@/app/movie/lib/api-response";
import { requireAuth, parseRequestJson, getOpId } from "@/app/movie/lib/api-utils";
import { toggleReplyLike } from "@/services/movies/movies.server";

export const runtime = "nodejs";

/**
 * Toggle a like on a reply.
 * Uses optimistic operation ids to support client-side tracking.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  try {
    const currentUser = await requireAuth(request);
    const { id, replyId } = await params;

    const body = await parseRequestJson(request);
    const opId = getOpId(request, body);

    const result = await toggleReplyLike(id, replyId, currentUser, opId);
    if ("error" in result) {
      if (result.error === "not-found") return apiNotFound("Reply");
      return apiInternalError("Failed to toggle reply like");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }
    console.error("/api/reviews/[id]/replies/[replyId]/like POST error:", error);
    return apiInternalError("Failed to like reply");
  }
}
