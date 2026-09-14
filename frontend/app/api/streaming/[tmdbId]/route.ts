import { NextResponse } from "next/server";
import { getStreamingPlatforms } from "@/lib/features/streaming/watchmode";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  const { tmdbId } = await params;

  try {
    const platforms = await getStreamingPlatforms(tmdbId);
    return NextResponse.json(platforms);
  } catch (error) {
    if (request.signal.aborted) {
      return NextResponse.json([], { status: 499 });
    }

    console.error("/api/streaming/[tmdbId] GET error:", error);
    return NextResponse.json([], { status: 502 });
  }
}