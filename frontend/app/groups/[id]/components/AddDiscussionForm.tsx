"use client";

import { useCallback, useEffect, useState } from "react";
import { Film, Loader2, Search, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Movie } from "@/lib/types";

/**
 * Props for the discussion composer.
 */
interface AddDiscussionFormProps {
  onSubmit: (title: string, body: string, movieIds?: string[]) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Lets the current user create a discussion post for the group.
 */
export function AddDiscussionForm({
  onSubmit,
  isLoading = false,
}: AddDiscussionFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [movieQuery, setMovieQuery] = useState("");
  const [movieResults, setMovieResults] = useState<Movie[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const query = movieQuery.trim();
    if (!query || selectedMovies.length >= 10) {
      setMovieResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Movie search failed");
        const results = await response.json();
        setMovieResults(Array.isArray(results) ? results.slice(0, 5) : []);
      } catch {
        setMovieResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [movieQuery, selectedMovies.length]);

  const handleSubmit = useCallback(async () => {
    // Require both a title and body before sending a new discussion.
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(title, body, selectedMovies.map((movie) => movie.id));
      setTitle("");
      setBody("");
      setMovieQuery("");
      setMovieResults([]);
      setSelectedMovies([]);
      toast.success("Discussion posted!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to post discussion";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, body, onSubmit, selectedMovies]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        Start a discussion
      </h2>
      <div className="min-w-0 space-y-3">
          <Input
            placeholder="Discussion title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting || isLoading}
          />
          <Textarea
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            disabled={isSubmitting || isLoading}
          />
          <div className="space-y-2">
            {selectedMovies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedMovies.map((movie) => (
                  <div key={movie.id} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-secondary/60 p-2">
                    {movie.poster ? <img src={movie.poster} alt="" className="h-12 w-8 rounded object-cover" /> : <div className="h-12 w-8 rounded bg-muted" />}
                    <p className="max-w-32 truncate text-xs font-medium">{movie.title}</p>
                    <button
                      type="button"
                      onClick={() => setSelectedMovies((current) => current.filter((item) => item.id !== movie.id))}
                      disabled={isSubmitting || isLoading}
                      aria-label={`Remove ${movie.title}`}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {selectedMovies.length < 10 ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Attach a movie to this discussion"
                  value={movieQuery}
                  onChange={(event) => setMovieQuery(event.target.value)}
                  disabled={isSubmitting || isLoading}
                  className="pl-9"
                />
              </div>
            ) : null}
            {isSearching ? <p className="text-xs text-muted-foreground">Searching movies...</p> : null}
            {movieResults.length > 0 ? (
              <div className="space-y-1 rounded-md border border-border p-1">
                {movieResults.map((movie) => (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => {
                      setSelectedMovies((current) => current.some((item) => item.id === movie.id) ? current : [...current, movie]);
                      setMovieQuery("");
                      setMovieResults([]);
                    }}
                    className="flex w-full items-center gap-2 rounded p-1.5 text-left hover:bg-secondary"
                  >
                    {movie.poster ? <img src={movie.poster} alt="" className="h-10 w-7 rounded object-cover" /> : <Film className="h-4 w-4" />}
                    <span className="truncate text-xs font-medium">{movie.title}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!title.trim() || !body.trim() || isSubmitting || isLoading}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Post
                </>
              )}
            </Button>
          </div>
      </div>
    </div>
  );
}
