import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getMovieDetails, getSimilarMovies, getTrendingMovies, getMoviesByGenre } from "@/lib/tmdb";
import telemetry from "@/lib/prefetchTelemetry";

type PrefetchStats = {
  attempts: number;
  skipped: number;
  succeeded: number;
  failed: number;
  cancelled: number;
};

type PrefetchTask = {
  token: string;
  client: QueryClient;
  queryKey: QueryKey;
  queryFn: () => Promise<any>;
};

const PREFETCH_MAX_CONCURRENCY = 2;
const PREFETCH_STALE_TIME_MS = 5 * 60 * 1000;
let activePrefetchCount = 0;
const queuedTasks: PrefetchTask[] = [];
const queuedByToken = new Map<string, PrefetchTask>();
const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightQueryKeys = new Set<string>();

let prefetchStats: PrefetchStats = { attempts: 0, skipped: 0, succeeded: 0, failed: 0, cancelled: 0 };

function queryKeyHash(queryKey: QueryKey): string {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return String(queryKey);
  }
}

function removeQueuedTask(token: string) {
  const existing = queuedByToken.get(token);
  if (!existing) return;
  const index = queuedTasks.indexOf(existing);
  if (index >= 0) queuedTasks.splice(index, 1);
  queuedByToken.delete(token);
}

function runPrefetchQueue() {
  while (activePrefetchCount < PREFETCH_MAX_CONCURRENCY && queuedTasks.length > 0) {
    const task = queuedTasks.shift();
    if (!task) return;
    queuedByToken.delete(task.token);
    void executePrefetchTask(task);
  }
}

async function executePrefetchTask(task: PrefetchTask) {
  const keyHash = queryKeyHash(task.queryKey);

  if (inFlightQueryKeys.has(keyHash)) {
    prefetchStats.skipped++;
    try { telemetry.recordPrefetchSkipped(); } catch {}
    return;
  }

  try {
    const state = task.client.getQueryState(task.queryKey as any);
    // Skip if cache is already warm or query is already being fetched.
    if (state?.data || (state as any)?.fetchStatus === "fetching") {
      prefetchStats.skipped++;
      try { telemetry.recordPrefetchSkipped(); } catch {}
      return;
    }

    activePrefetchCount++;
    inFlightQueryKeys.add(keyHash);

    await task.client.prefetchQuery({
      queryKey: task.queryKey as any,
      queryFn: task.queryFn,
      staleTime: PREFETCH_STALE_TIME_MS,
    });
    prefetchStats.succeeded++;
    try { telemetry.recordPrefetchSucceeded(task.queryKey); } catch {}
  } catch (e) {
    prefetchStats.failed++;
    try { telemetry.recordPrefetchFailed(); } catch {}
    console.debug("executePrefetchTask failed", e);
  } finally {
    if (inFlightQueryKeys.has(keyHash)) {
      inFlightQueryKeys.delete(keyHash);
      activePrefetchCount = Math.max(0, activePrefetchCount - 1);
    }
    runPrefetchQueue();
  }
}

function schedulePrefetchTask(options: {
  token: string;
  client: QueryClient;
  queryKey: QueryKey;
  queryFn: () => Promise<any>;
  delayMs?: number;
}) {
  prefetchStats.attempts++;
  try { telemetry.recordPrefetchAttempt(); } catch {}

  cancelScheduledPrefetch(options.token);

  const timeoutId = setTimeout(() => {
    scheduledTimers.delete(options.token);
    const task: PrefetchTask = {
      token: options.token,
      client: options.client,
      queryKey: options.queryKey,
      queryFn: options.queryFn,
    };
    queuedTasks.push(task);
    queuedByToken.set(options.token, task);
    runPrefetchQueue();
  }, options.delayMs ?? 150);

  scheduledTimers.set(options.token, timeoutId);
}

export function cancelScheduledPrefetch(token: string) {
  const timeoutId = scheduledTimers.get(token);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledTimers.delete(token);
    prefetchStats.cancelled++;
    try { telemetry.recordPrefetchCancelled(); } catch {}
  }

  if (queuedByToken.has(token)) {
    removeQueuedTask(token);
    prefetchStats.cancelled++;
    try { telemetry.recordPrefetchCancelled(); } catch {}
  }
}

export function getPrefetchStats(): PrefetchStats {
  return { ...prefetchStats };
}

