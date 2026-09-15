"use client";

import { memo } from "react";
import { Clock, Music2 } from "lucide-react";
import type { Soundtrack } from "../lib/types";

interface TrackListProps {
  tracks: Soundtrack["tracks"];
  isLoading?: boolean;
  onPlay: (trackId: string) => void;
}

export const TrackList = memo(function TrackList({ tracks, isLoading = false, onPlay }: TrackListProps) {
  if (tracks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {isLoading ? "Loading soundtrack tracks..." : "No soundtrack is available for this movie."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {tracks.map((track, index) => (
        <button type="button" key={track.id} onClick={() => onPlay(track.id)} className={`group flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${index < tracks.length - 1 ? "border-b border-border" : ""}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Music2 className="h-3.5 w-3.5" /></div>
          <span className="w-5 text-right text-xs text-muted-foreground">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{track.title}</p>
            <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{track.duration}</span>
        </button>
      ))}
    </div>
  );
});
