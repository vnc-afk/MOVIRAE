"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMovieVideos } from "@/app/movie/[id]/hooks/useMovieVideos";

interface TrailerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  movieId: string;
}

export function TrailerModal({ open, onOpenChange, title, movieId }: TrailerModalProps) {
  const videosQuery = useMovieVideos(movieId, Boolean(open));
  const trailer = videosQuery.data?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-card">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="font-display">{title} — Trailer</DialogTitle>
          <DialogDescription className="sr-only">
            Watch the trailer for {title}.
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video bg-foreground/5 flex items-center justify-center m-4 mt-2 rounded-lg">
          {videosQuery.isLoading && (
            <p className="text-muted-foreground text-sm">Loading trailer…</p>
          )}

          {!videosQuery.isLoading && trailer && trailer.site === "YouTube" && (
            <iframe
              title={`${title} — Trailer`}
              src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&rel=0`}
              className="w-full h-full rounded-lg"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}

          {!videosQuery.isLoading && (!trailer || trailer.site !== "YouTube") && (
            <p className="text-muted-foreground text-sm">
              Trailer not available. Try searching on YouTube or view movie details on TMDB.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
