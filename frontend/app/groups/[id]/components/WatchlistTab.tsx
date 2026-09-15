"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MoviePrefetchLink } from "@/components/MoviePrefetchLink";
import type { Movie } from "@/lib/types";

/**
 * Props for the shared watchlist tab.
 */
interface WatchlistTabProps {
  movies: Movie[];
  onAddMovie: (movieId: string) => Promise<void>;
  onRemoveMovie: (movieId: string) => Promise<void>;
  canEdit?: boolean;
  isLoading?: boolean;
}

/**
 * Renders the shared watchlist with movie search and add/remove actions.
 */
export function WatchlistTab({
  movies,
  onAddMovie,
  onRemoveMovie,
  canEdit = false,
  isLoading = false,
}: WatchlistTabProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Search failed");

      const results = await response.json();
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectMovie = useCallback(
    async (movieId: string) => {
      setIsSubmitting(true);
      try {
        await onAddMovie(movieId);
        setSearchQuery("");
        setSearchResults([]);
        setOpen(false);
        toast.success("Movie added to watchlist!");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add movie";
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onAddMovie]
  );

  const handleRemove = useCallback(
    async (movieId: string) => {
      setIsSubmitting(true);
      try {
        await onRemoveMovie(movieId);
        toast.success("Movie removed from watchlist!");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to remove movie";
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onRemoveMovie]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          {movies.length} {movies.length === 1 ? "film" : "films"} shared by the club
        </p>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Movie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add movie to watchlist</DialogTitle>
                <DialogDescription>
                  Search for a movie and add it to this group's shared watchlist.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  placeholder="Search movies..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  disabled={isSubmitting || isLoading}
                />
                {isSearching && (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    Searching...
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {searchResults.map((result) => (
                      <Button
                        key={result.id}
                        variant="outline"
                        className="h-auto w-full justify-start py-2"
                        onClick={() => handleSelectMovie(result.id)}
                        disabled={isSubmitting || isLoading}
                      >
                        {result.poster ? (
                          <img
                            src={result.poster}
                            alt={result.title}
                            className="mr-3 h-10 w-7 rounded object-cover"
                          />
                        ) : null}
                        <div className="text-left">
                          <p className="text-xs font-medium">{result.title}</p>
                          {(result as any).releaseDate && (
                            <p className="text-xs text-muted-foreground">
                              {new Date((result as any).releaseDate).getFullYear()}
                            </p>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {movies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {canEdit
            ? "No movies yet. Add one to get started!"
            : "No movies in the shared watchlist yet."}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {movies.map((movie, index) => (
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative w-full max-w-[240px]"
            >
              <MoviePrefetchLink movieId={movie.id} href={`/movie/${movie.id}`}>
                {movie.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full rounded-lg object-cover aspect-[2/3] hover:brightness-75 transition-[filter]"
                  />
                ) : (
                  <div className="w-full rounded-lg bg-muted aspect-[2/3]" />
                )}
              </MoviePrefetchLink>
              {canEdit && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(movie.id)}
                  disabled={isSubmitting || isLoading}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
