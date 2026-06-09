"use client";

import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";

export function DiscoverHeader() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-bold text-foreground">Smart Discover</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Search TMDB movies, filter by genre, and sort by runtime or rating.
      </p>
    </motion.div>
  );
}
