import { apiError, apiSuccess, apiInternalError } from "@/app/stats/lib/api-response";
import { requireAuth, AuthError } from "@/app/stats/lib/api-utils";
import { getUserStatsSnapshot } from "@/app/stats/lib/user-stats";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth(request);
    const value = await getUserStatsSnapshot(currentUser.id);
    return apiSuccess(value);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message);
    }

    console.error("/api/stats GET error:", error);
    return apiInternalError("Failed to load stats");
  }
}
