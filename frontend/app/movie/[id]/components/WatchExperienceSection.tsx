
import { HowYouWatched } from "@/components/HowYouWatched";
import type { WatchExperience } from "@/lib/types";

interface WatchExperienceSectionProps {
  movieTitle: string;
  initialValue: WatchExperience | null;
  isDisabled: boolean;
  onSave: (experience: WatchExperience) => void;
}

/**
 * Wraps the HowYouWatched component, exposing the user's watch experience form
 * on the movie detail page and forwarding save events.
 */
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
