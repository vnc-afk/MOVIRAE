import type { Movie } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

/**
 * Supported recommendation buckets rendered on the recommendations page.
 */
export type RecommendationSectionKey = "top-picks" | "similar" | "trending";

/**
 * The hydrated recommendations payload returned by the backend snapshot endpoint.
 */
export interface RecommendationsSnapshot {
  topPicks: Movie[];
  trending: Movie[];
  similar: Movie[];
  updatedAt: number;
}

/**
 * Describes a single recommendations section rendered from the snapshot payload.
 */
export interface RecommendationSectionConfig {
  key: RecommendationSectionKey;
  title: string;
  icon: LucideIcon;
  initialItems: Movie[];
  priority?: boolean;
}
