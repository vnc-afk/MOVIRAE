import { deduplicateSoundtracks } from "./dedupe";
import type { Soundtrack, SoundtrackPage } from "./types";

export function appendSoundtrackPage(
  current: Soundtrack[],
  nextPage: SoundtrackPage
): Soundtrack[] {
  return deduplicateSoundtracks([...current, ...nextPage.items]);
}

export function filterSoundtracks(items: Soundtrack[], search: string): Soundtrack[] {
  const queryTokens = tokenize(search);
  if (queryTokens.length === 0) return items;

  return items
    .map((item, index) => ({ item, index, score: scoreSoundtrackMatch(item, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

function scoreSoundtrackMatch(item: Soundtrack, queryTokens: string[]) {
  const title = normalize(item.movieTitle);
  const composer = normalize(item.composer);
  const release = normalize(item.musicbrainzReleaseName ?? "");
  const tracks = item.tracks.map((track) => ({
    title: normalize(track.title),
    artist: normalize(track.artist),
  }));

  let score = 0;

  for (const token of queryTokens) {
    if (title === token) score += 120;
    else if (title.startsWith(token)) score += 80;
    else if (title.includes(token)) score += 60;

    if (composer.includes(token)) score += 45;
    if (release.includes(token)) score += 35;

    for (const track of tracks) {
      if (track.title === token) score += 50;
      else if (track.title.includes(token)) score += 25;
      if (track.artist.includes(token)) score += 20;
    }
  }

  const haystack = [
    title,
    composer,
    release,
    ...tracks.flatMap((track) => [track.title, track.artist]),
  ].join(" ");

  if (!queryTokens.every((token) => haystack.includes(token))) {
    return 0;
  }

  return score + 75;
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 0);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
