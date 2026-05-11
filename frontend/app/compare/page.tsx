"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { getMovieDetails } from "@/lib/tmdb";
import type { Movie, UserProfile } from "@/lib/types";

export default function CompareWatchlists() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [currentUserMovies, setCurrentUserMovies] = useState<Movie[]>([]);
  const [selectedUserMovies, setSelectedUserMovies] = useState<Movie[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((response) => response.json()),
      fetch("/api/data/user-watchlist-current").then((response) => response.json()),
    ])
      .then(async ([usersResponse, watchlistResponse]) => {
        const userList = Array.isArray(usersResponse.value) ? usersResponse.value : [];
        setUsers(userList);
        setSelectedUser(userList[1] ?? userList[0] ?? null);

        const currentIds = Array.isArray(watchlistResponse.value) ? watchlistResponse.value : [];
        const currentMovies = await Promise.all(currentIds.map((movieId: string) => getMovieDetails(movieId)));
        setCurrentUserMovies(currentMovies.filter((movie): movie is Movie => movie !== null));
      })
      .catch((error) => console.error("Failed to load comparison data:", error));
  }, []);

  useEffect(() => {
    if (!selectedUser) {
      setSelectedUserMovies([]);
      return;
    }

    fetch(`/api/data/user-watchlist-${selectedUser.id}`)
      .then((response) => response.json())
      .then(async (data) => {
        const ids = Array.isArray(data.value) ? data.value : [];
        const movies = await Promise.all(ids.map((movieId: string) => getMovieDetails(movieId)));
        setSelectedUserMovies(movies.filter((movie): movie is Movie => movie !== null));
      })
      .catch((error) => console.error("Failed to load selected watchlist:", error));
  }, [selectedUser]);

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
              onChange={(e) => setSelectedUser(users.find((user) => user.id === e.target.value) || null)}
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
