"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown } from "lucide-react";
import type { FilterState } from "../lib/types";

interface SortSelectorProps {
  value: FilterState["sortBy"];
  onChange: (value: FilterState["sortBy"]) => void;
  disabled?: boolean;
}

/**
 * Selects the sort order for movie results in discover.
 */
export const SortSelector = memo(function SortSelector({ value, onChange, disabled = false }: SortSelectorProps) {
  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <motion.div
        className="flex items-center gap-1 px-3 py-1.5 bg-secondary rounded-md border border-border text-xs font-medium text-muted-foreground hover:border-primary/50 transition-colors"
        whileHover={{ scale: 1.02 }}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as FilterState["sortBy"])}
          disabled={disabled}
          className="bg-transparent text-foreground outline-none cursor-pointer"
        >
          <option value="rating">Highest Rated</option>
          <option value="year">Newest</option>
          <option value="title">A-Z</option>
          <option value="runtime">Shortest First</option>
        </select>
      </motion.div>
    </motion.div>
  );
});
