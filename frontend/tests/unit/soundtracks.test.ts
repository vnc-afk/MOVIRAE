import { afterEach, describe, expect, it, vi } from "vitest";
import { MusicBrainzUnavailableError, scoreMusicBrainzRelease, searchMusicBrainzSoundtrack } from "../../lib/musicbrainz";
import { searchYouTubeSoundtrack, searchYouTubeTrack } from "../../lib/youtube";
import { deduplicateSoundtracks } from "../../app/soundtracks/lib/dedupe";
import { filterSoundtracks } from "../../app/soundtracks/lib/pagination";
import { buildSoundtrackUrl, parseSoundtrackQuery } from "../../app/soundtracks/lib/url-state";

const soundtrackCatalog = [
  {
    movieId: 1,
    movieTitle: "Midnight Rain",
    poster: "",
    composer: "Hans Zimmer",
    musicbrainzReleaseName: "Midnight Rain: Original Motion Picture Soundtrack",
    tracks: [{ id: "rain-track-1", title: "Cloudburst", artist: "Hans Zimmer", duration: "2:41" }],
  },
  {
    movieId: 2,
    movieTitle: "The Last Garden",
    poster: "",
    composer: "Alexandre Desplat",
    musicbrainzReleaseName: "The Last Garden: Original Motion Picture Score",
    tracks: [{ id: "garden-track-1", title: "Final Bloom", artist: "Alexandre Desplat", duration: "3:12" }],
  },
];

