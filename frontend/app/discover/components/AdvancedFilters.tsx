"use client";

import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Globe2, Languages } from "lucide-react";
import { RuntimeFilter } from "./RuntimeFilter";
import type { DiscoverMetadata, FilterState } from "../lib/types";

interface AdvancedFiltersProps {
  runtimeRange: FilterState["runtimeRange"];
  onRuntimeChange: (value: [number, number]) => void;
  metadata: DiscoverMetadata;
  languages: string[];
  countries: string[];
  onToggleLanguage: (value: string) => void;
  onToggleCountry: (value: string) => void;
}

function FilterChipGroup({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  values: readonly string[];
  onToggle: (value: string) => void;
}) {
  const Icon = label === "Language" ? Languages : Globe2;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={[
                "rounded-full border px-2.5 py-1.5 text-xs transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-secondary text-foreground hover:border-primary/50 hover:text-foreground",
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Collapsible container for the discover runtime filter controls.
 */
export const AdvancedFilters = memo(function AdvancedFilters({
  runtimeRange,
  onRuntimeChange,
  metadata,
  languages,
  countries,
  onToggleLanguage,
  onToggleCountry,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <motion.button
        type="button"
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
            className="overflow-hidden space-y-5 rounded-xl border border-border bg-secondary/30 p-4"
          >
            <RuntimeFilter value={runtimeRange} onChange={onRuntimeChange} />

            <div className="grid gap-4 md:grid-cols-2">
              <FilterChipGroup label="Language" options={metadata.native.languages} values={languages} onToggle={onToggleLanguage} />
              <FilterChipGroup label="Country" options={metadata.native.countries} values={countries} onToggle={onToggleCountry} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
