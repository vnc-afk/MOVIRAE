import { describe, expect, it } from "vitest";
import { dedupeMovies } from "@/app/ai-assistant/lib/dedupe";
import { buildAssistantUrl, readAssistantQuery } from "@/app/ai-assistant/lib/url-state";
import { MOVIRAE_AGENT_INSTRUCTIONS } from "@/lib/ai/instructions";
import type { Movie } from "@/lib/types";

const movie = (id: string): Movie => ({
  id,
  title: id,
  year: 2025,
  rating: 7,
  genre: "Drama",
  poster: "",
  synopsis: "",
  director: "",
  cast: [],
  reviews: [],
  tags: [],
  streamingOn: [],
  moods: [],
  runtime: 100,
  language: "English",
  country: "US",
});

describe("AI assistant feature utilities", () => {
  it("defines safe tool-selection and mutation truth policies", () => {
    expect(MOVIRAE_AGENT_INSTRUCTIONS).toContain("ask the user to choose");
    expect(MOVIRAE_AGENT_INSTRUCTIONS).toContain("Never claim a mutation succeeded");
  });

  it("serializes and reads a trimmed query without changing unrelated paths", () => {
    const url = buildAssistantUrl("/ai-assistant", "  rainy day comedy ");

    expect(url).toBe("/ai-assistant?q=rainy+day+comedy");
    expect(readAssistantQuery(new URLSearchParams(url.split("?")[1]))).toBe("rainy day comedy");
  });

  it("keeps the first occurrence of each movie id", () => {
    expect(dedupeMovies([movie("a"), movie("a"), movie("b")]).map((item) => item.id)).toEqual(["a", "b"]);
  });
});