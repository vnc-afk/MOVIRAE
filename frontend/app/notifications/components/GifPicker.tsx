"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

type Gif = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

export type GifSelection = {
  gifId: string;
  gifUrl: string;
  previewUrl: string;
  title: string;
  width: number;
  height: number;
};

interface GifPickerProps {
  onSelect: (gif: GifSelection) => Promise<void>;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setGifs([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/gifs/search?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "GIF search failed");
        setGifs(Array.isArray(data?.value) ? data.value : []);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setGifs([]);
          setError((searchError as Error).message || "GIF search failed");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const handleSelect = async (gif: Gif) => {
    setIsSending(true);
    try {
      await onSelect({
        gifId: gif.id,
        gifUrl: gif.url,
        previewUrl: gif.previewUrl,
        title: gif.title,
        width: gif.width,
        height: gif.height,
      });
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-lg" role="dialog" aria-label="GIF picker">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search GIFs"
            aria-label="Search GIFs"
            className="w-full rounded-lg border border-border bg-secondary py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <button type="button" onClick={onClose} aria-label="Close GIF picker" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-24">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : error ? (
          <p className="px-2 py-6 text-center text-xs text-destructive">{error}</p>
        ) : query.trim().length < 2 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Search for a movie, mood, or reaction.</p>
        ) : gifs.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No GIFs found.</p>
        ) : (
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {gifs.map((gif) => (
              <button key={gif.id} type="button" disabled={isSending} onClick={() => void handleSelect(gif)} className="group aspect-square overflow-hidden rounded-lg bg-secondary disabled:opacity-60">
                <img src={gif.previewUrl} alt={gif.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" onError={(event) => { event.currentTarget.style.display = "none"; }} />
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-right text-[10px] text-muted-foreground">Powered by GIPHY</p>
    </div>
  );
}
