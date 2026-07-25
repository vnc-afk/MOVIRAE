/**
 * StreamingSection Component
 * Displays streaming platform availability
 */

import { memo } from "react";
import { StreamingBadges } from "@/components/StreamingBadges";

interface StreamingSectionProps {
  platforms: string[];
  isLoading: boolean;
}

export const StreamingSection = memo(function StreamingSection({ platforms, isLoading }: StreamingSectionProps) {
  return (
    <div className="mt-6">
      <StreamingBadges platforms={platforms} loading={isLoading} />
    </div>
  );
});
