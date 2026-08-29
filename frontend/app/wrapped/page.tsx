"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  useWrappedData,
  useWrappedNavigation,
  useWrappedAnalytics,
  useWrappedFormatters,
} from "./hooks";
import { WRAPPED_CONFIG } from "./lib/constants";
import * as Slides from "./components/slides";
import { ProgressBar, Navigation } from "./components/shared";

/**
 * Page Component
 *
 * Main orchestrator component that:
 * - Manages all hooks
 * - Renders slide carousel
 * - Coordinates data flow
 */
export default function Page() {
  const { data: session } = useSession();

  const { data: stats, isLoading, isError, refetch } = useWrappedData({
    enabled: !!session,
  });

  const nav = useWrappedNavigation(WRAPPED_CONFIG.TOTAL_SLIDES);
  const formatters = useWrappedFormatters();
  const analytics = useWrappedAnalytics({
    userId: session?.user?.id,
    enabled: true,
  });

  const processed = useMemo(
    () => formatters.processStats(stats),
    [formatters.processStats, stats]
  );

  const moodData = useMemo(
    () => formatters.processors.transformMoodDataForRadar(processed.stats.moodBreakdown),
    [formatters.processors, processed.stats.moodBreakdown]
  );

  useEffect(() => {
    // FIX: was a locally-duplicated SLIDE_IDS array — WRAPPED_CONFIG
    // already defines this list in constants.ts; reusing it means there's
    // one place to update slide order/ids instead of two.
    analytics.trackEvent("slide_view", WRAPPED_CONFIG.SLIDE_IDS[nav.currentIndex] ?? String(nav.currentIndex));
  }, [nav.currentIndex, analytics]);

  const slides: React.ReactNode[] = [
    <Slides.IntroSlide
      key="intro"
      wrappedYear={processed.derived.wrappedYear}
      activityStartLabel={processed.derived.activityStartLabel}
      activityEndLabel={processed.derived.activityEndLabel}
    />,
    <Slides.StatsSlide
      key="stats"
      totalWatched={processed.stats.totalWatched}
      totalHours={processed.stats.totalHours}
      avgRating={processed.stats.avgRating}
      countriesExplored={processed.stats.countriesExplored}
      longestStreak={processed.stats.longestStreak}
    />,
    <Slides.GenreSlide
      key="genres"
      genreBreakdown={processed.stats.genreBreakdown}
      favoriteGenre={processed.stats.favoriteGenre}
    />,
    <Slides.MoodSlide key="mood" moodData={moodData} />,
    <Slides.PlatformSlide
      key="platform"
      platformBreakdown={processed.stats.platformBreakdown}
      contextBreakdown={processed.stats.contextBreakdown}
      maxPlatformCount={processed.derived.maxPlatformCount}
      maxContextCount={processed.derived.maxContextCount}
    />,
    <Slides.WeekdaySlide
      key="weekday"
      weekdayBreakdown={processed.stats.weekdayBreakdown}
      peakWeekday={processed.derived.peakWeekday}
    />,
    <Slides.SummarySlide
      key="summary"
      summaryTitle={processed.derived.summaryTitle}
      badges={processed.derived.badges}
      totalWatched={processed.stats.totalWatched}
      totalHours={processed.stats.totalHours}
      countriesExplored={processed.stats.countriesExplored}
      favoriteGenre={processed.stats.favoriteGenre}
      longestStreak={processed.stats.longestStreak}
      activityEndLabel={processed.derived.activityEndLabel}
      hasData={!!stats}
    />,
  ];

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="max-w-md mx-auto space-y-4">
          <div className="h-1 w-full rounded-full bg-secondary animate-pulse" />
          <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 rounded-full bg-secondary animate-pulse" />
            <div className="h-8 w-64 rounded bg-secondary animate-pulse" />
            <div className="h-4 w-48 rounded bg-secondary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-10">
        <div className="max-w-md mx-auto rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            We couldn't load your Wrapped stats. Please try again.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0 min-h-screen">
      <div className="container py-6">
        <ProgressBar currentIndex={nav.currentIndex} totalSlides={nav.totalSlides} />

        <AnimatePresence mode="wait">{slides[nav.currentIndex]}</AnimatePresence>

        <Navigation
          currentIndex={nav.currentIndex}
          totalSlides={nav.totalSlides}
          onNext={nav.next}
          onPrev={nav.prev}
          canNext={nav.canGoNext}
          canPrev={nav.canGoPrev}
        />
      </div>
    </div>
  );
}