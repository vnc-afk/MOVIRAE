import { apiBadRequest, apiInternalError, apiNotFound, apiUnauthorized, apiSuccess } from "@/app/movie/lib/api-response";
import { requireAuth, parseRequestJson, getOpId } from "@/app/movie/lib/api-utils";
import { createReply } from "@/app/movie/lib/movie-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth(request);
    const { id } = await params;

    const body = await parseRequestJson(request);
    const opId = getOpId(request, body);
    const comment = typeof body?.comment === "string" ? body.comment : "";

    if (!comment.trim()) return apiBadRequest("Reply comment is required");

    const result = await createReply(id, { comment, opId }, currentUser);
    if ("error" in result) {
      if (result.error === "not-found") return apiNotFound("Review");
      if (result.error === "validation") return apiBadRequest("Reply comment is required");
      return apiInternalError("Failed to create reply");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }
    console.error("/api/reviews/[id]/replies POST error:", error);
    return apiInternalError("Failed to post reply");
  }
}