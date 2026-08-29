"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { getMovieDetailsBatch } from "@/lib/tmdb";
import type { Movie, UserProfile } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";

export default function CompareWatchlists() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const usersQuery = usePrefetchAwareQuery<UserProfile[]>({
    queryKey: queryKeys.compare.users(),
    queryFn: async () => {
      const response = await fetch("/api/users");
      const data = await response.json();
      return Array.isArray(data.value) ? data.value : [];
    },
    enabled: true,
  });

  const users = usersQuery.data ?? [];

  const selectedUser = selectedUserId ? users.find((user) => user.id === selectedUserId) ?? null : null;

  useEffect(() => {
    const requestedUserId = searchParams.get("user") ?? null;

    if (requestedUserId) {
      if (selectedUserId !== requestedUserId) {
        setSelectedUserId(requestedUserId);
      }
      return;
    }

    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[1]?.id ?? users[0]?.id ?? null);
    }
  }, [searchParams, selectedUserId, users]);

  const setSelectedUserAndUrl = (userId: string | null) => {
    setSelectedUserId(userId);

    if (userId) {
      router.push(`${pathname}?user=${encodeURIComponent(userId)}`);
      return;
    }

    router.push(pathname);
  };

  const currentWatchlistQuery = usePrefetchAwareQuery<Movie[]>({
    queryKey: queryKeys.compare.watchlist("current"),
    queryFn: async () => {
      const response = await fetch("/api/watchlist");
      const data = await response.json();
      const ids = Array.isArray(data.value) ? data.value : [];
      return getMovieDetailsBatch(ids);
    },
    enabled: true,
  });

  const selectedWatchlistQuery = usePrefetchAwareQuery<Movie[]>({
    queryKey: queryKeys.compare.watchlist(selectedUser?.id ?? ""),
    queryFn: async () => {
      if (!selectedUser?.id) return [];
      const response = await fetch(`/api/watchlist?userId=${selectedUser.id}`);
      const data = await response.json();
      const ids = Array.isArray(data.value) ? data.value : [];
      return getMovieDetailsBatch(ids);
    },
    enabled: Boolean(selectedUser?.id),
  });

  const currentUserMovies = currentWatchlistQuery.data ?? [];
  const selectedUserMovies = selectedWatchlistQuery.data ?? [];

  const both = currentUserMovies.filter((movie) => selectedUserMovies.some((other) => other.id === movie.id));
  const onlyMe = currentUserMovies.filter((movie) => !selectedUserMovies.some((other) => other.id === movie.id));
  const onlyThem = selectedUserMovies.filter((movie) => !currentUserMovies.some((other) => other.id === movie.id));

  const MovieRow = ({ movie, status }: { movie: Movie; status: "both" | "me" | "them" }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card card-shadow">
      {movie.poster ? (
        <img src={movie.poster} alt={movie.title} className="h-14 w-10 rounded object-cover poster-shadow" />
      ) : (
        <div className="h-14 w-10 rounded bg-secondary" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{movie.title}</p>
        <p className="text-xs text-muted-foreground">{movie.year} · {movie.genre}</p>
      </div>
      <div className="flex gap-3">
        <div className={`h-6 w-6 rounded-full flex items-center justify-center ${status === "both" || status === "me" ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"}`}>
          {status === "both" || status === "me" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </div>
        <div className={`h-6 w-6 rounded-full flex items-center justify-center ${status === "both" || status === "them" ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"}`}>
          {status === "both" || status === "them" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 max-w-2xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">Compare Watchlists</h1>
          </div>
          <p className="text-sm text-muted-foreground">See what you and your friends have in common.</p>
        </motion.div>

        <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full border-2 border-primary bg-muted" />
            <span className="text-xs font-semibold text-foreground">You</span>
          </div>
          <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full border-2 border-accent bg-muted" />
            <select
              value={selectedUser?.id || ""}
              onChange={(e) => setSelectedUserAndUrl(e.target.value || null)}
              className="text-xs rounded-lg bg-secondary border border-border px-2 py-1 text-foreground outline-none"
            >
              {users.filter((user) => !users[0] || user.id !== users[0].id).map((user) => (
                <option key={user.id} value={user.id}>{user.displayName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-card p-4 card-shadow">
            <p className="text-xl font-bold text-accent">{both.length}</p>
            <p className="text-xs text-muted-foreground">Both watched</p>
          </div>
          <div className="rounded-lg bg-card p-4 card-shadow">
            <p className="text-xl font-bold text-primary">{onlyMe.length}</p>
            <p className="text-xs text-muted-foreground">Only you</p>
          </div>
          <div className="rounded-lg bg-card p-4 card-shadow">
            <p className="text-xl font-bold text-foreground">{onlyThem.length}</p>
            <p className="text-xs text-muted-foreground">Only them</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-3 text-xs text-muted-foreground">
          <span className="w-6 text-center">You</span>
          <span className="w-6 text-center">Them</span>
        </div>

        <div className="space-y-2">
          {both.map((movie) => <MovieRow key={movie.id} movie={movie} status="both" />)}
          {onlyMe.map((movie) => <MovieRow key={movie.id} movie={movie} status="me" />)}
          {onlyThem.map((movie) => <MovieRow key={movie.id} movie={movie} status="them" />)}
        </div>
      </div>
    </div>
  );
}
