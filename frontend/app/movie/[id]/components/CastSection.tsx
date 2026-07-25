
import { memo } from "react";
import { CastCarousel } from "@/components/CastCarousel";
import type { Movie } from "@/lib/types";

interface CastSectionProps {
  cast: Movie["cast"];
}

/**
 * Displays the cast carousel if there are cast members available.
 * Memoized to prevent re-renders when unrelated parent state updates occur.
 */
export const CastSection = memo(function CastSection({ cast }: CastSectionProps) {
  if (!cast || cast.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold text-foreground mb-4">Cast</h2>
      <CastCarousel cast={cast} />
    </section>
  );
});
