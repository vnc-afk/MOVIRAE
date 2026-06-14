import { apiBadRequest, apiCreated, apiInternalError, apiUnauthorized } from "@/app/movie/lib/api-response";
import { requireAuth, parseRequestJson, getOpId } from "@/app/movie/lib/api-utils";
import { createReviewSchema } from "@/app/movie/lib/api-schemas";
import { addReview } from "@/app/movie/lib/movie-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth(request);

    const payload = await parseRequestJson(request);
    const parsed = createReviewSchema.safeParse(payload);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.message);
    }

    const opId = getOpId(request, payload);
    const result = await addReview({ ...parsed.data, opId }, currentUser);
    if ("error" in result) {
      if (result.error === "unauthorized") return apiUnauthorized("Mark the movie as watched before reviewing it");
      if (result.error === "conflict") return apiBadRequest("You already reviewed this movie");
      return apiInternalError("Failed to create review");
    }

    return apiCreated({ value: result.value, opId: result.opId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }

    console.error("/api/reviews POST error:", error);
    return apiInternalError("Failed to create review");
  }
}
