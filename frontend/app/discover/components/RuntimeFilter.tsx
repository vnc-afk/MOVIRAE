"use client";

import { Clock } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { FilterState } from "../lib/types";

interface RuntimeFilterProps {
  value: FilterState["runtimeRange"];
  onChange: (value: [number, number]) => void;
}

/**
 * Provides a runtime slider for filtering movie durations.
 */
export function RuntimeFilter({ value, onChange }: RuntimeFilterProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Duration: {value[0]}–{value[1]} min
        </span>
      </div>
      <div className="max-w-sm px-1">
        <Slider
          min={0}
          max={200}
          step={5}
          value={value}
          onValueChange={(newValue) => onChange(newValue as [number, number])}
        />
      </div>
    </div>
  );
}
