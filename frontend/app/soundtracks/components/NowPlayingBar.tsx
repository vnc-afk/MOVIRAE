"use client";

import { memo } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import type { Soundtrack, Track } from "../lib/types";

interface NowPlayingBarProps {
  soundtrack: Soundtrack;
  trackId: string;
  track?: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onToggle: (trackId: string) => void;
  onSeek: (value: number) => void;
  onSkip: (seconds: number) => void;
  onStop: () => void;
}

export const NowPlayingBar = memo(function NowPlayingBar({ soundtrack, trackId, track, isPlaying, currentTime, duration, onToggle, onSeek, onSkip, onStop }: NowPlayingBarProps) {
  const activeTrack = track ?? soundtrack.tracks.find((item) => item.id === trackId) ?? null;
  if (!activeTrack) return null;

  const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
  const safeDuration = Number.isFinite(duration) ? duration : 0;
  const sliderValue = Math.min(safeCurrentTime, safeDuration || 0);

  return (
    <div className="fixed bottom-16 left-4 right-4 z-40 mx-auto flex max-w-2xl items-center gap-4 rounded-xl border border-primary/30 bg-card p-3 shadow-lg md:bottom-4">
      <img src={soundtrack.poster} alt="" className="h-10 w-10 rounded-md object-cover" />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{activeTrack.title}</p><p className="truncate text-xs text-muted-foreground">{activeTrack.artist}</p></div>
      <div className="flex items-center gap-1"><button type="button" aria-label="Skip back 10 seconds" onClick={() => onSkip(-10)} className="hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground sm:flex"><RotateCcw className="h-3.5 w-3.5" /></button><button type="button" aria-label={isPlaying ? "Pause playback" : "Resume playback"} onClick={() => onToggle(trackId)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">{isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}</button><button type="button" aria-label="Skip forward 10 seconds" onClick={() => onSkip(10)} className="hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground sm:flex"><RotateCw className="h-3.5 w-3.5" /></button></div>
      <div className="hidden w-40 items-center gap-2 md:flex"><span className="text-[10px] text-muted-foreground">{formatTime(safeCurrentTime)}</span><input aria-label="Seek audio" type="range" min={0} max={safeDuration || 0} step={0.1} value={sliderValue} onChange={(event) => onSeek(Number(event.target.value))} className="w-full accent-primary" /><span className="text-[10px] text-muted-foreground">{formatTime(safeDuration)}</span></div>
      <button type="button" aria-label="Close player" onClick={onStop} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
});

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}
