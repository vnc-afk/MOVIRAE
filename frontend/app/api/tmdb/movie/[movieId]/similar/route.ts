import { NextResponse } from "next/server";
import { getSimilarMovies } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await params;

  try {
    const movies = await getSimilarMovies(movieId, { signal: request.signal, suppressClientErrors: true });
    return NextResponse.json(movies);
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json([], { status: 499 });
    }
    console.error("/api/tmdb/movie/[movieId]/similar GET error:", err);
    return NextResponse.json({ error: "Failed to fetch similar movies" }, { status: 500 });
  }
}