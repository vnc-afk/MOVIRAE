import { withRedisCachedNullable } from "@/lib/redis-cache";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const NEGATIVE_CACHE_TTL_SECONDS = 60 * 15;
type YouTubeSearchItem = { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } };

export class YouTubeApiError extends Error {
  constructor(public readonly status: number) {
    super(`YouTube API request failed with status ${status}`);
    this.name = "YouTubeApiError";
  }
}

export async function searchYouTubeTrack(movieTitle: string, title: string, artist: string, signal?: AbortSignal): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  const cacheKey = `v4:${movieTitle}:${title}:${artist}`.toLowerCase();
  return withRedisCachedNullable("youtube-soundtrack", cacheKey, async () => {
    try {
      const queryVariants = buildYouTubeTrackQueries(movieTitle, title, artist);
      const byVideoId = new Map<string, YouTubeSearchItem>();

      for (const query of queryVariants) {
        const params = new URLSearchParams({ part: "snippet", q: query, type: "video", videoCategoryId: "10", maxResults: "8", key: apiKey });
        const response = await fetch(`${YOUTUBE_API_URL}?${params}`, { signal, cache: "no-store" });
        if (!response.ok) {
          if (response.status === 403 || response.status === 429) throw new YouTubeApiError(response.status);
          continue;
        }

        const payload = await response.json() as { items?: YouTubeSearchItem[] };
        const candidates = (payload.items ?? []).filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.id?.videoId ?? ""));
        for (const item of candidates) {
          const videoId = item.id?.videoId;
          if (!videoId || byVideoId.has(videoId)) continue;
          byVideoId.set(videoId, item);
        }
      }

      const normalizedTitle = normalize(title);
      const normalizedArtist = normalize(artist);
      const normalizedMovieTitle = normalize(movieTitle);
      const match = Array.from(byVideoId.values())
        .sort((a, b) => scoreVideo(b, normalizedTitle, normalizedArtist, normalizedMovieTitle) - scoreVideo(a, normalizedTitle, normalizedArtist, normalizedMovieTitle))[0];
      const score = match ? scoreVideo(match, normalizedTitle, normalizedArtist, normalizedMovieTitle) : 0;

      return score >= getTrackPreviewThreshold(normalizedTitle) ? match?.id?.videoId ?? null : null;
    } catch (error) {
      if (error instanceof YouTubeApiError) throw error;
      if (!(error instanceof Error && error.name === "AbortError")) {
        console.error("YouTube soundtrack lookup failed:", error);
      }
      return null;
    }
  }, CACHE_TTL_SECONDS, NEGATIVE_CACHE_TTL_SECONDS);
}

export async function searchYouTubeSoundtrack(movieTitle: string, composer?: string, signal?: AbortSignal): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `v2:${movieTitle}:${composer ?? ""}:soundtrack-preview`.toLowerCase();
  return withRedisCachedNullable("youtube-soundtrack", cacheKey, async () => {
    try {
      const queryVariants = buildYouTubeSoundtrackQueries(movieTitle, composer ?? "");
      const byVideoId = new Map<string, YouTubeSearchItem>();

      for (const query of queryVariants) {
        const params = new URLSearchParams({ part: "snippet", q: query, type: "video", videoCategoryId: "10", maxResults: "10", key: apiKey });
        const response = await fetch(`${YOUTUBE_API_URL}?${params}`, { signal, cache: "no-store" });
        if (!response.ok) {
          if (response.status === 403 || response.status === 429) throw new YouTubeApiError(response.status);
          continue;
        }

        const payload = await response.json() as { items?: YouTubeSearchItem[] };
        const candidates = (payload.items ?? []).filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.id?.videoId ?? ""));
        for (const item of candidates) {
          const videoId = item.id?.videoId;
          if (!videoId || byVideoId.has(videoId)) continue;
          byVideoId.set(videoId, item);
        }
      }

      const normalizedMovieTitle = normalize(movieTitle);
      const normalizedComposer = normalize(composer ?? "");
      const match = Array.from(byVideoId.values())
        .sort((a, b) => scoreSoundtrackVideo(b, normalizedMovieTitle, normalizedComposer) - scoreSoundtrackVideo(a, normalizedMovieTitle, normalizedComposer))[0];

      return match && scoreSoundtrackVideo(match, normalizedMovieTitle, normalizedComposer) > 20
        ? match.id?.videoId ?? null
        : null;
    } catch (error) {
      if (error instanceof YouTubeApiError) throw error;
      if (!(error instanceof Error && error.name === "AbortError")) {
        console.error("YouTube soundtrack lookup failed:", error);
      }
      return null;
    }
  }, CACHE_TTL_SECONDS, NEGATIVE_CACHE_TTL_SECONDS);
}

