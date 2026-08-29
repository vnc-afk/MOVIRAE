"use client";

import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Slide } from "../shared";
import type { UserStats } from "@/lib/types";

interface WeekdaySlideProps {
  weekdayBreakdown: UserStats["weekdayBreakdown"];
  peakWeekday: { day: string; count: number } | null;
}

/**
 * Weekday viewing rhythm slide - Bar chart visualization
 */
export function WeekdaySlide({
  weekdayBreakdown,
  peakWeekday,
}: WeekdaySlideProps) {
  return (
    <Slide>
      <h2 className="font-display text-lg text-muted-foreground mb-2">
        Your viewing rhythm
      </h2>
      <p className="text-xs text-muted-foreground mb-4">When you watched most</p>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekdayBreakdown}>
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="count"
                fill="hsl(36, 90%, 50%)"
                radius={[6, 6, 0, 0]}
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      <p className="text-sm text-muted-foreground mt-3">
        Peak day:{" "}
        <span className="text-primary font-bold">
          {peakWeekday?.day ?? "No data yet"}
        </span>
        {peakWeekday ? ` with ${peakWeekday.count} films 🍿` : ""}
      </p>
    </Slide>
  );
}
