"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface NavigationProps {
  currentIndex: number;
  totalSlides: number;
  onNext: () => void;
  onPrev: () => void;
  canNext: boolean;
  canPrev: boolean;
}

/**
 * Navigation controls with smart disabled states
 */
export function Navigation({
  currentIndex,
  totalSlides,
  onNext,
  onPrev,
  canNext,
  canPrev,
}: NavigationProps) {
  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-foreground disabled:opacity-30 hover:bg-secondary/80 transition-colors"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-xs text-muted-foreground">
        {currentIndex + 1} / {totalSlides}
      </span>
      <button
        onClick={onNext}
        disabled={!canNext}
        className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30 hover:bg-primary/90 transition-colors"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