export function resetPrefetchStats() {
  prefetchStats = { attempts: 0, skipped: 0, succeeded: 0, failed: 0, cancelled: 0 };
}

export async function safePrefetchQuery(client: QueryClient, options: { queryKey: QueryKey; queryFn: () => Promise<any> }) {
  prefetchStats.attempts++;
  try { telemetry.recordPrefetchAttempt(); } catch {}
  try {
    const state = client.getQueryState(options.queryKey as any);
    // If we already have data or a fetch is in progress, skip prefetch
    if (state?.data || (state as any)?.fetchStatus === "fetching") {
      prefetchStats.skipped++;
      try { telemetry.recordPrefetchSkipped(); } catch {}
      return;
    }
    await client.prefetchQuery({
      queryKey: options.queryKey as any,
      queryFn: options.queryFn,
      staleTime: PREFETCH_STALE_TIME_MS,
    });
    prefetchStats.succeeded++;
    try { telemetry.recordPrefetchSucceeded(options.queryKey); } catch {}
  } catch (e) {
    prefetchStats.failed++;
    try { telemetry.recordPrefetchFailed(); } catch {}
    // best-effort
    console.debug("safePrefetchQuery failed", e);
  }
}

export function scheduleMovieDetailPrefetch(client: QueryClient, movieId: string, token: string, delayMs = 150) {
  return Promise.resolve().then(() => {
    schedulePrefetchTask({
      token,
      client,
      queryKey: queryKeys.movie.detail(movieId),
      queryFn: () => getMovieDetails(movieId, { suppressClientErrors: true }),
      delayMs,
    });
  });
}

export function scheduleMovieTrailerPrefetch(client: QueryClient, movieId: string, token: string, delayMs = 150) {
  schedulePrefetchTask({
    token,
    client,
    queryKey: queryKeys.movie.videos(movieId),
    queryFn: async () => {
      const response = await fetch(`/api/tmdb/videos/${movieId}`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    delayMs,
  });
}

export function scheduleDiscoverSeedsPrefetch(client: QueryClient, token: string, delayMs = 150, params?: string) {
  schedulePrefetchTask({
    token,
    client,
    queryKey: queryKeys.discover.seeds(params),
    queryFn: () => getTrendingMovies(1, { suppressClientErrors: true }),
    delayMs,
  });
}

export async function prefetchMovieDetail(client: QueryClient, movieId: string) {
  try {
    await safePrefetchQuery(client, { queryKey: queryKeys.movie.detail(movieId), queryFn: () => getMovieDetails(movieId, { suppressClientErrors: true }) });
  } catch (e) {
    // best-effort
    console.error("prefetchMovieDetail failed", e);
  }
}

export async function prefetchMovieAndSimilar(client: QueryClient, movieId: string) {
  try {
    await Promise.all([
      safePrefetchQuery(client, { queryKey: queryKeys.movie.detail(movieId), queryFn: () => getMovieDetails(movieId, { suppressClientErrors: true }) }),
      safePrefetchQuery(client, { queryKey: queryKeys.movie.recommendations(movieId), queryFn: () => getSimilarMovies(movieId, { suppressClientErrors: true }) }),
    ]);
  } catch (e) {
    console.error("prefetchMovieAndSimilar failed", e);
  }
}

export async function prefetchDiscoverSeeds(client: QueryClient, params?: string) {
  try {
    // Simple heuristic: prefetch trending movies and cache under discover seeds key
    await safePrefetchQuery(client, { queryKey: queryKeys.discover.seeds(params), queryFn: () => getTrendingMovies(1, { suppressClientErrors: true }) });
  } catch (e) {
    console.error("prefetchDiscoverSeeds failed", e);
  }
}

export async function prefetchMoviesByGenre(client: QueryClient, genreId: number) {
  try {
    await safePrefetchQuery(client, { queryKey: queryKeys.movie.list({ genreId }), queryFn: () => getMoviesByGenre(genreId, 1, { suppressClientErrors: true }) });
  } catch (e) {
    console.error("prefetchMoviesByGenre failed", e);
  }
}

export default {
  prefetchMovieDetail,
  prefetchMovieAndSimilar,
  prefetchDiscoverSeeds,
  prefetchMoviesByGenre,
  scheduleMovieDetailPrefetch,
  scheduleDiscoverSeedsPrefetch,
  cancelScheduledPrefetch,
};
