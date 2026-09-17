import { z } from "zod";

import { getMovieDetails, getMovieDetailsBatch, getMoviesByGenre, getSimilarMovies, searchMovies } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";
import type { Movie } from "@/lib/types";
import type { AIFunctionTool } from "../provider";

const TOOL_TIMEOUT_MS = 15_000;

export interface AIToolContext {
  userId: string;
}

export interface AIToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  displayMovies?: Movie[];
}

export function toToolModelResponse(result: AIToolExecutionResult): Record<string, unknown> {
  return {
    success: result.success,
    ...(result.data !== undefined ? { data: result.data } : {}),
    ...(result.error ? { error: result.error } : {}),
  };
}

interface RegisteredTool<TSchema extends z.ZodTypeAny> {
  definition: AIFunctionTool;
  schema: TSchema;
  execute: (input: z.output<TSchema>, context: AIToolContext) => Promise<AIToolExecutionResult>;
}

function withToolTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve({ success: false, error: "Tool timed out" } as T), TOOL_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

const movieSummary = (movie: Movie) => ({
  id: movie.id,
  title: movie.title,
  year: movie.year,
  rating: movie.rating,
  genre: movie.genre,
  synopsis: movie.synopsis.slice(0, 600),
  director: movie.director,
  runtime: movie.runtime,
  language: movie.language,
});

