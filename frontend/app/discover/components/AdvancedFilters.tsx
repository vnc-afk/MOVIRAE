"use client";

import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RuntimeFilter } from "./RuntimeFilter";
import type { FilterState } from "../lib/types";

interface AdvancedFiltersProps {
  runtimeRange: FilterState["runtimeRange"];
  onRuntimeChange: (value: [number, number]) => void;
}

/**
 * Collapsible container for the discover runtime filter controls.
 */
export const AdvancedFilters = memo(function AdvancedFilters({
  runtimeRange,
  onRuntimeChange,
}: AdvancedFiltersProps) {

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ x: 2 }}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.3 }}
        >
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </motion.div>
        {isOpen ? "Hide" : "Show"} Advanced Filters
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden space-y-5"
          >
            <RuntimeFilter value={runtimeRange} onChange={onRuntimeChange} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
