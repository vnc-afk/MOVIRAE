import { apiBadRequest, apiInternalError, apiNotFound, apiSuccess, apiUnauthorized } from "@/app/movie/lib/api-response";
import { requireAuth, parseRequestJson } from "@/app/movie/lib/api-utils";
import { getWatchExperience, parseWatchExperiencePayload, saveWatchExperience } from "@/services/movies/movies.server";
import { refreshUserStatsSnapshot } from "@/app/stats/lib/user-stats";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const currentUser = await requireAuth(request);
    const { tmdbId } = await params;

    const value = await getWatchExperience(currentUser.id, tmdbId);
    return apiSuccess(value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return apiSuccess(null);
    console.error("/api/watch-experiences/[tmdbId] GET error:", error);
    return apiInternalError("Failed to get watch experience");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const currentUser = await requireAuth(request);
    const { tmdbId } = await params;

    const payload = await parseRequestJson(request);
    const input = parseWatchExperiencePayload(payload);
    if (!input) return apiBadRequest("Invalid payload");

    const value = await saveWatchExperience(currentUser.id, tmdbId, input);
    void refreshUserStatsSnapshot(currentUser.id).catch((err: unknown) => console.error("refreshUserStatsSnapshot failed", err));
    return apiSuccess({ value, watched: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return apiUnauthorized();
    console.error("/api/watch-experiences/[tmdbId] PUT error:", error);
    return apiInternalError("Failed to save watch experience");
  }
}
