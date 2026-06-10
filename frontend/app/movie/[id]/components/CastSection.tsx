/**
 * CastSection Component
 * Displays movie cast carousel
 */

import { CastCarousel } from "@/components/CastCarousel";
import type { Movie } from "@/lib/types";

interface CastSectionProps {
  cast: Movie["cast"];
}

export function CastSection({ cast }: CastSectionProps) {
  if (!cast || cast.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold text-foreground mb-4">Cast</h2>
      <CastCarousel cast={cast} />
    </section>
  );
}
