"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { users, movies } from "@/data/mockData";
import type { Movie } from "@/data/mockData";

const user1Movies = [movies[0], movies[1], movies[2], movies[4]];
const user2Movies = [movies[0], movies[2], movies[3], movies[5]];

export default function CompareWatchlists() {
  const [selectedUser, setSelectedUser] = useState(users[1]);
  const currentUser = users[0];

  const both = user1Movies.filter((m) => user2Movies.some((m2) => m2.id === m.id));
  const onlyMe = user1Movies.filter((m) => !user2Movies.some((m2) => m2.id === m.id));
  const onlyThem = user2Movies.filter((m) => !user1Movies.some((m2) => m2.id === m.id));

  const MovieRow = ({ movie, status }: { movie: Movie; status: "both" | "me" | "them" }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card card-shadow">
      <img src={movie.poster} alt={movie.title} className="h-14 w-10 rounded object-cover poster-shadow" />
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

        {/* User selector */}
        <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex flex-col items-center gap-2">
            <img src={currentUser.avatar} alt={currentUser.displayName} className="h-14 w-14 rounded-full border-2 border-primary bg-muted" />
            <span className="text-xs font-semibold text-foreground">You</span>
          </div>
          <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col items-center gap-2">
            <img src={selectedUser.avatar} alt={selectedUser.displayName} className="h-14 w-14 rounded-full border-2 border-accent bg-muted" />
            <select
              value={selectedUser.id}
              onChange={(e) => setSelectedUser(users.find((u) => u.id === e.target.value) || users[1])}
              className="text-xs rounded-lg bg-secondary border border-border px-2 py-1 text-foreground outline-none"
            >
              {users.filter((u) => u.id !== currentUser.id).map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
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

        {/* Column headers */}
        <div className="flex items-center justify-end gap-3 px-3 text-xs text-muted-foreground">
          <span className="w-6 text-center">You</span>
          <span className="w-6 text-center">Them</span>
        </div>

        {/* Lists */}
        <div className="space-y-2">
          {both.map((m) => <MovieRow key={m.id} movie={m} status="both" />)}
          {onlyMe.map((m) => <MovieRow key={m.id} movie={m} status="me" />)}
          {onlyThem.map((m) => <MovieRow key={m.id} movie={m} status="them" />)}
        </div>
      </div>
    </div>
  );
}
