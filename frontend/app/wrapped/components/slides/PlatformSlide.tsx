"use client";

import { motion } from "framer-motion";
import { Slide } from "../shared";
import { COLORS } from "../../lib/constants";
import type { UserStats } from "@/lib/types";

interface PlatformSlideProps {
  platformBreakdown: UserStats["platformBreakdown"];
  contextBreakdown: UserStats["contextBreakdown"];
  maxPlatformCount: number;
  maxContextCount: number;
}

/**
 * Platform and context slide - How you watched breakdown
 */
export function PlatformSlide({
  platformBreakdown,
  contextBreakdown,
  maxPlatformCount,
  maxContextCount,
}: PlatformSlideProps) {
  return (
    <Slide>
      <h2 className="font-display text-lg text-muted-foreground mb-6">
        How you watched
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl w-full">
        {/* Platform breakdown */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-card p-5 card-shadow"
        >
          <p className="text-xs text-muted-foreground mb-3 font-medium">
            Platform
          </p>
          <div className="space-y-2">
            {platformBreakdown.slice(0, 5).map((p, i) => (
              <div key={p.platform} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 text-right truncate">
                  {p.platform}
                </span>
                <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(p.count / maxPlatformCount) * 100}%`,
                    }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-6">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Context breakdown */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl bg-card p-5 card-shadow"
        >
          <p className="text-xs text-muted-foreground mb-3 font-medium">
            Watch Context
          </p>
          <div className="space-y-2">
            {contextBreakdown.map((c, i) => (
              <div key={c.context} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 text-right truncate">
                  {c.context}
                </span>
                <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(c.count / maxContextCount) * 100}%`,
                    }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className="h-full bg-accent rounded-full"
                  />
                </div>
                <span className="text-xs text-muted-foreground w-6">
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </Slide>
  );
}
