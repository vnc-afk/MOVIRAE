import { getMovieScoreCredits, getTrendingMovies, searchMovies } from "@/lib/tmdb";
import { enqueueSoundtrackRefresh } from "@/lib/queues/soundtracks";
import { cachedSoundtrackLooksSuspicious, createPendingSoundtrack, getCachedSoundtrack, serializeSoundtrack, soundtrackNeedsRefresh } from "@/services/soundtracks/soundtracks.server";
import {
  apiError,
  apiInternalError,
  apiSuccess,
  apiValidationError,
} from "@/app/soundtracks/lib/api-response";
import { soundtracksQuerySchema } from "@/app/soundtracks/lib/api-schemas";

export const runtime = "nodejs";

const PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 8;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const queryResult = soundtracksQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!queryResult.success) {
    return apiValidationError("Invalid soundtrack query parameters", {
      fields: queryResult.error.flatten().fieldErrors,
    });
  }

  const { q: query, page } = queryResult.data;
  const pageSize = query ? SEARCH_PAGE_SIZE : PAGE_SIZE;

  try {
    const movies = query
      ? await searchSoundtrackMovies(query, page, request.signal)
      : await getTrendingMovies(page, { signal: request.signal, suppressClientErrors: true });
    const moviesToResolve = movies.slice(0, pageSize);

    const items = await Promise.all(moviesToResolve.map(async (movie) => {
      const credits = await getMovieScoreCredits(String(movie.id), { signal: request.signal, suppressClientErrors: true });
      const source = {
        id: String(movie.id),
        title: credits?.title ?? movie.title,
        poster: credits?.poster ?? movie.poster,
        composer: credits?.composers.join(", ") ?? "",
        year: credits?.year ?? movie.year,
      };
      try {
        const cached = await getCachedSoundtrack(source.id);
        const isSuspicious = cachedSoundtrackLooksSuspicious(cached, source);
        const needsRefresh = !cached || soundtrackNeedsRefresh(cached) || isSuspicious;

        if (!needsRefresh) {
          const snapshot = serializeSoundtrack(cached!);
          if (source.composer && (!snapshot.composer || snapshot.composer === "Unknown composer")) {
            snapshot.composer = source.composer;
          }
          return { ...snapshot, tracksPending: false };
        }

        const queued = await scheduleSoundtrackRefresh(source);
        const snapshot = cached && !isSuspicious ? serializeSoundtrack(cached) : createPendingSoundtrack(source);
        if (snapshot && source.composer && (!snapshot.composer || snapshot.composer === "Unknown composer")) {
          snapshot.composer = source.composer;
        }
        return { ...snapshot, tracksPending: queued };
      } catch (error) {
        if (request.signal.aborted) throw error;
        console.error(`Failed to resolve soundtrack for TMDB movie ${source.id}:`, error);
        return {
          movieId: Number(source.id),
          movieTitle: source.title,
          poster: source.poster,
          composer: source.composer || "Unknown composer",
          tracks: [],
        };
      }
    }));

    const hasMore = movies.length >= pageSize;

    return apiSuccess(
      { items, page, pageSize, hasMore },
      200,
      {
        source: "tmdb",
        pagination: {
          page,
          limit: pageSize,
          hasMore,
          hasPrevious: page > 1,
        },
      }
    );
  } catch (error) {
    if (request.signal.aborted) return apiError("REQUEST_ABORTED", "Request aborted", 499);
    console.error("/api/soundtracks GET error:", error);
    return apiInternalError("Failed to fetch soundtracks");
  }
}

async function searchSoundtrackMovies(query: string, page: number, signal?: AbortSignal) {
  const cleanedQuery = cleanSoundtrackSearchQuery(query);
  const searches = [query, cleanedQuery].filter((value, index, values) =>
    value && values.indexOf(value) === index
  );
  const results = await Promise.all(
    searches.map((value) => searchMovies(value, page, { signal, suppressClientErrors: true }))
  );
  const byId = new Map<string, Awaited<ReturnType<typeof searchMovies>>[number]>();

  for (const movie of results.flat()) {
    if (!byId.has(String(movie.id))) {
      byId.set(String(movie.id), movie);
    }
  }

  return Array.from(byId.values());
}

function cleanSoundtrackSearchQuery(query: string) {
  return query
    .replace(/\b(original|motion|picture|soundtrack|score|ost|music|from|film|movie)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function scheduleSoundtrackRefresh(movie: Parameters<typeof enqueueSoundtrackRefresh>[0]) {
  try {
    await enqueueSoundtrackRefresh(movie);
    return true;
  } catch (error) {
    console.error("Failed to enqueue soundtrack refresh:", error);
    return false;
  }
}
