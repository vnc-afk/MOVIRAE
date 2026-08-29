"use client";

import { motion } from "framer-motion";
import { Award } from "lucide-react";
import { Slide } from "../shared";
import { ANIMATION_DELAYS } from "../../lib/constants";

interface SummarySlideProps {
  summaryTitle: string;
  badges: string[];
  totalWatched: number;
  totalHours: number;
  countriesExplored: number;
  favoriteGenre: string;
  longestStreak: number;
  activityEndLabel: string | null;
  hasData: boolean;
}

/**
 * Summary slide - Awards and badges
 */
export function SummarySlide({
  summaryTitle,
  badges,
  totalWatched,
  totalHours,
  countriesExplored,
  favoriteGenre,
  longestStreak,
  activityEndLabel,
  hasData,
}: SummarySlideProps) {
  return (
    <Slide>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          delay: ANIMATION_DELAYS.STAGGER_ITEM,
          type: "spring",
        }}
      >
        <Award className="h-16 w-16 text-primary mx-auto mb-6" />
      </motion.div>

      {hasData ? (
        <>
          <h2 className="font-display text-3xl font-bold text-foreground mb-3">
            {summaryTitle}
          </h2>

          <p className="text-muted-foreground max-w-md mb-8">
            {totalWatched} films, {totalHours} hours, {countriesExplored}{" "}
            countries explored.
            {activityEndLabel ? ` Updated through ${activityEndLabel}.` : ""}
            {" "}Your love for {favoriteGenre || "movies"} defines your taste, and your{" "}
            {longestStreak}-day streak shows true dedication.
          </p>

          <div className="flex flex-wrap gap-2 justify-center">
            {badges.map((badge) => (
              <motion.span
                key={badge}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.3 + Math.random() * 0.3,
                  type: "spring",
                }}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
              >
                {badge}
              </motion.span>
            ))}
          </div>
        </>
      ) : null}
    </Slide>
  );
}
