/**
 * useWrappedNavigation Hook
 *
 * Responsibilities:
 * - Manage slide pagination state
 * - Handle prev/next navigation
 * - Compute navigation state (canGo flags)
 *
 * Testable: Yes (pure state logic)
 * Pure: Yes (no side effects)
 */

import { useCallback, useMemo, useState } from "react";
import { WRAPPED_CONFIG } from "../lib/constants";

interface NavigationState {
  currentIndex: number;
  totalSlides: number;
  canGoNext: boolean;
  canGoPrev: boolean;
}

interface UseWrappedNavigationReturn extends NavigationState {
  goToSlide: (index: number) => void;
  next: () => void;
  prev: () => void;
}

export function useWrappedNavigation(
  totalSlides: number = WRAPPED_CONFIG.TOTAL_SLIDES
): UseWrappedNavigationReturn {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Compute navigation capabilities
  const navState = useMemo<NavigationState>(() => ({
    currentIndex,
    totalSlides,
    canGoNext: currentIndex < totalSlides - 1,
    canGoPrev: currentIndex > 0,
  }), [currentIndex, totalSlides]);

  // Bounded navigation
  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, totalSlides - 1)));
  }, [totalSlides]);

  const next = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [currentIndex, goToSlide]);

  const prev = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [currentIndex, goToSlide]);

  return {
    ...navState,
    goToSlide,
    next,
    prev,
  };
}
