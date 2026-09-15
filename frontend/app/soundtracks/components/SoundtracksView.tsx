"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Disc3, Loader2, Music } from "lucide-react";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import { attachOpToHeaders, generateOpId } from "@/lib/optimistic";
import { useSoundtracks } from "../hooks";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { filterSoundtracks } from "../lib/pagination";
import { SoundtrackHero } from "./SoundtrackHero";
import { SoundtrackSidebar } from "./SoundtrackSidebar";
import { TrackList } from "./TrackList";
import { NowPlayingBar } from "./NowPlayingBar";

export function SoundtracksView() {
  const soundtrack = useSoundtracks();
  const visibleItems = filterSoundtracks(soundtrack.items, soundtrack.query.search);
  const selected = soundtrack.selected;
  const [isFavorite, setIsFavorite] = useState(false);
  const [view, setView] = useState<"all" | "saved">("all");
  const [savedItems, setSavedItems] = useState<typeof soundtrack.items>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [isFavoritePending, setIsFavoritePending] = useState(false);
  const favoriteActionRef = useRef<string | null>(null);
  const { addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const displayedItems = view === "saved" ? filterSoundtracks(savedItems, soundtrack.query.search) : visibleItems;
  const displayedSelected = view === "saved"
    ? displayedItems.find((item) => item.movieId === soundtrack.query.selectedId) ?? displayedItems[0] ?? null
    : displayedItems.find((item) => item.movieId === selected?.movieId) ?? displayedItems[0] ?? null;
  const player = useAudioPlayer(displayedSelected?.movieId ?? null, displayedSelected?.tracks ?? []);
  const activeSoundtrack = useMemo(
    () => player.trackId
      ? [...soundtrack.items, ...savedItems].find((item) => item.tracks.some((track) => track.id === player.trackId)) ?? displayedSelected
      : displayedSelected,
    [displayedSelected, player.trackId, savedItems, soundtrack.items]
  );

  const select = useCallback((id: number) => {
    soundtrack.select(id);
  }, [soundtrack.select]);

  useEffect(() => {
    if (!displayedSelected) return;
    setIsFavorite(false);
    void fetch(`/api/soundtracks/${displayedSelected.movieId}/favorite`)
      .then((response) => response.json())
      .then((payload: { value?: boolean }) => setIsFavorite(Boolean(payload.value)))
      .catch(() => setIsFavorite(false));
    void fetch("/api/soundtracks/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbMovieId: String(displayedSelected.movieId), action: "open" }),
    });
  }, [displayedSelected]);

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const response = await fetch("/api/soundtracks/favorites", { cache: "no-store" });
      const payload = await response.json() as { value?: typeof soundtrack.items };
      setSavedItems(Array.isArray(payload.value) ? payload.value : []);
    } finally {
      setSavedLoading(false);
    }
  }, [soundtrack.items]);

  useEffect(() => {
    if (view === "saved") void loadSaved();
  }, [loadSaved, view]);

  const toggleFavorite = useCallback(async () => {
    if (!displayedSelected) return;
    if (favoriteActionRef.current) return;
    const next = !isFavorite;
    const opId = generateOpId("soundtrack-favorite");
    favoriteActionRef.current = opId;
    setIsFavoritePending(true);
    setIsFavorite(next);
    addInFlightOp(opId, { type: next ? "create" : "delete", itemId: String(displayedSelected.movieId), surface: "soundtrack", payload: { feature: "soundtrack-favorite" } });
    try {
      const response = await fetch(`/api/soundtracks/${displayedSelected.movieId}/favorite`, {
        method: next ? "POST" : "DELETE",
        headers: attachOpToHeaders(undefined, { opId, type: next ? "create" : "delete", ts: Date.now() }),
      });
      if (!response.ok) throw new Error("Could not update soundtrack favorite.");
      if (view === "saved") await loadSaved();
    } catch {
      setIsFavorite(!next);
    } finally {
      removeInFlightOp(opId);
      favoriteActionRef.current = null;
      setIsFavoritePending(false);
    }
  }, [addInFlightOp, displayedSelected, isFavorite, loadSaved, removeInFlightOp, view]);

  return (
    <div className="pb-20 md:pb-0">
      <div className="container space-y-8 py-8">
        <header>
          <div className="mb-1 flex items-center gap-2"><Music className="h-5 w-5 text-primary" aria-hidden="true" /><h1 className="font-display text-2xl font-bold text-foreground">Soundtracks</h1></div>
          <p className="text-sm text-muted-foreground">Explore and listen to movie soundtracks.</p>
        </header>
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <SoundtrackSidebar items={displayedItems} selectedId={displayedSelected?.movieId ?? null} search={soundtrack.query.search} onSearchChange={soundtrack.setSearch} onSelect={select} view={view} onViewChange={setView} />
          <main className="space-y-6">
            {(soundtrack.isLoading || savedLoading) && !displayedSelected && <div className="flex min-h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading soundtracks</div>}
            {soundtrack.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Unable to load soundtracks. Please try again.</p>}
            {displayedSelected && <><SoundtrackHero soundtrack={displayedSelected} isFavorite={isFavorite} isFavoritePending={isFavoritePending} onToggleFavorite={() => void toggleFavorite()} /><TrackList tracks={displayedSelected.tracks} isLoading={displayedSelected.tracksPending} onPlay={(trackId) => void player.play(trackId)} />{player.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{player.error}</p>}</>}
            {view === "all" && soundtrack.page > 0 && soundtrack.hasMore && <button type="button" onClick={soundtrack.loadNext} disabled={soundtrack.isLoading} className="mx-auto flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:border-primary disabled:opacity-60">{soundtrack.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Load more</button>}
            {!soundtrack.isLoading && !savedLoading && !displayedSelected && <p className="py-16 text-center text-sm text-muted-foreground"><Disc3 className="mx-auto mb-2 h-6 w-6" />{view === "saved" ? "No saved soundtracks yet." : "Select a soundtrack to begin."}</p>}
          </main>
        </div>
      </div>
      <div ref={player.playerContainerRef} className="pointer-events-none fixed -left-[9999px] top-0 h-[200px] w-[200px] opacity-0" aria-hidden="true" />
      {activeSoundtrack && player.trackId && <NowPlayingBar soundtrack={activeSoundtrack} trackId={player.trackId} track={player.currentTrack} isPlaying={player.isPlaying} currentTime={player.currentTime} duration={player.duration} onToggle={(trackId) => void player.toggle(trackId)} onSeek={player.seek} onSkip={player.skip} onStop={player.stop} />}
    </div>
  );
}
