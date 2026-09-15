import { prisma } from "@/lib/prisma";
import { MusicBrainzUnavailableError, searchMusicBrainzSoundtrack } from "@/lib/musicbrainz";
import { searchYouTubeTrack } from "@/lib/youtube";
import type { Soundtrack } from "@/app/soundtracks/lib/types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MATCHER_REFRESHED_AT = new Date("2026-09-13T08:00:00.000Z");

type MovieSource = {
  id: string;
  title: string;
  poster: string;
  composer: string;
  year?: number;
};

type RefreshSoundtrackOptions = {
  force?: boolean;
};

export async function resolveSoundtrack(movie: MovieSource, signal?: AbortSignal): Promise<Soundtrack | null> {
  const cached = await getCachedSoundtrack(movie.id);
  if (cached && !cachedSoundtrackIsYoutubeFallback(cached)) {
    const resolved = serializeSoundtrack(cached);
    if ((!resolved.composer || resolved.composer === "Unknown composer") && movie.composer) {
      resolved.composer = movie.composer;
    }
    return resolved;
  }
  return createMetadataFallback(movie);
}

export async function getCachedSoundtrack(movieId: string) {
  return prisma.soundtrack.findUnique({
    where: { tmdbMovieId: movieId },
    include: { tracks: { orderBy: { position: "asc" } } },
  });
}

export function soundtrackNeedsRefresh(cached: Awaited<ReturnType<typeof getCachedSoundtrack>>) {
  return !cached
    || !cached.musicbrainzReleaseId
    || cachedSoundtrackIsYoutubeFallback(cached)
    || cached.lastFetchedAt < MATCHER_REFRESHED_AT
    || Date.now() - cached.lastFetchedAt.getTime() >= CACHE_TTL_MS;
}

export function cachedSoundtrackIsYoutubeFallback(cached: Awaited<ReturnType<typeof getCachedSoundtrack>>) {
  return Boolean(cached?.musicbrainzReleaseId?.startsWith("youtube:"));
}

export function cachedSoundtrackLooksSuspicious(
  cached: Awaited<ReturnType<typeof getCachedSoundtrack>>,
  movie: MovieSource
) {
  if (!cached?.musicbrainzReleaseId) return false;
  if (cachedSoundtrackIsYoutubeFallback(cached)) return true;

  const releaseName = normalize(cached.musicbrainzReleaseName ?? cached.movieTitle);
  const movieTitle = normalize(movie.title);
  const hasMovieTitle = Boolean(movieTitle && releaseName.includes(movieTitle));
  const composerTokens = parseComposerTokens(movie.composer);
  const hasComposerMatch = composerTokens.length > 0
    && cached.tracks.some((track) => {
      const artist = normalize(track.artist);
      return composerTokens.some((token) => artist.includes(token));
    });

  if (composerTokens.length > 0) {
    return !hasMovieTitle && !hasComposerMatch;
  }

  return !hasMovieTitle;
}

export async function refreshSoundtrack(
  movie: MovieSource,
  signal?: AbortSignal,
  options: RefreshSoundtrackOptions = {}
): Promise<Soundtrack | null> {
  const cached = await getCachedSoundtrack(movie.id);
  if (cached && !options.force && !soundtrackNeedsRefresh(cached)) return serializeSoundtrack(cached);

  try {
    const musicbrainz = await searchMusicBrainzSoundtrack(movie, signal);

    if (!musicbrainz) {
      return cached && !cachedSoundtrackIsYoutubeFallback(cached)
        ? serializeSoundtrack(cached)
        : createMetadataFallback(movie);
    }

    const composer = inferComposer(movie.composer, musicbrainz.tracks);

    const saved = await prisma.soundtrack.upsert({
      where: { tmdbMovieId: movie.id },
      update: {
        movieTitle: movie.title,
        poster: movie.poster || null,
        composer,
        musicbrainzReleaseId: musicbrainz.releaseId,
        musicbrainzReleaseName: musicbrainz.releaseName,
        lastFetchedAt: new Date(),
        tracks: {
          deleteMany: {},
          create: musicbrainz.tracks.map((track, position) => ({
            musicbrainzRecordingId: track.recordingId,
            musicbrainzReleaseId: track.releaseId,
            musicbrainzArtistId: track.artistId,
            title: track.title,
            artist: track.artist,
            durationMs: track.durationMs,
            position,
          })),
        },
      },
      create: {
        tmdbMovieId: movie.id,
        movieTitle: movie.title,
        poster: movie.poster || null,
        composer,
        musicbrainzReleaseId: musicbrainz.releaseId,
        musicbrainzReleaseName: musicbrainz.releaseName,
        tracks: {
          create: musicbrainz.tracks.map((track, position) => ({
            musicbrainzRecordingId: track.recordingId,
            musicbrainzReleaseId: track.releaseId,
            musicbrainzArtistId: track.artistId,
            title: track.title,
            artist: track.artist,
            durationMs: track.durationMs,
            position,
          })),
        },
      },
      include: { tracks: { orderBy: { position: "asc" } } },
    });

    return serializeSoundtrack(saved);
  } catch (error) {
    if (error instanceof MusicBrainzUnavailableError) {
      console.warn("MusicBrainz unavailable; keeping cached or empty soundtrack instead of using YouTube fallback:", error.message);
      return cached && !cachedSoundtrackIsYoutubeFallback(cached)
        ? serializeSoundtrack(cached)
        : createMetadataFallback(movie);
    }

    if (!isRequestAborted(error, signal)) {
      console.error("Soundtrack refresh failed; using cached data when available:", error);
    }
    return cached && !cachedSoundtrackIsYoutubeFallback(cached)
      ? serializeSoundtrack(cached)
      : createMetadataFallback(movie);
  }
}

