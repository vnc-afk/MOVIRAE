import type { Movie } from "@/lib/types";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  movies?: Movie[];
}

export type MoviePageFetcher = (query: string, page: number, signal?: AbortSignal) => Promise<Movie[]>;