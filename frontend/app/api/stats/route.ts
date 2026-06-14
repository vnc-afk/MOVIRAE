import { apiInternalError, apiSuccess, apiUnauthorized } from "@/app/stats/lib/api-response";
import { requireAuth } from "@/app/stats/lib/api-utils";
import { getUserStats } from "@/app/stats/lib/stats-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth(request);
    const value = await getUserStats(currentUser);
    return apiSuccess(value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }

    console.error("/api/stats GET error:", error);
    return apiInternalError("Failed to load stats");
  }
}
