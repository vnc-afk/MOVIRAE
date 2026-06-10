import { NextResponse } from "next/server";

import { searchMovies } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const pageParam = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const movies = await searchMovies(query, page, {
      signal: request.signal,
      suppressClientErrors: true,
    });

    return NextResponse.json(movies);
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json([], { status: 499 });
    }

    console.error("/api/tmdb/search GET error:", err);
    return NextResponse.json({ error: "Failed to search movies" }, { status: 500 });
  }
}
