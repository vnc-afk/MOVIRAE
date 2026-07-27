import { NextResponse } from "next/server";
import { getMovieDetails } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ movieId: string }> }
) {
  const { movieId } = await params;

  try {
    const movie = await getMovieDetails(movieId, {
      signal: request.signal,
      suppressClientErrors: true,
    });

    return NextResponse.json(movie);
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json(null, { status: 499 });
    }

    console.error("/api/tmdb/movie/[movieId] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch movie details" },
      { status: 500 }
    );
  }
}
