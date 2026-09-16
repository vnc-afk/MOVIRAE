/**
 * lib/api-schemas.ts
 * 
 * Request body validation schemas using Zod
 * Provides type-safe input validation across all API routes
 */

import { z } from "zod";

// ============================================================================
// Common Schemas (Reusable)
// ============================================================================

/**
 * Base pagination query params
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

// ============================================================================
// Groups Schemas
// ============================================================================

/**
 * Create group request
 */
export const createGroupSchema = z.object({
  name: z
    .string()
    .min(2, "Group name must be at least 2 characters")
    .max(100, "Group name must be less than 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be less than 500 characters"),
});

export type CreateGroupRequest = z.infer<typeof createGroupSchema>;

/**
 * Update group request
 */
export const updateGroupSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100)
    .optional(),
  description: z
    .string()
    .min(10)
    .max(500)
    .optional(),
  avatar: z
    .string()
    .url()
    .optional(),
});

export type UpdateGroupRequest = z.infer<typeof updateGroupSchema>;

// ============================================================================
// Discussion Schemas
// ============================================================================

/**
 * Create discussion request
 */
export const createDiscussionSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  body: z
    .string()
    .min(10, "Body must be at least 10 characters")
    .max(5000, "Body must be less than 5000 characters"),
  movieId: z
    .string()
    .optional(),
  movieIds: z
    .array(z.string())
    .max(10, "You can attach up to 10 movies")
    .optional(),
  opId: z
    .string()
    .optional(),
});

export type CreateDiscussionRequest = z.infer<typeof createDiscussionSchema>;

/**
 * Add discussion reply request
 */
export const addDiscussionReplySchema = z.object({
  body: z
    .string()
    .min(1, "Reply cannot be empty")
    .max(2000, "Reply must be less than 2000 characters"),
  opId: z
    .string()
    .optional(),
});

export type AddDiscussionReplyRequest = z.infer<typeof addDiscussionReplySchema>;

/**
 * Like discussion request (minimal validation)
 */
export const likeDiscussionSchema = z.object({
  opId: z
    .string()
    .optional(),
});

export type LikeDiscussionRequest = z.infer<typeof likeDiscussionSchema>;

// ============================================================================
// Event Schemas
// ============================================================================

/**
 * Create event request
 */
export const createEventSchema = z.object({
  title: z
    .string()
    .min(3, "Event title must be at least 3 characters")
    .max(100, "Event title must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format")
    .refine((date) => {
      const eventDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    }, "Event date cannot be in the past"),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Start time must be in HH:mm format"),
  location: z
    .string()
    .max(150, "Location must be less than 150 characters")
    .optional(),
  opId: z
    .string()
    .optional(),
});

export type CreateEventRequest = z.infer<typeof createEventSchema>;

/**
 * Update event RSVP request
 */
export const updateEventRsvpSchema = z.object({
  rsvpStatus: z
    .enum(["yes", "no", "maybe", "pending"], {
      errorMap: () => ({
        message: 'RSVP status must be one of: "yes", "no", "maybe", "pending"',
      }),
    })
    .transform((val) => val.toLowerCase()),
  opId: z
    .string()
    .optional(),
});

export type UpdateEventRsvpRequest = z.infer<typeof updateEventRsvpSchema>;

// ============================================================================
// Movie Schemas
// ============================================================================

/**
 * Add movie to group request
 */
export const addGroupMovieSchema = z.object({
  tmdbId: z
    .string()
    .min(1, "TMDB ID is required")
    .or(z.object({ movieId: z.string() })),
  metadata: z
    .record(z.unknown())
    .optional(),
  opId: z
    .string()
    .optional(),
});

export type AddGroupMovieRequest = z.infer<typeof addGroupMovieSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safely parse and validate request JSON
 * 
 * @example
 * const data = await parseValidRequest(request, createGroupSchema);
 * if (!data) return apiBadRequest("Invalid request body");
 * // data is now type-safe
 */
export async function parseValidRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T | null> {
  try {
    const json = await request.json();
    return schema.parse(json);
  } catch (error) {
    return null;
  }
}

/**
 * Validate and return errors if present
 * 
 * @example
 * const errors = validateRequest(body, createGroupSchema);
 * if (errors) return apiValidationError("Invalid input", errors);
 */
export function validateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): Record<string, string> | null {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    return Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
        .map(([field, messages]) => [field, messages[0]])
    );
  }

  return null;
}

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Groups list query params
 */
export const groupsListQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
});

export type GroupsListQuery = z.infer<typeof groupsListQuerySchema>;

/**
 * Discussions list query params
 */
export const discussionsListQuerySchema = paginationSchema.extend({
  sort: z.enum(["latest", "popular", "oldest"]).default("latest"),
});

export type DiscussionsListQuery = z.infer<typeof discussionsListQuerySchema>;

/**
 * Events list query params
 */
export const eventsListQuerySchema = paginationSchema.extend({
  upcoming: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") return false;
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const normalized = value.toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
      }
      return value;
    }, z.boolean())
    .default(false),
  sort: z.enum(["date", "title"]).default("date"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export type EventsListQuery = z.infer<typeof eventsListQuerySchema>;
