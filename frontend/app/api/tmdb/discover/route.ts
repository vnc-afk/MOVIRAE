import { NextResponse } from "next/server";
import { getMoviesByGenre } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const genreId = Number(url.searchParams.get("genreId"));
  const pageParam = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  if (!Number.isFinite(genreId)) {
    return NextResponse.json({ error: "genreId is required" }, { status: 400 });
  }

  try {
    const movies = await getMoviesByGenre(genreId, page, {
      signal: request.signal,
      suppressClientErrors: true,
    });
    return NextResponse.json(movies);
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json([], { status: 499 });
    }
    console.error("/api/tmdb/discover GET error:", err);
    return NextResponse.json({ error: "Failed to fetch movies by genre" }, { status: 500 });
  }
}