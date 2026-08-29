"use client";

import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Slide } from "../shared";
import { COLORS } from "../../lib/constants";
import type { UserStats } from "@/lib/types";

interface GenreSlideProps {
  genreBreakdown: UserStats["genreBreakdown"];
  favoriteGenre: string;
}

/**
 * Genre breakdown slide - Pie chart visualization
 */
export function GenreSlide({
  genreBreakdown,
  favoriteGenre,
}: GenreSlideProps) {
  return (
    <Slide>
      <h2 className="font-display text-lg text-muted-foreground mb-2">
        Your genre personality
      </h2>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genreBreakdown}
                dataKey="count"
                nameKey="genre"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                paddingAngle={3}
                animationBegin={300}
                animationDuration={800}
              >
                {genreBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {genreBreakdown.map((g, i) => (
            <span
              key={g.genre}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {g.genre} ({g.pct}%)
            </span>
          ))}
        </div>
      </motion.div>
      <p className="text-sm text-muted-foreground mt-4">
        Your top genre:{" "}
        <span className="text-primary font-bold">{favoriteGenre}</span>
      </p>
    </Slide>
  );
}