function buildYouTubeSoundtrackQueries(movieTitle: string, composer: string) {
  const queries = [
    `${movieTitle} original motion picture soundtrack`,
    `${movieTitle} original motion picture score`,
    `${movieTitle} soundtrack full album`,
    [movieTitle, composer, "soundtrack"].filter(Boolean).join(" "),
  ].filter((query) => query.trim().length > 0);

  return Array.from(new Set(queries));
}

function buildYouTubeTrackQueries(movieTitle: string, title: string, artist: string) {
  const cleanArtist = /unknown artist|various artists?/i.test(artist) ? "" : artist;
  const queries = [
    [title, cleanArtist, movieTitle, "official audio"].filter(Boolean).join(" "),
    [title, cleanArtist, movieTitle, "soundtrack"].filter(Boolean).join(" "),
    [title, movieTitle, "original motion picture soundtrack"].filter(Boolean).join(" "),
    [title, cleanArtist].filter(Boolean).join(" "),
  ].filter((query) => query.trim().length > 0);

  return Array.from(new Set(queries));
}

function scoreVideo(item: { snippet?: { title?: string; channelTitle?: string } }, title: string, artist: string, movieTitle: string) {
  const text = normalize(`${item.snippet?.title ?? ""} ${item.snippet?.channelTitle ?? ""}`);
  const trackTitleMatches = title && text.includes(title);
  const trackTokensMatch = doImportantTokensMatch(title, text);
  const movieMatches = movieTitle && text.includes(movieTitle);
  const artistMatches = artist && text.includes(artist);

  return (trackTitleMatches ? 45 : 0)
    + (!trackTitleMatches && trackTokensMatch ? 25 : 0)
    + (movieMatches ? 30 : 0)
    + (artistMatches ? 25 : 0)
    + (/(soundtrack|score|ost|motion picture|provided to youtube)/.test(text) ? 15 : 0)
    + (/(official|audio|records|vevo|topic)/.test(text) ? 10 : 0)
    - (/(cover|live|remix|karaoke|tribute|reaction|tutorial|instrumental cover)/.test(text) ? 40 : 0)
    - (!trackTitleMatches && !trackTokensMatch ? 45 : 0)
    - (!movieMatches && !artistMatches ? 20 : 0);
}

function getTrackPreviewThreshold(title: string) {
  return isGenericTrackTitle(title) ? 80 : 60;
}

function isGenericTrackTitle(title: string) {
  return /^(main title|end title|opening|prologue|finale|final credits|credits|theme|suite)$/.test(title);
}

function doImportantTokensMatch(title: string, text: string) {
  const tokens = title.split(" ").filter((token) => token.length > 2 && !["the", "and", "for", "with"].includes(token));
  if (tokens.length === 0) return false;
  return tokens.every((token) => text.includes(token));
}

function scoreSoundtrackVideo(item: { snippet?: { title?: string; channelTitle?: string } }, movieTitle: string, composer: string) {
  const text = normalize(`${item.snippet?.title ?? ""} ${item.snippet?.channelTitle ?? ""}`);
  return (movieTitle && text.includes(movieTitle) ? 45 : 0)
    + (composer && text.includes(composer) ? 25 : 0)
    + (/(soundtrack|score|ost|motion picture|full album|complete soundtrack|music from)/.test(text) ? 35 : 0)
    + (/(official|audio|records|vevo|provided to youtube)/.test(text) ? 10 : 0)
    - (/(trailer|teaser|review|reaction|cover|karaoke|remix|live)/.test(text) ? 35 : 0);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
