import { NextResponse } from "next/server";

import { getMovieVideos } from "@/lib/tmdb";

export const runtime = "nodejs";

const videosCache = new Map<
  string,
  {
    expiresAt: number;
    value: Array<{
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
      official?: boolean;
      published_at?: string;
    }>;
  }
>();
const VIDEOS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await params;
  if (!tmdbId) {
    return NextResponse.json([], { status: 400 });
  }

  const cached = videosCache.get(tmdbId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  }

  try {
    const videos = await getMovieVideos(tmdbId, { signal: request.signal, suppressClientErrors: true });

    videosCache.set(tmdbId, {
      expiresAt: Date.now() + VIDEOS_CACHE_TTL_MS,
      value: videos,
    });

    return NextResponse.json(videos, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json([], { status: 499 });
    }

    console.error("/api/tmdb/videos GET error:", err);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}
