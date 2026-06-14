import type { Movie } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

export type RecommendationSectionKey = "top-picks" | "similar" | "trending";

export interface RecommendationsSnapshot {
  topPicks: Movie[];
  trending: Movie[];
  similar: Movie[];
  updatedAt: number;
}

export interface RecommendationSectionConfig {
  key: RecommendationSectionKey;
  title: string;
  icon: LucideIcon;
  initialItems: Movie[];
  initialPage: number;
  fetchPage: (page: number) => Promise<Movie[]>;
  priority?: boolean;
}
