import { withRedisCached } from "@/lib/redis-cache";

const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const MIN_REQUEST_INTERVAL_MS = 250;
let lastRequestAt = 0;
let requestQueue = Promise.resolve();

export class MusicBrainzUnavailableError extends Error {
  constructor(message = "MusicBrainz is temporarily unavailable") {
    super(message);
    this.name = "MusicBrainzUnavailableError";
  }
}

type MusicBrainzRecording = {
  id: string;
  title: string;
  length?: number;
  "artist-credit"?: Array<{ artist?: { id?: string; name?: string }; name?: string }>;
};

type MusicBrainzMovieContext = {
  title: string;
  year?: number;
  composer?: string;
};

type MusicBrainzSecondaryType = string | { title?: string };

type MusicBrainzSearchRelease = {
  id: string;
  title: string;
  score?: number;
  date?: string;
  "release-group"?: {
    "primary-type"?: string;
    "first-release-date"?: string;
    "secondary-types"?: MusicBrainzSecondaryType[];
  };
};

type MusicBrainzRelease = {
  id: string;
  title: string;
  date?: string;
  media?: Array<{
    tracks?: Array<{
      position?: number;
      recording?: MusicBrainzRecording;
      "artist-credit"?: MusicBrainzRecording["artist-credit"];
    }>;
  }>;
  "release-group"?: {
    "primary-type"?: string;
    "first-release-date"?: string;
    "secondary-types"?: MusicBrainzSecondaryType[];
  };
};

export type MusicBrainzSoundtrack = {
  releaseId: string;
  releaseName: string;
  tracks: Array<{
    recordingId: string;
    releaseId: string;
    title: string;
    artist: string;
    artistId?: string;
    durationMs: number;
    position: number;
  }>;
};

