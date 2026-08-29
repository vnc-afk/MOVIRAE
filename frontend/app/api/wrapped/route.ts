import { apiInternalError, apiSuccess, apiUnauthorized } from "@/app/wrapped/lib/api-response";
import { requireAuth } from "@/app/wrapped/lib/api-utils";
import { getUserStatsSnapshot } from "@/lib/aggregations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth(request);
    const value = await getUserStatsSnapshot(currentUser.id);

    return apiSuccess(value, 200, { source: "wrapped", cache: "private, no-store" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }

    console.error("/api/wrapped GET error:", error);
    return apiInternalError("Failed to load wrapped stats");
  }
}
