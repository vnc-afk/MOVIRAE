"use client";

import { memo, useEffect, useState } from "react";
import { Heart, Search, X } from "lucide-react";
import type { Soundtrack } from "../lib/types";

interface SoundtrackSidebarProps {
  items: Soundtrack[];
  selectedId: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
  view: "all" | "saved";
  onViewChange: (view: "all" | "saved") => void;
}

export const SoundtrackSidebar = memo(function SoundtrackSidebar({
  items,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  view,
  onViewChange,
}: SoundtrackSidebarProps) {
  const [draftSearch, setDraftSearch] = useState(search);
  const hasSearch = draftSearch.trim().length > 0;

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  useEffect(() => {
    if (draftSearch === search) return;
    const timeout = window.setTimeout(() => onSearchChange(draftSearch), 350);
    return () => window.clearTimeout(timeout);
  }, [draftSearch, onSearchChange, search]);

  return (
    <aside className="space-y-4" aria-label="Soundtrack library">
      <div className="flex rounded-lg bg-secondary p-1" role="tablist" aria-label="Soundtrack views">
        {(["all", "saved"] as const).map((option) => <button key={option} type="button" role="tab" aria-selected={view === option} onClick={() => onViewChange(option)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium capitalize transition ${view === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Heart className={`h-3.5 w-3.5 ${option === "saved" && view === option ? "fill-current" : ""}`} />{option === "all" ? "All" : "Saved"}</button>)}
      </div>
      <label className="relative block">
        <span className="sr-only">Search soundtracks</span>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={draftSearch}
          onChange={(event) => setDraftSearch(event.target.value)}
          placeholder="Search soundtracks..."
          className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {hasSearch && (
          <button
            type="button"
            aria-label="Clear soundtrack search"
            onClick={() => {
              setDraftSearch("");
              onSearchChange("");
            }}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </label>
      {hasSearch && (
        <p className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "match" : "matches"}
        </p>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.movieId}
            type="button"
            onClick={() => onSelect(item.movieId)}
            aria-pressed={selectedId === item.movieId}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
              selectedId === item.movieId
                ? "border-primary/30 bg-primary/10"
                : "border-border bg-card hover:border-primary/20"
            }`}
          >
            {item.poster ? <img src={item.poster} alt="" className="h-14 w-10 rounded-md object-cover shadow-sm" loading="lazy" /> : <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] text-muted-foreground" aria-hidden="true">No image</span>}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{item.movieTitle}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.composer}</span>
              <span className="block text-xs text-muted-foreground">{item.tracks.length} tracks</span>
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No soundtracks found.</p>}
      </div>
    </aside>
  );
});