export async function resolveTrackYoutube(movieId: string, recordingId: string, signal?: AbortSignal) {
  const soundtrack = await prisma.soundtrack.findUnique({ where: { tmdbMovieId: movieId } });
  if (!soundtrack) return null;
  const track = await prisma.soundtrackTrack.findUnique({
    where: { soundtrackId_musicbrainzRecordingId: { soundtrackId: soundtrack.id, musicbrainzRecordingId: recordingId } },
    include: { soundtrack: true },
  });
  if (!track) return null;
  if (track.youtubeVideoId) return track.youtubeVideoId;

  const youtubeVideoId = await searchYouTubeTrack(track.soundtrack.movieTitle, track.title, track.artist, signal);
  if (youtubeVideoId) {
    await prisma.soundtrackTrack.update({ where: { id: track.id }, data: { youtubeVideoId } });
  }
  return youtubeVideoId;
}

/*
 * Keep the old resolver as a cheap read for callers that do not need to block on provider refreshes.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
async function legacyResolveSoundtrack(movie: MovieSource, signal?: AbortSignal): Promise<Soundtrack | null> {
  const cached = await prisma.soundtrack.findUnique({
    where: { tmdbMovieId: movie.id },
    include: { tracks: { orderBy: { position: "asc" } } },
  });
  const cachedWithProviderFields = cached as (typeof cached & { musicbrainzReleaseId?: string | null }) | null;
  if (cached && Date.now() - cached.lastFetchedAt.getTime() < CACHE_TTL_MS && cachedWithProviderFields?.musicbrainzReleaseId) {
    return serializeSoundtrack(cached);
  }

  try {
    const musicbrainz = await searchMusicBrainzSoundtrack(movie, signal);

    if (!musicbrainz) {
      return serializeSoundtrack(await saveMetadataFallback(movie));
    }

    const tracks = await Promise.all(musicbrainz.tracks.map(async (track) => ({
      ...track,
      youtubeVideoId: await searchYouTubeTrack(movie.title, track.title, track.artist, signal),
    })));

    const saved = await prisma.soundtrack.upsert({
      where: { tmdbMovieId: movie.id },
      update: {
        movieTitle: movie.title,
        poster: movie.poster || null,
        composer: movie.composer || null,
        musicbrainzReleaseId: musicbrainz.releaseId,
        musicbrainzReleaseName: musicbrainz.releaseName,
        lastFetchedAt: new Date(),
        tracks: {
          deleteMany: {},
          create: tracks.map((track, position) => ({
            musicbrainzRecordingId: track.recordingId,
            musicbrainzReleaseId: track.releaseId,
            musicbrainzArtistId: track.artistId,
            youtubeVideoId: track.youtubeVideoId,
            title: track.title,
            artist: track.artist,
            durationMs: track.durationMs,
            position,
          })),
        },
      },
      create: {
        tmdbMovieId: movie.id,
        movieTitle: movie.title,
        poster: movie.poster || null,
        composer: movie.composer || null,
        musicbrainzReleaseId: musicbrainz.releaseId,
        musicbrainzReleaseName: musicbrainz.releaseName,
        tracks: {
          create: tracks.map((track, position) => ({
            musicbrainzRecordingId: track.recordingId,
            musicbrainzReleaseId: track.releaseId,
            musicbrainzArtistId: track.artistId,
            youtubeVideoId: track.youtubeVideoId,
            title: track.title,
            artist: track.artist,
            durationMs: track.durationMs,
            position,
          })),
        },
      },
      include: { tracks: { orderBy: { position: "asc" } } },
    });

    return serializeSoundtrack(saved);
  } catch (error) {
    if (!isRequestAborted(error, signal)) {
      console.error("Soundtrack refresh failed; using cached data when available:", error);
    }
    return cached ? serializeSoundtrack(cached) : createMetadataFallback(movie);
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

function isRequestAborted(error: unknown, signal?: AbortSignal) {
  return signal?.aborted || (error instanceof Error && (error.name === "AbortError" || error.name === "ResponseAborted"));
}

function parseComposerTokens(composer?: string) {
  return Array.from(
    new Set(
      (composer ?? "")
        .split(",")
        .map((entry) => normalize(entry))
        .filter(Boolean)
        .flatMap((entry) => entry.split(" ").filter((part) => part.length > 2))
    )
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function createMetadataFallback(movie: MovieSource): Soundtrack {
  return {
    movieId: Number(movie.id),
    movieTitle: movie.title,
    poster: movie.poster,
    composer: movie.composer || "Unknown composer",
    tracks: [],
  };
}

export function createPendingSoundtrack(movie: MovieSource): Soundtrack {
  return {
    ...createMetadataFallback(movie),
    tracksPending: true,
  };
}

function inferComposer(
  composer: string | null | undefined,
  tracks: Array<{ artist: string }>
) {
  const normalizedComposer = composer?.trim();
  if (normalizedComposer) return normalizedComposer;

  const artistCounts = new Map<string, number>();
  for (const track of tracks) {
    const artist = track.artist.trim();
    if (!artist || /unknown artist|various artists?/i.test(artist)) continue;
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
  }

  const rankedArtists = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (rankedArtists.length === 0) return null;
  if (rankedArtists.length === 1 || rankedArtists[0][1] >= Math.max(2, tracks.length * 0.5)) {
    return rankedArtists[0][0];
  }

  return "Various artists";
}

async function saveMetadataFallback(movie: MovieSource) {
  return prisma.soundtrack.upsert({
    where: { tmdbMovieId: movie.id },
    update: {
      movieTitle: movie.title,
      poster: movie.poster || null,
      composer: movie.composer || null,
      lastFetchedAt: new Date(),
    },
    create: {
      tmdbMovieId: movie.id,
      movieTitle: movie.title,
      poster: movie.poster || null,
      composer: movie.composer || null,
      tracks: { create: [] },
    },
    include: { tracks: { orderBy: { position: "asc" } } },
  });
}

export function serializeSoundtrack(value: {
  id: string;
  tmdbMovieId: string;
  movieTitle: string;
  poster: string | null;
  composer: string | null;
  musicbrainzReleaseId?: string | null;
  musicbrainzReleaseName?: string | null;
  tracks: Array<{ musicbrainzRecordingId: string; musicbrainzReleaseId?: string | null; musicbrainzArtistId?: string | null; youtubeVideoId?: string | null; title: string; artist: string; durationMs: number }>;
}): Soundtrack & { soundtrackId: string } {
  const composer = inferComposer(value.composer, value.tracks);

  return {
    soundtrackId: value.id,
    movieId: Number(value.tmdbMovieId),
    movieTitle: value.movieTitle,
    poster: value.poster ?? "",
    composer: composer ?? "Unknown composer",
    musicbrainzReleaseId: value.musicbrainzReleaseId ?? undefined,
    musicbrainzReleaseName: value.musicbrainzReleaseName ?? undefined,
    tracks: value.tracks.map((track) => ({
      id: track.musicbrainzRecordingId,
      title: track.title,
      artist: track.artist,
      duration: formatDuration(track.durationMs),
      musicbrainzRecordingId: track.musicbrainzRecordingId ?? undefined,
      musicbrainzReleaseId: track.musicbrainzReleaseId ?? undefined,
      musicbrainzArtistId: track.musicbrainzArtistId ?? undefined,
      youtubeVideoId: track.youtubeVideoId ?? undefined,
    })),
  };
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
