
import { memo } from "react";
import { StreamingBadges } from "@/components/StreamingBadges";

interface StreamingSectionProps {
  platforms: string[];
  isLoading: boolean;
}

/**
 * Lightweight wrapper around StreamingBadges to display streaming availability.
 * Memoized to avoid re-rendering when parent state changes do not affect platforms.
 */
export const StreamingSection = memo(function StreamingSection({ platforms, isLoading }: StreamingSectionProps) {
  return (
    <div className="mt-6">
      <StreamingBadges platforms={platforms} loading={isLoading} />
    </div>
  );
});
