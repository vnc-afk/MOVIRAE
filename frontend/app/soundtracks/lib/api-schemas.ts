import { z } from "zod";

export const soundtracksQuerySchema = z.object({
  q: z.string().trim().max(100, "Search query is too long").optional().default(""),
  page: z.coerce.number().int().positive().default(1),
});

export type SoundtracksQuery = z.infer<typeof soundtracksQuerySchema>;
