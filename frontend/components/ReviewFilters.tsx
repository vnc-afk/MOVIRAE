import { Brain, Coffee, Laugh, BookOpen, Sparkles, ThumbsUp } from "lucide-react";
import type { ReactNode } from "react";
import type { ReviewTone } from "@/lib/types";

export type ReviewFilter = ReviewTone | "all" | "most-helpful";

interface ReviewFiltersProps {
  activeTone: ReviewFilter;
  onToneChange: (tone: ReviewFilter) => void;
}

const filters: { key: ReviewFilter; label: string; icon: ReactNode }[] = [
  { key: "all", label: "All", icon: <Sparkles className="h-3 w-3" /> },
  { key: "most-helpful", label: "Most Helpful", icon: <ThumbsUp className="h-3 w-3" /> },
  { key: "funny", label: "Funny", icon: <Laugh className="h-3 w-3" /> },
  { key: "serious", label: "Serious", icon: <BookOpen className="h-3 w-3" /> },
  { key: "analytical", label: "Analytical", icon: <Brain className="h-3 w-3" /> },
  { key: "casual", label: "Casual", icon: <Coffee className="h-3 w-3" /> },
];

export function ReviewFilters({ activeTone, onToneChange }: ReviewFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Review filters">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onToneChange(filter.key)}
          aria-pressed={activeTone === filter.key}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all duration-200 hover:scale-105 active:scale-95 ${
            activeTone === filter.key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-secondary text-muted-foreground hover:border-foreground/20 hover:text-foreground"
          }`}
        >
          {filter.icon}
          {filter.label}
        </button>
      ))}
    </div>
  );
}