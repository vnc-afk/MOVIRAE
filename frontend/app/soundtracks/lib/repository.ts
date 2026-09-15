import type { Soundtrack, SoundtrackPage } from "./types";

interface SoundtracksApiResponse {
  success: true;
  data: SoundtrackPage;
}

const pageCache = new Map<string, SoundtrackPage>();

export async function fetchSoundtrackPage(
  search: string,
  page: number,
  signal?: AbortSignal
): Promise<SoundtrackPage> {
  if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
  const normalizedSearch = search.trim().toLowerCase();
  const key = `${normalizedSearch || "trending"}:${page}`;
  const cached = pageCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ page: String(page) });
  if (normalizedSearch) params.set("q", search.trim());
  const response = await fetch(`/api/soundtracks?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Soundtrack request failed with status ${response.status}`);
  const payload = (await response.json()) as SoundtracksApiResponse | {
    success: false;
    error?: { message?: string };
  };
  if (!payload.success) throw new Error(payload.error?.message ?? "Failed to fetch soundtracks");
  const result = payload.data;
  pageCache.set(key, result);
  return result;
}

export function clearSoundtrackCache(): void {
  pageCache.clear();
}

export async function prioritizeSoundtrackRefresh(movieId: number, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`/api/soundtracks/${movieId}`, {
    method: "POST",
    signal,
  });
  return response.ok;
}

export async function fetchSoundtrackByMovieId(movieId: number, signal?: AbortSignal): Promise<Soundtrack | null> {
  const response = await fetch(`/api/soundtracks/${movieId}`, { signal, cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json() as { value?: Soundtrack };
  return payload.value ?? null;
}
