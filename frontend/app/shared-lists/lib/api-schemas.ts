import { z } from "zod";

export const createSharedListSchema = z.object({
  name: z.string().min(1, "List name is required").max(250),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["public", "private", "group"]).default("public"),
  groupId: z.string().optional(),
});

export const addSharedListCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required"),
  parentId: z.string().optional(),
  opId: z.string().optional(),
});

export const sharedListMovieSchema = z.object({
  movieId: z.string().min(1, "Movie ID is required"),
  opId: z.string().optional(),
});

export const sharedListOpSchema = z.object({
  opId: z.string().optional(),
});
