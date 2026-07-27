import { NextResponse } from "next/server";
import { getTrendingMovies } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  try {
    const movies = await getTrendingMovies(page, {
      signal: request.signal,
      suppressClientErrors: true,
    });
    return NextResponse.json(movies);
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json([], { status: 499 });
    }
    console.error("/api/tmdb/trending GET error:", err);
    return NextResponse.json({ error: "Failed to fetch trending movies" }, { status: 500 });
  }
}