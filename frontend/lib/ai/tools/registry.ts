import { z } from "zod";

import { getMovieDetails, getMovieDetailsBatch, searchMovies } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";
import type { Movie } from "@/lib/types";
import type { AIFunctionTool } from "../provider";

export interface AIToolContext {
  userId: string;
}

export interface AIToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  displayMovies?: Movie[];
}

interface RegisteredTool<TSchema extends z.ZodTypeAny> {
  definition: AIFunctionTool;
  schema: TSchema;
  execute: (input: z.output<TSchema>, context: AIToolContext) => Promise<AIToolExecutionResult>;
}

const movieSummary = (movie: Movie) => ({
  id: movie.id,
  title: movie.title,
  year: movie.year,
  rating: movie.rating,
  genre: movie.genre,
  synopsis: movie.synopsis,
  director: movie.director,
  runtime: movie.runtime,
  language: movie.language,
});

const searchTmdb = {
  definition: {
    name: "search_tmdb",
    description: "Search TMDB for movies by title, topic, or description.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Movie title or search phrase." },
        year: { type: "integer", description: "Optional four-digit release year." },
      },
      required: ["query"],
    },
  },
  schema: z.object({
    query: z.string().trim().min(1).max(200),
    year: z.number().int().min(1888).max(2200).optional(),
  }).strict(),
  async execute(input: { query: string; year?: number }) {
    const movies = await searchMovies(input.query, 1, { year: input.year });
    const displayMovies = movies.slice(0, 10);
    return { success: true, data: { movies: displayMovies.map(movieSummary) }, displayMovies };
  },
} satisfies RegisteredTool<z.ZodObject<{ query: z.ZodString; year: z.ZodOptional<z.ZodNumber> }>>;

const getMovieDetailsTool = {
  definition: {
    name: "get_movie_details",
    description: "Get detailed information about one movie from TMDB using its TMDB movie ID.",
    parameters: {
      type: "object",
      properties: { movieId: { type: "string", description: "The TMDB movie ID." } },
      required: ["movieId"],
    },
  },
  schema: z.object({ movieId: z.string().trim().regex(/^\d+$/) }).strict(),
  async execute(input: { movieId: string }) {
    const movie = await getMovieDetails(input.movieId);
    return movie
      ? { success: true, data: { movie: movieSummary(movie) }, displayMovies: [movie] }
      : { success: false, error: "Movie not found" };
  },
} satisfies RegisteredTool<z.ZodObject<{ movieId: z.ZodString }>>;

const getMyWatchHistory = {
  definition: {
    name: "get_my_watch_history",
    description: "Retrieve movies watched by the authenticated Movirae user.",
    parameters: {
      type: "object",
      properties: { limit: { type: "integer", description: "Maximum number of watched movies to return, from 1 to 20." } },
    },
  },
  schema: z.object({ limit: z.number().int().min(1).max(20).optional() }).strict(),
  async execute(input: { limit?: number }, context: AIToolContext) {
    const watchedData = await prisma.appData.findUnique({
      where: { key: `user-watched-${context.userId}` },
      select: { value: true },
    });
    const watchedIds = Array.isArray(watchedData?.value)
      ? watchedData.value.filter((value): value is string => typeof value === "string")
      : [];
    const movieIds = watchedIds.slice(- (input.limit ?? 20)).reverse();
    const movies = await getMovieDetailsBatch(movieIds);
    const movieById = new Map(movies.map((movie) => [movie.id, movie]));
    const displayMovies = movieIds.flatMap((movieId) => {
      const movie = movieById.get(movieId);
      return movie ? [movie] : [];
    });

    return {
      success: true,
      data: {
        movies: displayMovies.map(movieSummary),
      },
      displayMovies,
    };
  },
} satisfies RegisteredTool<z.ZodObject<{ limit: z.ZodOptional<z.ZodNumber> }>>;

const tools = [searchTmdb, getMovieDetailsTool, getMyWatchHistory] as const;

export const toolDefinitions = tools.map((tool) => tool.definition);

export async function executeTool(name: string, args: unknown, context: AIToolContext): Promise<AIToolExecutionResult> {
  const tool = tools.find((candidate) => candidate.definition.name === name);
  if (!tool) return { success: false, error: "Unknown tool" };

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) return { success: false, error: "Invalid tool arguments" };

  try {
    const executableTool = tool as unknown as RegisteredTool<z.ZodTypeAny>;
    return await executableTool.execute(parsed.data, context);
  } catch (error) {
    console.error(`AI tool ${name} failed:`, error);
    return { success: false, error: `${name === "get_my_watch_history" ? "Watch history" : "TMDB"} request failed` };
  }
}