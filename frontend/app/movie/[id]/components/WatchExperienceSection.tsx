/**
 * WatchExperienceSection Component
 * Displays watch experience form
 */

import { HowYouWatched } from "@/components/HowYouWatched";
import type { WatchExperience } from "@/lib/types";

interface WatchExperienceSectionProps {
  movieTitle: string;
  initialValue: WatchExperience | null;
  isDisabled: boolean;
  onSave: (experience: WatchExperience) => void;
}

export function WatchExperienceSection({
  movieTitle,
  initialValue,
  isDisabled,
  onSave,
}: WatchExperienceSectionProps) {
  return (
    <section className="mt-10 max-w-md">
      <HowYouWatched
        movieTitle={movieTitle}
        initialValue={initialValue}
        onSave={onSave}
        disabled={isDisabled}
      />
    </section>
  );
}
