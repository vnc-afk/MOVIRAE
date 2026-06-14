"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, Sparkles } from "lucide-react";

export function StatsHeader() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Your Stats</h1>
        </div>
        <Link
          href="/wrapped"
          className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> View Wrapped
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">Your year in review — films, habits, moods, and more.</p>
    </motion.div>
  );
}
