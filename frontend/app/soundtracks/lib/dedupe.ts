import type { Soundtrack } from "./types";

export function deduplicateSoundtracks(items: Soundtrack[]): Soundtrack[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.movieId)) return false;
    seen.add(item.movieId);
    return true;
  });
}
