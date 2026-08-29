import type { UserStats, Mood, WatchContext, WatchPlatform } from "@/lib/types";

/**
 * Feature-local types for wrapped module
 */

export interface WrappedSlide {
  id: string;
  order: number;
  label: string;
}

export interface SlideContext {
  slideIndex: number;
  totalSlides: number;
  canGoNext: boolean;
  canGoPrev: boolean;
}

export interface AnalyticsEvent {
  event: "slide_view" | "slide_transition" | "interaction";
  slideId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ProcessedStats {
  stats: UserStats;
  derived: {
    wrappedYear: number;
    activityStartLabel: string | null;
    activityEndLabel: string | null;
    peakWeekday: { day: string; count: number } | null;
    maxPlatformCount: number;
    maxContextCount: number;
    summaryTitle: string;
    badges: string[];
  };
}

export interface WrappedCache {
  stats: UserStats | null;
  timestamp: number;
  version: number;
}