describe("soundtrack feature contracts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.REDIS_URL;
    delete process.env.YOUTUBE_API_KEY;
  });

  it("parses invalid pagination and selection values to safe defaults", () => {
    const query = parseSoundtrackQuery(new URLSearchParams("page=-2&selected=nope"));
    expect(query).toEqual({ search: "", page: 1, selectedId: null });
  });

  it("serializes only meaningful URL state", () => {
    expect(buildSoundtrackUrl("/soundtracks", { search: "Hans Zimmer", page: 2, selectedId: 1 }))
      .toBe("/soundtracks?q=Hans+Zimmer&page=2&selected=1");
  });

  it("deduplicates soundtrack pages by movie identity", () => {
    expect(deduplicateSoundtracks([soundtrackCatalog[0], soundtrackCatalog[0], soundtrackCatalog[1]])).toHaveLength(2);
  });

  it("filters titles and composers case-insensitively", () => {
    expect(filterSoundtracks(soundtrackCatalog, "desplat")).toEqual([soundtrackCatalog[1]]);
  });

  it("filters soundtrack release names, track titles, and track artists", () => {
    expect(filterSoundtracks(soundtrackCatalog, "cloudburst")).toEqual([soundtrackCatalog[0]]);
    expect(filterSoundtracks(soundtrackCatalog, "motion picture score")).toEqual([soundtrackCatalog[1]]);
  });

  it("resolves MusicBrainz metadata for Spider-Man: Brand New Day", async () => {
    delete process.env.REDIS_URL;

    const movie = { title: "Spider-Man: Brand New Day", year: 2026, composer: "Michael Giacchino" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/release/?query=")) {
        return new Response(JSON.stringify({
          releases: [
            {
              id: "release-969681",
              title: "Spider-Man: Brand New Day (Original Motion Picture Soundtrack)",
              date: "2026-07-17",
              score: 96,
              "release-group": {
                "primary-type": "album",
                "secondary-types": [{ title: "Soundtrack" }],
              },
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/release/release-969681?inc=recordings+artist-credits+release-groups")) {
        return new Response(JSON.stringify({
          id: "release-969681",
          title: "Spider-Man: Brand New Day (Original Motion Picture Soundtrack)",
          "release-group": {
            "primary-type": "album",
            "secondary-types": [{ title: "Soundtrack" }],
          },
          media: [
            {
              tracks: [
                {
                  position: 1,
                  recording: {
                    id: "track-1",
                    title: "Main Title",
                    length: 180000,
                    "artist-credit": [{ name: "Michael Giacchino" }],
                  },
                },
              ],
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    const result = await searchMusicBrainzSoundtrack(movie);

    expect(result).not.toBeNull();
    expect(result?.releaseName).toContain("Original Motion Picture Soundtrack");
    expect(result?.tracks).toHaveLength(1);
    expect(result?.tracks[0].title).toBe("Main Title");
    expect(result?.tracks[0].artist).toBe("Michael Giacchino");
  });

  it("runs every release query before selecting the best candidate", async () => {
    delete process.env.REDIS_URL;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/release/?query=")) {
        const isSoundtrackQuery = decodeURIComponent(url).includes("soundtrack");
        const releases = isSoundtrackQuery
          ? [{
              id: "release-later-query",
              title: "The Last Garden (Original Motion Picture Soundtrack)",
              date: "2024-03-15",
              score: 96,
              "release-group": { "primary-type": "album", "secondary-types": ["Soundtrack"] },
            }]
          : Array.from({ length: 20 }, (_, index) => ({
              id: `release-${index}`,
              title: `The Last Garden album ${index}`,
              date: "2024-03-15",
              score: 70,
              "release-group": { "primary-type": "album", "secondary-types": ["Album"] },
            }));

        return new Response(JSON.stringify({ releases }), { status: 200 });
      }

      if (url.includes("/release/release-later-query?inc=")) {
        return new Response(JSON.stringify({
          id: "release-later-query",
          title: "The Last Garden (Original Motion Picture Soundtrack)",
          "release-group": { "primary-type": "album", "secondary-types": ["Soundtrack"] },
          media: [{ tracks: [{
            position: 1,
            recording: {
              id: "later-query-track",
              title: "Main Title",
              "artist-credit": [{ name: "Alexandre Desplat" }],
            },
          }] }],
        }), { status: 200 });
      }

      if (url.includes("/release/") && url.includes("?inc=")) {
        return new Response(JSON.stringify({
          id: "generic-release",
          title: "The Last Garden album",
          "release-group": { "primary-type": "album", "secondary-types": ["Album"] },
          media: [{ tracks: [{
            position: 1,
            recording: {
              id: "generic-track",
              title: "Album track",
              "artist-credit": [{ name: "Unrelated Artist" }],
            },
          }] }],
        }), { status: 200 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    const result = await searchMusicBrainzSoundtrack({
      title: "The Last Garden",
      year: 2024,
      composer: "Alexandre Desplat",
    });

    expect(result?.releaseId).toBe("release-later-query");
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/release/?query=")).length).toBe(6);
  });

  it("prefers soundtrack releases that match the movie year and soundtrack type", () => {
    const movie = { title: "The Last Garden", year: 2024, composer: "Alexandre Desplat" };
    const soundtrackRelease = {
      id: "release-1",
      title: "The Last Garden (Original Motion Picture Soundtrack)",
      date: "2024-03-15",
      score: 72,
      "release-group": {
        "primary-type": "album",
        "secondary-types": [{ title: "Soundtrack" }],
      },
    };
    const sequelRelease = {
      id: "release-2",
      title: "The Last Garden II",
      date: "2025-09-11",
      score: 88,
      "release-group": {
        "primary-type": "album",
        "secondary-types": [{ title: "Album" }],
      },
    };

    expect(scoreMusicBrainzRelease(soundtrackRelease, movie)).toBeGreaterThan(
      scoreMusicBrainzRelease(sequelRelease, movie)
    );
  });

  it("recognizes MusicBrainz string secondary types as soundtrack metadata", () => {
    const movie = { title: "Midnight Rain", year: 2024, composer: "Hans Zimmer" };
    const release = {
      id: "release-string-secondary-type",
      title: "Midnight Rain",
      date: "2024-04-12",
      score: 70,
      "release-group": {
        "primary-type": "Album",
        "secondary-types": ["Soundtrack"],
      },
    };

    expect(scoreMusicBrainzRelease(release, movie)).toBeGreaterThan(250);
  });

  it("rejects high-scoring albums without movie, soundtrack, or composer evidence", async () => {
    delete process.env.REDIS_URL;

    const movie = { title: "The Last Garden", year: 2024 };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/release/?query=")) {
        return new Response(JSON.stringify({
          releases: [
            {
              id: "release-wrong",
              title: "Garden Songs",
              date: "2024-03-15",
              score: 100,
              "release-group": {
                "primary-type": "Album",
                "secondary-types": ["Album"],
              },
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/release/release-wrong?inc=recordings+artist-credits+release-groups")) {
        return new Response(JSON.stringify({
          id: "release-wrong",
          title: "Garden Songs",
          "release-group": {
            "primary-type": "Album",
            "secondary-types": ["Album"],
          },
          media: [
            {
              tracks: [
                {
                  position: 1,
                  recording: {
                    id: "wrong-track-1",
                    title: "Morning",
                    length: 180000,
                    "artist-credit": [{ name: "Unrelated Artist" }],
                  },
                },
              ],
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    await expect(searchMusicBrainzSoundtrack(movie)).resolves.toBeNull();
  });

  it("does not treat unavailable MusicBrainz search as a no-match fallback", async () => {
    delete process.env.REDIS_URL;

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch);

    await expect(searchMusicBrainzSoundtrack({ title: "Spider-Man: Brand New Day", year: 2026 }))
      .rejects
      .toBeInstanceOf(MusicBrainzUnavailableError);
  });

  it("accepts soundtrack releases with formatted movie titles", async () => {
    delete process.env.REDIS_URL;

    const movie = { title: "Mission: Impossible - Dead Reckoning Part One", year: 2023 };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/release/?query=")) {
        return new Response(JSON.stringify({
          releases: [
            {
              id: "release-formatted",
              title: "Mission Impossible: Dead Reckoning, Pt. 1 (Music From the Motion Picture)",
              date: "2023-07-12",
              score: 80,
              "release-group": {
                "primary-type": "Album",
                "secondary-types": ["Soundtrack"],
              },
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/release/release-formatted?inc=recordings+artist-credits+release-groups")) {
        return new Response(JSON.stringify({
          id: "release-formatted",
          title: "Mission Impossible: Dead Reckoning, Pt. 1 (Music From the Motion Picture)",
          "release-group": {
            "primary-type": "Album",
            "secondary-types": ["Soundtrack"],
          },
          media: [
            {
              tracks: [
                {
                  position: 1,
                  recording: {
                    id: "formatted-track-1",
                    title: "The Sevastopol",
                    length: 135000,
                    "artist-credit": [{ name: "Lorne Balfe" }],
                  },
                },
              ],
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    const result = await searchMusicBrainzSoundtrack(movie);

    expect(result?.releaseId).toBe("release-formatted");
    expect(result?.tracks).toHaveLength(1);
  });

  it("searches colon-formatted original motion picture soundtrack releases", async () => {
    delete process.env.REDIS_URL;

    const movie = { title: "Obsession", year: 1976, composer: "Bernard Herrmann" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("Obsession%3A%20Original%20Motion%20Picture%20Soundtrack")) {
        return new Response(JSON.stringify({
          releases: [
            {
              id: "8ed0afbf-d2fd-4a7b-ae99-465274ef8f7d",
              title: "Obsession: Original Motion Picture Soundtrack",
              date: "1976",
              score: 92,
              "release-group": {
                "primary-type": "Album",
                "secondary-types": ["Soundtrack"],
              },
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/release/8ed0afbf-d2fd-4a7b-ae99-465274ef8f7d?inc=recordings+artist-credits+release-groups")) {
        return new Response(JSON.stringify({
          id: "8ed0afbf-d2fd-4a7b-ae99-465274ef8f7d",
          title: "Obsession: Original Motion Picture Soundtrack",
          "release-group": {
            "primary-type": "Album",
            "secondary-types": ["Soundtrack"],
          },
          media: [
            {
              tracks: [
                {
                  position: 1,
                  recording: {
                    id: "obsession-track-1",
                    title: "Main Title",
                    length: 158000,
                    "artist-credit": [{ name: "Bernard Herrmann" }],
                  },
                },
              ],
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ releases: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    const result = await searchMusicBrainzSoundtrack(movie);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("Obsession%3A%20Original%20Motion%20Picture%20Soundtrack"),
      expect.any(Object)
    );
    expect(result?.releaseId).toBe("8ed0afbf-d2fd-4a7b-ae99-465274ef8f7d");
    expect(result?.tracks[0].artist).toBe("Bernard Herrmann");
  });

  it("rejects same-title soundtrack releases from the wrong movie year", async () => {
    delete process.env.REDIS_URL;

    const movie = { title: "Obsession", year: 1976 };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/release/?query=")) {
        return new Response(JSON.stringify({
          releases: [
            {
              id: "release-wrong-year",
              title: "Obsession: Original Motion Picture Soundtrack",
              date: "1998-05-12",
              score: 95,
              "release-group": {
                "primary-type": "Album",
                "first-release-date": "1998-05-12",
                "secondary-types": ["Soundtrack"],
              },
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/release/release-wrong-year?inc=recordings+artist-credits+release-groups")) {
        return new Response(JSON.stringify({
          id: "release-wrong-year",
          title: "Obsession: Original Motion Picture Soundtrack",
          date: "1998-05-12",
          "release-group": {
            "primary-type": "Album",
            "first-release-date": "1998-05-12",
            "secondary-types": ["Soundtrack"],
          },
          media: [
            {
              tracks: [
                {
                  position: 1,
                  recording: {
                    id: "wrong-year-track-1",
                    title: "Main Title",
                    length: 158000,
                    "artist-credit": [{ name: "Different Composer" }],
                  },
                },
              ],
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ releases: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    await expect(searchMusicBrainzSoundtrack(movie)).resolves.toBeNull();
  });

  it("finds a YouTube soundtrack fallback video", async () => {
    process.env.YOUTUBE_API_KEY = "test-youtube-key";

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      items: [
        {
          id: { videoId: "abc123DEF45" },
          snippet: {
            title: "Obsession Original Motion Picture Soundtrack full album",
            channelTitle: "Soundtrack Channel",
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    await expect(searchYouTubeSoundtrack("Obsession", "Bernard Herrmann")).resolves.toBe("abc123DEF45");
  });

  it("finds a YouTube preview for a specific soundtrack track", async () => {
    process.env.YOUTUBE_API_KEY = "test-youtube-key";

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      items: [
        {
          id: { videoId: "trk123DEF45" },
          snippet: {
            title: "The Sevastopol - Mission Impossible Dead Reckoning official audio",
            channelTitle: "Lorne Balfe - Topic",
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    await expect(searchYouTubeTrack("Mission Impossible Dead Reckoning", "The Sevastopol", "Lorne Balfe")).resolves.toBe("trk123DEF45");
  });

  it("rejects weak generic YouTube track preview matches", async () => {
    process.env.YOUTUBE_API_KEY = "test-youtube-key";

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      items: [
        {
          id: { videoId: "weak123DEF4" },
          snippet: {
            title: "Main Title",
            channelTitle: "Random Uploads",
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    await expect(searchYouTubeTrack("Obsession", "Main Title", "Bernard Herrmann")).resolves.toBeNull();
  });

  it("penalizes plain movie-title albums when soundtrack metadata is available", () => {
    const movie = { title: "Spider-Man: Brand New Day", year: 2026, composer: "Michael Giacchino" };
    const plainAlbum = {
      id: "release-plain",
      title: "Spider-Man: Brand New Day",
      date: "2026-07-17",
      score: 90,
      "release-group": {
        "primary-type": "album",
        "secondary-types": [{ title: "Album" }],
      },
    };
    const soundtrackRelease = {
      id: "release-soundtrack",
      title: "Spider-Man: Brand New Day (Original Motion Picture Soundtrack)",
      date: "2026-07-17",
      score: 86,
      "release-group": {
        "primary-type": "album",
        "secondary-types": [{ title: "Soundtrack" }],
      },
    };

    expect(scoreMusicBrainzRelease(soundtrackRelease, movie)).toBeGreaterThan(
      scoreMusicBrainzRelease(plainAlbum, movie)
    );
  });
});
