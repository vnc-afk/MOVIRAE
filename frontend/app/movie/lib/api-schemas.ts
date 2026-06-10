import { z } from "zod";

export const createReviewSchema = z.object({
  tmdbId: z.string().min(1, "Movie ID is required"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(5000).optional(),
  opId: z.string().optional(),
});

export const reviewOpSchema = z.object({ opId: z.string().optional() });

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(5000).optional(),
});
