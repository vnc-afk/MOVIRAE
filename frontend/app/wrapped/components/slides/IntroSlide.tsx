"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Slide } from "../shared";
import { ANIMATION_DELAYS } from "../../lib/constants";

interface IntroSlideProps {
  wrappedYear: number;
  activityStartLabel: string | null;
  activityEndLabel: string | null;
}

/**
 * Intro slide - Title and context
 * Focused, single responsibility
 */
export function IntroSlide({
  wrappedYear,
  activityStartLabel,
  activityEndLabel,
}: IntroSlideProps) {
  const dateRange =
    activityStartLabel && activityEndLabel
      ? `from ${activityStartLabel} to ${activityEndLabel}`
      : "from your activity";

  return (
    <Slide>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          delay: ANIMATION_DELAYS.STAGGER_ITEM * 2,
          type: "spring",
        }}
      >
        <Sparkles className="h-16 w-16 text-primary mx-auto mb-6" />
      </motion.div>
      <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-3">
        Your {wrappedYear} Wrapped
      </h1>
      <p className="text-muted-foreground text-lg max-w-md">
        A precise look at your cinema year, {dateRange}.
      </p>
    </Slide>
  );
}
