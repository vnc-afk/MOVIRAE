import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/features/auth/config";
import { GiphyRequestError, searchGifs } from "@/lib/features/messages/giphy";
import { apiRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (apiRateLimit) {
    const identifier = session.user.email || getClientIp(request);
    const result = await apiRateLimit.limit(`giphy-search:${identifier}`);
    if (!result.success) {
      return NextResponse.json({ error: "Too many GIF searches. Please try again shortly." }, { status: 429 });
    }
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json({ error: "Search must be between 2 and 80 characters." }, { status: 400 });
  }

  try {
    return NextResponse.json({ value: await searchGifs(query) });
  } catch (error) {
    const status = error instanceof GiphyRequestError ? error.status : undefined;
    if (status === 429) return NextResponse.json({ error: "GIPHY rate limit reached. Please try again shortly." }, { status: 429 });
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json({ error: "GIPHY is taking too long to respond. Please try again." }, { status: 504 });
    }
    console.error("/api/gifs/search error:", error);
    return NextResponse.json({ error: "GIF search is temporarily unavailable." }, { status: 502 });
  }
}
