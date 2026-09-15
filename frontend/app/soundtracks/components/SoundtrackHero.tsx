import { Disc3, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Soundtrack } from "../lib/types";

export function SoundtrackHero({ soundtrack, isFavorite, isFavoritePending, onToggleFavorite }: { soundtrack: Soundtrack; isFavorite: boolean; isFavoritePending: boolean; onToggleFavorite: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 to-foreground/30" />
      <img src={soundtrack.poster} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
      <div className="relative z-10 flex items-end gap-6 p-6 max-sm:flex-col max-sm:items-start">
        <img src={soundtrack.poster} alt={soundtrack.movieTitle} className="h-36 w-24 rounded-lg object-cover shadow-lg" />
        <div className="pb-1">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary-foreground/60">Original soundtrack</p>
          <h2 className="font-display text-2xl font-bold text-primary-foreground">{soundtrack.movieTitle}</h2>
          <p className="mt-1 text-sm text-primary-foreground/70">
            <Disc3 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {soundtrack.composer} · {soundtrack.tracks.length} tracks
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={isFavoritePending} size="sm" variant={isFavorite ? "default" : "secondary"} className="gap-1.5 text-xs" onClick={onToggleFavorite}>
              <Heart className={`h-3 w-3 ${isFavorite ? "fill-current" : ""}`} /> {isFavoritePending ? "Saving..." : isFavorite ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
