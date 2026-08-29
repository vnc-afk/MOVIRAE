"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  currentIndex: number;
  totalSlides: number;
}

/**
 * Animated progress indicator showing completion across slides
 */
export function ProgressBar({ currentIndex, totalSlides }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-1.5 mb-4 max-w-md mx-auto">
      {Array.from({ length: totalSlides }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-1 rounded-full overflow-hidden bg-secondary"
        >
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: i <= currentIndex ? "100%" : "0%" }}
            transition={{ duration: 0.3 }}
          />
        </div>
      ))}
    </div>
  );
}
