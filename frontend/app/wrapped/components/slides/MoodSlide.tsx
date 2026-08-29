"use client";

import { motion } from "framer-motion";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { Slide } from "../shared";
import type { Mood } from "@/lib/types";

interface MoodSlideProps {
  moodData: Array<{ mood: Mood; value: number }>;
}

/**
 * Mood radar slide - Emotional landscape visualization
 */
export function MoodSlide({ moodData }: MoodSlideProps) {
  return (
    <Slide>
      <h2 className="font-display text-lg text-muted-foreground mb-2">
        Your emotional landscape
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        The moods you gravitated toward this year
      </p>
      <motion.div
        initial={{ opacity: 0, rotate: -10 }}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={moodData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="mood"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Radar
                dataKey="value"
                stroke="hsl(36, 90%, 50%)"
                fill="hsl(36, 90%, 50%)"
                fillOpacity={0.3}
                animationDuration={1000}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </Slide>
  );
}
