import { apiBadRequest, apiInternalError, apiSuccess } from "@/app/recommendations/lib/api-response";
import { getRecommendationsPage } from "@/app/recommendations/lib/recommendations-server-service";
import type { RecommendationSectionKey } from "@/app/recommendations/lib/types";

const SECTION_KEYS: RecommendationSectionKey[] = ["top-picks", "similar", "trending"];

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const section = url.searchParams.get("section");
    const page = Number(url.searchParams.get("page") ?? "1");

    if (!section || !SECTION_KEYS.includes(section as RecommendationSectionKey)) {
      return apiBadRequest("Invalid recommendation section");
    }

    if (!Number.isFinite(page) || page < 1) {
      return apiBadRequest("Invalid page number");
    }

    const value = await getRecommendationsPage(section as RecommendationSectionKey, page);
    return apiSuccess(value);
  } catch (error) {
    console.error("/api/recommendations/page GET error:", error);
    return apiInternalError("Failed to load recommendation page");
  }
}
