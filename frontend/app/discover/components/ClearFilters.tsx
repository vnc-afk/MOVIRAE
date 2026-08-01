import { X } from "lucide-react";
import { memo } from "react";

interface ClearFiltersProps {
  activeCount: number;
  movieCount: number;
  onClear: () => void;
  isLoading: boolean;
}

/**
 * Displays the active filter summary and a reset action for the discover page.
 */
export const ClearFilters = memo(function ClearFilters({
  activeCount,
  movieCount,
  onClear,
  isLoading,
}: ClearFiltersProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-destructive hover:underline"
          >
            <X className="h-3 w-3" /> Clear {activeCount} filters
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Loading films..." : `${movieCount} ${movieCount === 1 ? "film" : "films"}`}
        </span>
      </div>
    </div>
  );
});