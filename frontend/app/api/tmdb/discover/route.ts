import { NextResponse } from "next/server";
import { getMoviesByGenre } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const genreIdParam = url.searchParams.get("genreId");
  const genreId = genreIdParam ? Number(genreIdParam) : 0;
  const pageParam = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const requestedSort = url.searchParams.get("sortBy");
  const sortBy = requestedSort === "year" || requestedSort === "title" || requestedSort === "runtime"
    ? requestedSort
    : "rating";

  if (!Number.isFinite(genreId) || genreId < 0) {
    return NextResponse.json({ error: "genreId is required" }, { status: 400 });
  }

  try {
    const movies = await getMoviesByGenre(genreId, page, {
      signal: request.signal,
      suppressClientErrors: true,
    }, sortBy);
    return NextResponse.json(movies);
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json([], { status: 499 });
    }
    console.error("/api/tmdb/discover GET error:", err);
    return NextResponse.json({ error: "Failed to fetch movies by genre" }, { status: 500 });
  }
}