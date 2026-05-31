"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scheduleMovieDetailPrefetch, cancelScheduledPrefetch } from "@/lib/prefetchHelpers";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Eye, Plus, Check } from "lucide-react";
import { StarRating } from "./StarRating";
import type { Movie } from "@/lib/types";

interface MovieCardProps {
  movie: Movie;
  index?: number;
}

export function MovieCard({ movie, index = 0 }: MovieCardProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const prefetchTokenRef = useRef(`movie-card:${movie.id}:${Math.random().toString(36).slice(2)}`);
  const [loading, setLoading] = useState({ watched: false, watchlist: false });
  const posterSrc = movie.poster.trim();

  const watchlistQueryKey = ["movie-card", "watchlist-current", session?.user?.email ?? "anonymous"] as const;
  const watchedQueryKey = ["movie-card", "watched-current", session?.user?.email ?? "anonymous"] as const;

  const watchlistQuery = useQuery<string[]>({
    queryKey: watchlistQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/data/user-watchlist-current");
      const json = await response.json().catch(() => null);
      return Array.isArray(json?.value) ? json.value : [];
    },
    enabled: Boolean(session?.user?.email),
    staleTime: 5 * 60 * 1000,
  });

  const watchedQuery = useQuery<string[]>({
    queryKey: watchedQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/data/user-watched-current");
      const json = await response.json().catch(() => null);
      return Array.isArray(json?.value) ? json.value : [];
    },
    enabled: Boolean(session?.user?.email),
    staleTime: 5 * 60 * 1000,
  });

  const isWatched = watchedQuery.data?.includes(movie.id) ?? false;
  const isWatchlist = watchlistQuery.data?.includes(movie.id) ?? false;

  async function toggleAction(
    key: "user-watchlist-current" | "user-watched-current",
    currentState: boolean,
    loadingKey: "watchlist" | "watched",
    queryKey: readonly unknown[]
  ) {
    if (!session?.user?.email) {
      console.warn("Not authenticated");
      return;
    }

    setLoading((prev) => ({ ...prev, [loadingKey]: true }));
    try {
      const response = await fetch(`/api/data/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId: movie.id, active: !currentState }),
      });

      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (Array.isArray(json?.value)) {
          queryClient.setQueryData<string[]>(queryKey, json.value);
        } else {
          queryClient.setQueryData<string[]>(queryKey, (current = []) =>
            current.includes(movie.id)
              ? current.filter((item) => item !== movie.id)
              : [...current, movie.id]
          );
        }
      }
    } catch (error) {
      console.error("Failed to toggle action:", error);
    } finally {
      setLoading((prev) => ({ ...prev, [loadingKey]: false }));
    }
  }

  const handleToggleWatched = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleAction("user-watched-current", isWatched, "watched", watchedQueryKey);
  };

  const handleToggleWatchlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleAction("user-watchlist-current", isWatchlist, "watchlist", watchlistQueryKey);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link
        href={`/movie/${movie.id}`}
        className="group block"
        onMouseEnter={() => {
          scheduleMovieDetailPrefetch(queryClient, movie.id, prefetchTokenRef.current, 150);
        }}
        onMouseLeave={() => {
          cancelScheduledPrefetch(prefetchTokenRef.current);
        }}
      >
        <div className="relative overflow-hidden rounded-lg poster-shadow">
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={movie.title}
              loading="lazy"
              width={640}
              height={960}
              className="w-full aspect-[2/3] object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex aspect-[2/3] w-full items-center justify-center bg-secondary text-center text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              No Poster
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleToggleWatched}
                disabled={!session?.user?.email || loading.watched}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isWatched
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {isWatched ? <Check className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {isWatched ? "Watched" : "Watch"}
              </button>
              <button
                onClick={handleToggleWatchlist}
                disabled={!session?.user?.email || loading.watchlist}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isWatchlist
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {isWatchlist ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {isWatchlist ? "Saved" : "Watchlist"}
              </button>
            </div>
            <p className="text-sm text-primary-foreground/80 line-clamp-2">
              {movie.synopsis}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {movie.title}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{movie.year}</span>
            <StarRating rating={movie.rating} size="sm" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
