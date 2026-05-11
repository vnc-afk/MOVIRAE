"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [isWatched, setIsWatched] = useState(false);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const [loading, setLoading] = useState({ watched: false, watchlist: false });

  useEffect(() => {
    if (!session?.user?.email) return;

    async function loadMovieState() {
      try {
        const responses = await Promise.all([
          fetch("/api/data/user-watchlist-current"),
          fetch("/api/data/user-watched-current"),
        ]);

        const data = await Promise.all(responses.map(async (response) => {
          if (!response.ok) return [] as string[];
          const json = await response.json().catch(() => null);
          return Array.isArray(json?.value) ? json.value : [];
        }));

        const [watchlistIds, watchedIds] = data;
        setIsWatchlist(watchlistIds.includes(movie.id));
        setIsWatched(watchedIds.includes(movie.id));
      } catch (error) {
        console.error("Failed to load movie state:", error);
      }
    }

    loadMovieState();
  }, [movie.id, session?.user?.email]);

  async function toggleAction(key: "user-watchlist-current" | "user-watched-current", currentState: boolean, setter: (val: boolean) => void, loadingKey: "watchlist" | "watched") {
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
          setter(json.value.includes(movie.id));
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
    await toggleAction("user-watched-current", isWatched, setIsWatched, "watched");
  };

  const handleToggleWatchlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleAction("user-watchlist-current", isWatchlist, setIsWatchlist, "watchlist");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link href={`/movie/${movie.id}`} className="group block">
        <div className="relative overflow-hidden rounded-lg poster-shadow">
          <img
            src={movie.poster}
            alt={movie.title}
            loading="lazy"
            width={640}
            height={960}
            className="w-full aspect-[2/3] object-cover transition-transform duration-500 group-hover:scale-105"
          />
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