export async function searchMusicBrainzSoundtrack(movie: MusicBrainzMovieContext | string, signal?: AbortSignal): Promise<MusicBrainzSoundtrack | null> {
  const movieContext = typeof movie === "string" ? { title: movie } : movie;
  const key = `${movieContext.title}:${movieContext.year ?? ""}`.trim().toLowerCase();
  if (!key) return null;

  return withRedisCached("musicbrainz-soundtrack", key, async () => {
    const releases = await searchReleaseCandidates(movieContext, signal);
    if (!releases.length) return null;

    const ranked = releases
      .map((release) => ({ release, score: scoreMusicBrainzRelease(release, movieContext) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const candidates = ranked.slice(0, 10);
    if (!candidates.length) return null;

    const detailedReleases = await Promise.all(candidates.map(async ({ release, score }) => {
      const detail = await musicBrainzFetch<MusicBrainzRelease>(`/release/${encodeURIComponent(release.id)}?inc=recordings+artist-credits+release-groups&fmt=json`, signal);
      return detail ? { detail, score } : null;
    }));

    const availableDetails = detailedReleases
      .filter((entry): entry is { detail: MusicBrainzRelease; score: number } => Boolean(entry));

    if (!availableDetails.length) {
      throw new MusicBrainzUnavailableError("MusicBrainz release details could not be loaded");
    }

    const scoredDetails = availableDetails
      .map(({ detail, score }) => ({ detail, score: scoreMusicBrainzDetail(detail, movieContext, score) }))
      .filter((entry) => isAcceptableSoundtrackDetail(entry.detail, movieContext, entry.score))
      .sort((a, b) => b.score - a.score);

    if (!scoredDetails.length) return null;

    const bestDetail = scoredDetails[0].detail;

    const mergedTracks = new Map<string, MusicBrainzSoundtrack["tracks"][number]>();

    for (const medium of bestDetail.media ?? []) {
      for (const track of medium.tracks ?? []) {
        const recording = track.recording;
        if (!recording?.id || !recording.title) continue;

        const credits = recording["artist-credit"]?.length ? recording["artist-credit"] : track["artist-credit"] ?? [];
        const trackId = recording.id;
        const artist = credits.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") || "Unknown artist";

        const existing = mergedTracks.get(trackId);
        if (!existing || (existing.artist === "Unknown artist" && artist !== "Unknown artist")) {
          mergedTracks.set(trackId, {
            recordingId: recording.id,
            releaseId: bestDetail.id,
            title: recording.title,
            artist,
            artistId: credits[0]?.artist?.id,
            durationMs: recording.length ?? 0,
            position: track.position ?? Number.MAX_SAFE_INTEGER,
          });
        }
      }
    }

    if (mergedTracks.size === 0) return null;

    const tracks = Array.from(mergedTracks.values())
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

    return {
      releaseId: bestDetail.id,
      releaseName: bestDetail.title,
      tracks,
    };
  }, CACHE_TTL_SECONDS);
}

export function scoreMusicBrainzRelease(release: MusicBrainzSearchRelease, movie: MusicBrainzMovieContext) {
  const title = normalize(release.title);
  const normalizedMovie = normalize(movie.title);
  const titleMatchesMovie = doesReleaseTitleMatchMovie(title, normalizedMovie);
  const releaseYear = getReleaseYear(release);
  const releaseGroup = release["release-group"];
  const secondaryTypes = normalizeSecondaryTypes(releaseGroup?.["secondary-types"]);
  const primaryType = normalize(releaseGroup?.["primary-type"] ?? "");

  let score = release.score ?? 0;

  if (normalizedMovie && title.includes(normalizedMovie)) {
    score += 120;
  } else if (titleMatchesMovie) {
    score += 75;
  }

  if (normalizedMovie && title.startsWith(normalizedMovie)) {
    score += 40;
  }

  const hasSoundtrackSignals = /(soundtrack|score|motion picture|motion-picture|original|ost|film)/.test(title) || /(soundtrack|score|ost|film)/.test(primaryType) || /(soundtrack|score|ost|film)/.test(secondaryTypes);

  if (hasSoundtrackSignals) {
    score += 80;
  }

  if (/(soundtrack|score|ost|film)/.test(primaryType) || /(soundtrack|score|ost|film)/.test(secondaryTypes)) {
    score += 60;
  }

  if (movie.composer && !hasSoundtrackSignals) {
    score -= 150;
  }

  if (movie.year) {
    if (releaseYear === movie.year) {
      score += 50;
    } else if (releaseYear && Math.abs(releaseYear - movie.year) <= 1) {
      score += 20;
    } else if (releaseYear) {
      score -= 120;
    }
  }

  if (/(live|remix|cover|tribute|karaoke|concert|demo|radio)/.test(title)) {
    score -= 60;
  }

  if (!normalizedMovie || (!titleMatchesMovie && !/(soundtrack|score|ost|film)/.test(title))) {
    score -= 90;
  }

  return score;
}

export function scoreMusicBrainzDetail(detail: MusicBrainzRelease, movie: MusicBrainzMovieContext, baseScore = 0) {
  let score = baseScore;
  const title = normalize(detail.title);
  const normalizedMovie = normalize(movie.title);
  const titleMatchesMovie = doesReleaseTitleMatchMovie(title, normalizedMovie);
  const releaseGroup = detail["release-group"];
  const secondaryTypes = normalizeSecondaryTypes(releaseGroup?.["secondary-types"]);
  const primaryType = normalize(releaseGroup?.["primary-type"] ?? "");
  const releaseYear = getReleaseYear(detail);
  const trackArtistNames = (detail.media ?? [])
    .flatMap((medium) => medium.tracks ?? [])
    .map((track) => track.recording?.["artist-credit"]?.length ? track.recording["artist-credit"] : track["artist-credit"] ?? [])
    .flat()
    .map((credit) => normalize(credit.name ?? credit.artist?.name ?? ""))
    .filter(Boolean);

  if (/(soundtrack|score|motion picture|motion-picture|original|ost|film)/.test(title)) {
    score += 40;
  }

  if (titleMatchesMovie && !title.includes(normalizedMovie)) {
    score += 35;
  }

  if (/(soundtrack|score|ost|film)/.test(primaryType) || /(soundtrack|score|ost|film)/.test(secondaryTypes)) {
    score += 45;
  }

  if (movie.year && releaseYear) {
    if (releaseYear === movie.year) {
      score += 45;
    } else if (Math.abs(releaseYear - movie.year) <= 1) {
      score += 20;
    } else {
      score -= 160;
    }
  }

  const composerTokens = parseComposerTokens(movie.composer);
  if (composerTokens.length > 0) {
    const matchingArtists = new Set(
      trackArtistNames.filter((artist) => composerTokens.some((token) => artist.includes(token)))
    );

    if (matchingArtists.size > 0) {
      score += matchingArtists.size * 35;
    } else {
      score -= 140;
    }
  }

  if (trackArtistNames.length > 0 && !trackArtistNames.some((artist) => artist.includes(normalizedMovie))) {
    score -= 10;
  }

  if (detail.media?.some((medium) => medium.tracks?.some((track) => track.recording?.title && normalize(track.recording.title).includes(normalizedMovie)))) {
    score += 25;
  }

  return score;
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

function doesReleaseTitleMatchMovie(releaseTitle: string, movieTitle: string) {
  if (!movieTitle) return false;
  if (releaseTitle.includes(movieTitle)) return true;

  const movieTokens = getTitleTokens(movieTitle);
  if (movieTokens.length === 0) return false;

  const releaseTokens = new Set(getTitleTokens(releaseTitle));
  const matchingTokens = movieTokens.filter((token) => releaseTokens.has(token)).length;
  const requiredMatches = movieTokens.length <= 2 ? movieTokens.length : Math.ceil(movieTokens.length * 0.67);

  return matchingTokens >= requiredMatches;
}

function getTitleTokens(value: string) {
  const aliases: Record<string, string> = {
    ii: "2",
    iii: "3",
    iv: "4",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    pt: "part",
  };
  const stopWords = new Set(["a", "an", "and", "from", "in", "of", "original", "picture", "score", "soundtrack", "the"]);

  return normalize(value)
    .split(" ")
    .map((token) => aliases[token] ?? token)
    .filter((token) => token && !stopWords.has(token) && (token.length > 2 || /\d/.test(token)));
}

function normalizeSecondaryTypes(types?: MusicBrainzSecondaryType[]) {
  return (types ?? [])
    .map((entry) => normalize(typeof entry === "string" ? entry : entry.title ?? ""))
    .filter(Boolean)
    .join(" ");
}

function getReleaseYear(release: MusicBrainzSearchRelease | MusicBrainzRelease) {
  const date = release["release-group"]?.["first-release-date"] ?? release.date;
  const year = date ? Number(date.slice(0, 4)) : undefined;
  return Number.isInteger(year) ? year : undefined;
}

function getReleaseSignals(release: MusicBrainzSearchRelease | MusicBrainzRelease) {
  const title = normalize(release.title);
  const releaseGroup = release["release-group"];
  const secondaryTypes = normalizeSecondaryTypes(releaseGroup?.["secondary-types"]);
  const primaryType = normalize(releaseGroup?.["primary-type"] ?? "");
  const soundtrackPattern = /(soundtrack|score|motion picture|motion-picture|music from|original music|ost|film)/;

  return {
    title,
    hasSoundtrackSignals: soundtrackPattern.test(title) || /(soundtrack|score|ost|film)/.test(primaryType) || /(soundtrack|score|ost|film)/.test(secondaryTypes),
  };
}

function isAcceptableSoundtrackDetail(detail: MusicBrainzRelease, movie: MusicBrainzMovieContext, score: number) {
  if (score < 80) return false;

  const normalizedMovie = normalize(movie.title);
  const { title, hasSoundtrackSignals } = getReleaseSignals(detail);
  const titleMatchesMovie = doesReleaseTitleMatchMovie(title, normalizedMovie);
  const composerTokens = parseComposerTokens(movie.composer);
  const trackArtistNames = (detail.media ?? [])
    .flatMap((medium) => medium.tracks ?? [])
    .map((track) => track.recording?.["artist-credit"]?.length ? track.recording["artist-credit"] : track["artist-credit"] ?? [])
    .flat()
    .map((credit) => normalize(credit.name ?? credit.artist?.name ?? ""))
    .filter(Boolean);
  const composerMatches = composerTokens.length > 0
    && trackArtistNames.some((artist) => composerTokens.some((token) => artist.includes(token)));
  const releaseYear = getReleaseYear(detail);
  const yearMatches = !movie.year || !releaseYear || Math.abs(releaseYear - movie.year) <= 1;

  if (!yearMatches && !composerMatches) return false;

  if (titleMatchesMovie && hasSoundtrackSignals) return true;
  if (titleMatchesMovie && composerMatches) return true;
  if (hasSoundtrackSignals && composerMatches) return true;

  return false;
}

async function searchReleaseCandidates(movie: MusicBrainzMovieContext, signal?: AbortSignal) {
  const queries = [
    `(release:${movie.title}) AND (primarytype:album OR primarytype:ep)`,
    `release:"${movie.title}: Original Motion Picture Soundtrack"`,
    `release:"${movie.title}: Original Motion Picture Score"`,
    `release:"${movie.title}: Music From the Motion Picture"`,
    `release:"${movie.title}" AND (secondarytype:soundtrack OR release:soundtrack OR release:score OR release:ost)`,
    `"${movie.title}" soundtrack`,
  ];
  const releasesById = new Map<string, MusicBrainzSearchRelease>();
  let completedSearches = 0;

  for (const rawQuery of queries) {
    const query = encodeURIComponent(rawQuery);
    const search = await musicBrainzFetch<{ releases?: MusicBrainzSearchRelease[] }>(`/release/?query=${query}&fmt=json&limit=20`, signal);
    if (search) completedSearches += 1;
    for (const release of search?.releases ?? []) {
      if (release.id && release.title && !releasesById.has(release.id)) {
        releasesById.set(release.id, release);
      }
    }
  }

  if (completedSearches === 0) {
    throw new MusicBrainzUnavailableError("MusicBrainz release search could not be loaded");
  }

  return Array.from(releasesById.values());
}

async function musicBrainzFetch<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const run = requestQueue.then(async () => {
    const retryableStatuses = new Set([429, 500, 502, 503, 504]);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));

      if (signal?.aborted) {
        return null;
      }

      lastRequestAt = Date.now();
      let response: Response;
      try {
        response = await fetch(`${MUSICBRAINZ_URL}${path}`, {
          signal,
          headers: { Accept: "application/json", "User-Agent": "Movirae/1.0 (soundtracks)" },
          cache: "no-store",
        });
      } catch (error) {
        if (isRequestAborted(error, signal)) return null;
        throw new MusicBrainzUnavailableError("MusicBrainz request could not be loaded");
      }

      if (response.ok) {
        return (await response.json() as T);
      }

      if (!retryableStatuses.has(response.status) || attempt === 1) {
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }

    return null;
  });
  requestQueue = run.then(() => undefined, () => undefined);
  return run;
}

function isRequestAborted(error: unknown, signal?: AbortSignal) {
  return signal?.aborted || (error instanceof Error && error.name === "AbortError");
}
