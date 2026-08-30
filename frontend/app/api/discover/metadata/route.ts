import { NextResponse } from "next/server";
import { getDiscoverMetadata } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const metadata = await getDiscoverMetadata({
      signal: request.signal,
      suppressClientErrors: true,
    });

    return NextResponse.json(metadata);
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json(
        {
          native: { genres: [], languages: [], countries: [] },
          derived: { moods: [], tags: [] },
        },
        { status: 499 }
      );
    }

    console.error("/api/discover/metadata GET error:", err);
    return NextResponse.json(
      {
        native: { genres: [], languages: [], countries: [] },
        derived: { moods: [], tags: [] },
      },
      { status: 500 }
    );
  }
}
