import { apiInternalError, apiNotFound, apiSuccess, apiUnauthorized } from "@/app/movie/lib/api-response";
import { requireAuth } from "@/app/movie/lib/api-utils";
import { deleteReply } from "@/app/movie/lib/movie-service";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  try {
    const currentUser = await requireAuth(request);
    const { id, replyId } = await params;

    const result = await deleteReply(id, replyId, currentUser);
    if ("error" in result) {
      if (result.error === "not-found") return apiNotFound("Reply");
      if (result.error === "unauthorized") return apiUnauthorized();
      return apiInternalError("Failed to delete reply");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }
    console.error("/api/reviews/[id]/replies/[replyId] DELETE error:", error);
    return apiInternalError("Failed to delete reply");
  }
}
