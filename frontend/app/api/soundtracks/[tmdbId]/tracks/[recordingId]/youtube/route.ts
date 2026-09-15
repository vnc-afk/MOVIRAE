import { apiError, apiSuccess } from "@/app/soundtracks/lib/api-response";
import { resolveTrackYoutube } from "@/services/soundtracks/soundtracks.server";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string; recordingId: string }> },
) {
  const { tmdbId, recordingId } = await params;
  try {
    const youtubeVideoId = await resolveTrackYoutube(tmdbId, recordingId, request.signal);
    if (!youtubeVideoId) {
      return apiError("PREVIEW_UNAVAILABLE", "YouTube did not return a playable preview for this track", 422);
    }
    return apiSuccess({ youtubeVideoId });
  } catch (error) {
    if (request.signal.aborted) return apiError("REQUEST_ABORTED", "Request aborted", 499);
    if (error instanceof YouTubeApiError) {
      return apiError("YOUTUBE_QUOTA_EXCEEDED", "YouTube preview search is temporarily unavailable because its daily quota has been exhausted", 503);
    }
    console.error("Soundtrack track lookup failed:", error);
    return apiError("INTERNAL_ERROR", "Unable to resolve track preview");
  }
}
