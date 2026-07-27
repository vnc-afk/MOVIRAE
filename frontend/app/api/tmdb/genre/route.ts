import { NextResponse } from "next/server";
import { getGenres } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const genres = await getGenres({ signal: request.signal, suppressClientErrors: true });
    return NextResponse.json(genres);
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json([], { status: 499 });
    }
    console.error("/api/tmdb/genres GET error:", err);
    return NextResponse.json({ error: "Failed to fetch genres" }, { status: 500 });
  }
}