const searchTmdb = {
  definition: {
    name: "search_tmdb",
    description: "Search TMDB for open-ended movie searches by title, keyword, mood, genre phrase, or optional release year. Use this for candidates, not one already-identified movie or similarity.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 200, description: "A focused title, keyword, mood, or genre search phrase; do not include unrelated conversation." },
        year: { type: "integer", minimum: 1888, maximum: 2200, description: "Optional four-digit release year used to narrow candidates." },
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
    description: "Get details for exactly one already-identified TMDB movie. Use only when a specific movie ID is known; do not guess an ID from an ambiguous title.",
    parameters: {
      type: "object",
      properties: { movieId: { type: "string", pattern: "^[0-9]+$", description: "A verified numeric TMDB movie ID, not a title or user ID." } },
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

const discoverMovies = {
  definition: {
    name: "discover_movies",
    description: "Discover a broad TMDB catalog page, optionally constrained by a numeric genre ID and sorted by rating, year, title, or popularity. Do not use for exact title lookup.",
    parameters: {
      type: "object",
      properties: {
        genreId: { type: "integer", minimum: 0, description: "Optional TMDB genre ID; use 0 for all genres." },
        sortBy: { type: "string", enum: ["rating", "year", "title", "runtime"] },
      },
    },
  },
  schema: z.object({
    genreId: z.number().int().min(0).optional(),
    sortBy: z.enum(["rating", "year", "title", "runtime"]).optional(),
  }).strict(),
  async execute(input: { genreId?: number; sortBy?: "rating" | "year" | "title" | "runtime" }) {
    const movies = await getMoviesByGenre(input.genreId ?? 0, 1, undefined, input.sortBy ?? "rating");
    const displayMovies = movies.slice(0, 10);
    return { success: true, data: { movies: displayMovies.map(movieSummary) }, displayMovies };
  },
} satisfies RegisteredTool<z.ZodObject<{ genreId: z.ZodOptional<z.ZodNumber>; sortBy: z.ZodOptional<z.ZodEnum<["rating", "year", "title", "runtime"]>> }>>;

const findSimilarMovies = {
  definition: {
    name: "find_similar_movies",
    description: "Find candidate movies similar to one verified TMDB movie. Identify the source movie first; do not use this for a title search.",
    parameters: {
      type: "object",
      properties: { movieId: { type: "string", pattern: "^[0-9]+$", description: "A verified numeric TMDB movie ID." } },
      required: ["movieId"],
    },
  },
  schema: z.object({ movieId: z.string().trim().regex(/^\d+$/) }).strict(),
  async execute(input: { movieId: string }) {
    const movie = await getMovieDetails(input.movieId);
    if (!movie) return { success: false, error: "Movie not found" };
    const displayMovies = (await getSimilarMovies(input.movieId)).slice(0, 10);
    return { success: true, data: { source: movieSummary(movie), movies: displayMovies.map(movieSummary) }, displayMovies };
  },
} satisfies RegisteredTool<z.ZodObject<{ movieId: z.ZodString }>>;

const getMyWatchHistory = {
  definition: {
    name: "get_my_watch_history",
    description: "Read the authenticated user's watched movies. Use only for explicit questions about the user's own watch history; never accepts a user ID.",
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

async function getMovieSummaries(movieIds: string[]) {
  const movies = await getMovieDetailsBatch(movieIds);
  return new Map(movies.map((movie) => [movie.id, movie]));
}

const getMyRatings = {
  definition: {
    name: "get_my_ratings",
    description: "Read the authenticated user's movie ratings. Use only for explicit questions about their own ratings; never accepts a user ID.",
    parameters: { type: "object", properties: { limit: { type: "integer", description: "Maximum results, from 1 to 20." } } },
  },
  schema: z.object({ limit: z.number().int().min(1).max(20).optional() }).strict(),
  async execute(input: { limit?: number }, context: AIToolContext) {
    const ratings = await prisma.review.findMany({ where: { userId: context.userId }, orderBy: { updatedAt: "desc" }, take: input.limit ?? 20, select: { tmdbId: true, rating: true, updatedAt: true } });
    const movieById = await getMovieSummaries(ratings.map((rating) => rating.tmdbId));
    return { success: true, data: { ratings: ratings.flatMap((rating) => { const movie = movieById.get(rating.tmdbId); return movie ? [{ movie: movieSummary(movie), rating: rating.rating, updatedAt: rating.updatedAt.toISOString() }] : []; }) } };
  },
} satisfies RegisteredTool<z.ZodObject<{ limit: z.ZodOptional<z.ZodNumber> }>>;

const getMyReviews = {
  definition: {
    name: "get_my_reviews",
    description: "Read the authenticated user's reviews. Use only for explicit questions about their own reviews; never accepts a user ID.",
    parameters: { type: "object", properties: { limit: { type: "integer", description: "Maximum results, from 1 to 20." } } },
  },
  schema: z.object({ limit: z.number().int().min(1).max(20).optional() }).strict(),
  async execute(input: { limit?: number }, context: AIToolContext) {
    const reviews = await prisma.review.findMany({ where: { userId: context.userId }, orderBy: { updatedAt: "desc" }, take: input.limit ?? 20, select: { tmdbId: true, rating: true, comment: true, isSpoiler: true, updatedAt: true } });
    const movieById = await getMovieSummaries(reviews.map((review) => review.tmdbId));
    return { success: true, data: { reviews: reviews.flatMap((review) => { const movie = movieById.get(review.tmdbId); return movie ? [{ movie: movieSummary(movie), rating: review.rating, comment: review.comment ?? "", isSpoiler: review.isSpoiler, updatedAt: review.updatedAt.toISOString() }] : []; }) } };
  },
} satisfies RegisteredTool<z.ZodObject<{ limit: z.ZodOptional<z.ZodNumber> }>>;

const getMyRating = {
  definition: {
    name: "get_my_rating",
    description: "Read the authenticated user's rating for one verified TMDB movie. This does not create or change ratings.",
    parameters: { type: "object", properties: { movieId: { type: "string", description: "The TMDB movie ID." } }, required: ["movieId"] },
  },
  schema: z.object({ movieId: z.string().trim().regex(/^\d+$/) }).strict(),
  async execute(input: { movieId: string }, context: AIToolContext) {
    const review = await prisma.review.findFirst({ where: { userId: context.userId, tmdbId: input.movieId }, select: { rating: true, updatedAt: true } });
    return { success: true, data: { movieId: input.movieId, rating: review?.rating ?? null, updatedAt: review?.updatedAt.toISOString() ?? null } };
  },
} satisfies RegisteredTool<z.ZodObject<{ movieId: z.ZodString }>>;

const getMyReview = {
  definition: {
    name: "get_my_review",
    description: "Read the authenticated user's review for one verified TMDB movie. This does not create or change reviews.",
    parameters: { type: "object", properties: { movieId: { type: "string", description: "The TMDB movie ID." } }, required: ["movieId"] },
  },
  schema: z.object({ movieId: z.string().trim().regex(/^\d+$/) }).strict(),
  async execute(input: { movieId: string }, context: AIToolContext) {
    const review = await prisma.review.findFirst({ where: { userId: context.userId, tmdbId: input.movieId }, select: { rating: true, comment: true, tone: true, isSpoiler: true, updatedAt: true } });
    return { success: true, data: { movieId: input.movieId, review: review ? { rating: review.rating, comment: review.comment ?? "", tone: review.tone, isSpoiler: review.isSpoiler, updatedAt: review.updatedAt.toISOString() } : null } };
  },
} satisfies RegisteredTool<z.ZodObject<{ movieId: z.ZodString }>>;

const getMyWatchlist = {
  definition: {
    name: "get_my_watchlist",
    description: "Read the authenticated user's watchlist. Use only for explicit questions about their own watchlist; never accepts a user ID.",
    parameters: { type: "object", properties: { limit: { type: "integer", description: "Maximum results, from 1 to 20." } } },
  },
  schema: z.object({ limit: z.number().int().min(1).max(20).optional() }).strict(),
  async execute(input: { limit?: number }, context: AIToolContext) {
    const entries = await prisma.userWatchlistItem.findMany({ where: { userId: context.userId }, orderBy: { addedAt: "desc" }, take: input.limit ?? 20, select: { tmdbId: true, addedAt: true } });
    const movieById = await getMovieSummaries(entries.map((entry) => entry.tmdbId));
    const displayMovies = entries.flatMap((entry) => { const movie = movieById.get(entry.tmdbId); return movie ? [movie] : []; });
    return { success: true, data: { movies: displayMovies.map(movieSummary) }, displayMovies };
  },
} satisfies RegisteredTool<z.ZodObject<{ limit: z.ZodOptional<z.ZodNumber> }>>;

const getMyMoviePreferences = {
  definition: {
    name: "get_my_movie_preferences",
    description: "Summarize preferences recorded in the authenticated user's watch experiences. Use only when personalization data is relevant.",
    parameters: { type: "object", properties: {} },
  },
  schema: z.object({}).strict(),
  async execute(_input: Record<string, never>, context: AIToolContext) {
    const experiences = await prisma.userWatchExperience.findMany({ where: { userId: context.userId }, select: { platform: true, context: true, mood: true } });
    const counts = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] ?? 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
    return { success: true, data: { platforms: counts(experiences.map((item) => item.platform)), contexts: counts(experiences.map((item) => item.context)), moods: counts(experiences.map((item) => item.mood)) } };
  },
} satisfies RegisteredTool<z.ZodObject<Record<string, never>>>;

const checkWatchlist = {
  definition: {
    name: "check_watchlist",
    description: "Check watchlist membership for one verified TMDB movie and the authenticated user. This is read-only.",
    parameters: { type: "object", properties: { movieId: { type: "string", description: "The TMDB movie ID." } }, required: ["movieId"] },
  },
  schema: z.object({ movieId: z.string().trim().regex(/^\d+$/) }).strict(),
  async execute(input: { movieId: string }, context: AIToolContext) {
    const movie = await getMovieDetails(input.movieId);
    if (!movie) return { success: false, error: "Movie not found" };
    const entry = await prisma.userWatchlistItem.findUnique({ where: { userId_tmdbId: { userId: context.userId, tmdbId: movie.id } }, select: { addedAt: true } });
    return { success: true, data: { movie: movieSummary(movie), inWatchlist: Boolean(entry), addedAt: entry?.addedAt.toISOString() ?? null } };
  },
} satisfies RegisteredTool<z.ZodObject<{ movieId: z.ZodString }>>;

const addToWatchlist = {
  definition: {
    name: "add_to_watchlist",
    description: "Explicitly add one verified TMDB movie to the authenticated user's watchlist. Call only after a clear user request, never for a suggestion or ambiguous title.",
    parameters: {
      type: "object",
      properties: { movieId: { type: "string", description: "The TMDB movie ID." } },
      required: ["movieId"],
    },
  },
  schema: z.object({ movieId: z.string().trim().regex(/^\d+$/) }).strict(),
  async execute(input: { movieId: string }, context: AIToolContext) {
    const movie = await getMovieDetails(input.movieId);
    if (!movie) return { success: false, error: "Movie not found" };

    await prisma.userWatchlistItem.upsert({
      where: { userId_tmdbId: { userId: context.userId, tmdbId: movie.id } },
      create: { userId: context.userId, tmdbId: movie.id },
      update: {},
    });

    return { success: true, data: { movie: movieSummary(movie), added: true }, displayMovies: [movie] };
  },
} satisfies RegisteredTool<z.ZodObject<{ movieId: z.ZodString }>>;

const removeFromWatchlist = {
  definition: {
    name: "remove_from_watchlist",
    description: "Explicitly remove one verified movie from the authenticated user's watchlist. Call only after a clear, unambiguous removal request; this is destructive.",
    parameters: {
      type: "object",
      properties: { movieId: { type: "string", description: "The TMDB movie ID." } },
      required: ["movieId"],
    },
  },
  schema: z.object({ movieId: z.string().trim().regex(/^\d+$/) }).strict(),
  async execute(input: { movieId: string }, context: AIToolContext) {
    const deleted = await prisma.userWatchlistItem.deleteMany({
      where: { userId: context.userId, tmdbId: input.movieId },
    });

    if (deleted.count === 0) {
      return { success: false, error: "Movie was not in the watchlist" };
    }

    return { success: true, data: { movieId: input.movieId, removed: true } };
  },
} satisfies RegisteredTool<z.ZodObject<{ movieId: z.ZodString }>>;

const tools = [searchTmdb, getMovieDetailsTool, discoverMovies, findSimilarMovies, getMyWatchHistory, getMyRatings, getMyReviews, getMyRating, getMyReview, getMyWatchlist, getMyMoviePreferences, addToWatchlist, removeFromWatchlist, checkWatchlist] as const;

export const toolDefinitions = tools.map((tool) => tool.definition);

export async function executeTool(name: string, args: unknown, context: AIToolContext): Promise<AIToolExecutionResult> {
  const tool = tools.find((candidate) => candidate.definition.name === name);
  if (!tool) return { success: false, error: "Unknown tool" };

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) return { success: false, error: "Invalid tool arguments" };

  try {
    const executableTool = tool as unknown as RegisteredTool<z.ZodTypeAny>;
    return await withToolTimeout(executableTool.execute(parsed.data, context));
  } catch (error) {
    console.error("[ai] tool execution failed", { tool: name, error: error instanceof Error ? error.name : "unknown" });
    return { success: false, error: name === "get_my_watch_history" || name.startsWith("get_my_") ? "User data request failed" : name === "add_to_watchlist" || name === "remove_from_watchlist" ? "Watchlist update failed" : "TMDB request failed" };
  }
}