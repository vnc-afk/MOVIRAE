import { apiInternalError, apiNotFound, apiSuccess, apiUnauthorized } from "@/app/movie/lib/api-response";
import { requireAuth } from "@/app/movie/lib/api-utils";
import { toggleMovieFavorite } from "@/services/movies/movies.server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  try {
    const currentUser = await requireAuth(request);
    const { tmdbId } = await params;

    const result = await toggleMovieFavorite(tmdbId, currentUser);
    if ("error" in result) {
      if (result.error === "not-found") return apiNotFound("Movie");
      return apiInternalError("Failed to toggle favorite");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }
    console.error("/api/movies/[tmdbId]/like POST error:", error);
    return apiInternalError("Failed to toggle favorite");
  }
}
