import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";
import { getUpcomingMovies } from "@/lib/tmdb";

export const runtime = "nodejs";

const createCalendarItemSchema = z.object({
  tmdbId: z.string().min(1),
  movieTitle: z.string().min(1).max(200),
  date: z.coerce.date(),
  type: z.enum(["release", "planned", "reminder"]),
  poster: z.string().url().optional().nullable(),
  genre: z.string().max(100).optional().nullable(),
});

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "month must use YYYY-MM format" }, { status: 400 });
  }
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const [year, monthNumber] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, monthNumber - 1, 1));
  const to = new Date(Date.UTC(year, monthNumber, 1));

  const [firstMoviePage, items] = await Promise.all([
    getUpcomingMovies(month, 1, { signal: request.signal, suppressClientErrors: true }),
    prisma.calendarItem.findMany({
      where: { userId: user.id, date: { gte: from, lt: to } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const remainingPages = Math.max(0, Math.min(firstMoviePage.totalPages, 20) - 1);
  const laterMoviePages = await Promise.all(
    Array.from({ length: remainingPages }, (_, index) =>
      getUpcomingMovies(month, index + 2, { signal: request.signal, suppressClientErrors: true })
    )
  );
  const movies = [firstMoviePage.results, ...laterMoviePages.map((pageResult) => pageResult.results)].flat();

  const reminders = items.filter((item) => item.type === "reminder");
  const releases = movies
    .map(({ movie, releaseDate }) => ({ id: `tmdb-release-${movie.id}`, tmdbId: movie.id, movieTitle: movie.title, date: releaseDate, type: "release" as const, poster: movie.poster, genre: movie.genre, reminderId: reminders.find((item) => item.tmdbId === movie.id && item.date.toISOString().slice(0, 10) === releaseDate)?.id }));
  const persisted = items.map((item) => ({ ...item, date: item.date.toISOString().slice(0, 10) }));
  const value = [...releases, ...persisted].sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ value, pagination: { page, limit, total: value.length, hasMore: false } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createCalendarItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid calendar item", details: parsed.error.flatten() }, { status: 400 });

  const item = await prisma.calendarItem.upsert({
    where: { userId_tmdbId_type_date: { userId: user.id, tmdbId: parsed.data.tmdbId, type: parsed.data.type, date: parsed.data.date } },
    create: { ...parsed.data, userId: user.id },
    update: { movieTitle: parsed.data.movieTitle, poster: parsed.data.poster, genre: parsed.data.genre },
  });

  return NextResponse.json({ value: { ...item, date: item.date.toISOString().slice(0, 10) } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const tmdbId = url.searchParams.get("tmdbId");
  const date = url.searchParams.get("date");
  const type = url.searchParams.get("type");
  if (!tmdbId || !date || !["planned", "reminder"].includes(type ?? "")) {
    return NextResponse.json({ error: "tmdbId, date, and type are required" }, { status: 400 });
  }

  await prisma.calendarItem.deleteMany({ where: { userId: user.id, tmdbId, date: new Date(`${date}T00:00:00.000Z`), type: type as "planned" | "reminder" } });
  return NextResponse.json({ value: true });
}