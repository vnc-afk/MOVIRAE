import { z } from "zod";

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must use YYYY-MM format"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createCalendarItemSchema = z.object({
  tmdbId: z.string().min(1),
  movieTitle: z.string().min(1).max(200),
  date: z.coerce.date(),
  type: z.enum(["release", "planned", "reminder"]),
  poster: z.string().url().optional().nullable(),
  genre: z.string().max(100).optional().nullable(),
  opId: z.string().min(1).max(200).optional(),
});

export const deleteCalendarItemSchema = z.object({
  tmdbId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["planned", "reminder"]),
  opId: z.string().min(1).max(200).optional(),
});
