"use client";

import { motion } from "framer-motion";
import { Film, Clock, Star, MapPin } from "lucide-react";
import { Slide } from "../shared";
import { ANIMATION_DELAYS } from "../../lib/constants";
import { formatStatsForDisplay } from "../../lib/formatters";

interface StatsSlideProps {
  totalWatched: number;
  totalHours: number;
  avgRating: number;
  countriesExplored: number;
  longestStreak: number;
}

/**
 * Big numbers slide - Key statistics cards
 */
export function StatsSlide({
  totalWatched,
  totalHours,
  avgRating,
  countriesExplored,
  longestStreak,
}: StatsSlideProps) {
  const stats = formatStatsForDisplay(
    totalWatched,
    totalHours,
    avgRating,
    countriesExplored
  );

  const cards = [
    { icon: Film, value: stats.films, label: "Films", delay: 0.1 },
    { icon: Clock, value: stats.hours, label: "Hours", delay: 0.2 },
    { icon: Star, value: stats.rating, label: "Avg Rating", delay: 0.3 },
    { icon: MapPin, value: stats.countries, label: "Countries", delay: 0.4 },
  ];

  return (
    <Slide>
      <h2 className="font-display text-lg text-muted-foreground mb-8">
        This year, you watched
      </h2>
      <div className="grid grid-cols-2 gap-6 max-w-sm w-full">
        {cards.map(({ icon: Icon, value, label, delay }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-xl bg-card p-5 card-shadow"
          >
            <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6"
      >
        <p className="text-sm text-muted-foreground">
          🔥 Longest streak:{" "}
          <span className="text-foreground font-semibold">
            {longestStreak} days
          </span>
        </p>
      </motion.div>
    </Slide>
  );
}
