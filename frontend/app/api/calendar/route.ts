import { prisma } from "@/lib/prisma";
import { getUpcomingMovies } from "@/lib/tmdb";
import { apiSuccess, apiUnauthorized, apiValidationError } from "@/app/calendar/lib/api-response";
import { calendarQuerySchema, createCalendarItemSchema, deleteCalendarItemSchema } from "@/app/calendar/lib/api-schemas";
import { getCurrentUser, getOperationId, serializeCalendarDate } from "@/app/calendar/lib/api-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiUnauthorized();

  const url = new URL(request.url);
  const query = calendarQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return apiValidationError("Invalid calendar query parameters", { fields: query.error.flatten().fieldErrors });
  }
  const { month, page, limit } = query.data;
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

  return apiSuccess(
    { value, pagination: { page, limit, total: value.length, hasMore: false } },
    200,
    { source: "tmdb-and-calendar" }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiUnauthorized();

  const parsed = createCalendarItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError("Invalid calendar item", { fields: parsed.error.flatten().fieldErrors });

  const { opId, ...calendarItem } = parsed.data;

  const item = await prisma.calendarItem.upsert({
    where: { userId_tmdbId_type_date: { userId: user.id, tmdbId: calendarItem.tmdbId, type: calendarItem.type, date: calendarItem.date } },
    create: { ...calendarItem, userId: user.id },
    update: { movieTitle: calendarItem.movieTitle, poster: calendarItem.poster, genre: calendarItem.genre },
  });

  return apiSuccess({ value: { ...item, date: serializeCalendarDate(item.date) }, opId }, 201);
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiUnauthorized();

  const url = new URL(request.url);
  const parsed = deleteCalendarItemSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return apiValidationError("Invalid calendar delete parameters", { fields: parsed.error.flatten().fieldErrors });
  }
  const { tmdbId, date, type } = parsed.data;
  const opId = getOperationId(request, parsed.data);

  await prisma.calendarItem.deleteMany({ where: { userId: user.id, tmdbId, date: new Date(`${date}T00:00:00.000Z`), type } });
  return apiSuccess({ value: true, opId });
}