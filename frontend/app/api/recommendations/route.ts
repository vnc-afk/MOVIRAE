import { apiInternalError, apiSuccess } from "@/app/recommendations/lib/api-response";
import { getRecommendationsSnapshot } from "@/app/recommendations/lib/recommendations-server-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const value = await getRecommendationsSnapshot();
    return apiSuccess(value);
  } catch (error) {
    console.error("/api/recommendations GET error:", error);
    return apiInternalError("Failed to load recommendations");
  }
}
