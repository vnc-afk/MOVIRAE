"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, List, MessageCircle, BarChart3, ArrowLeftRight, FileText } from "lucide-react";
import { users, movies } from "@/data/mockData";
import { MovieCard } from "@/components/MovieCard";
import { StarRating } from "@/components/StarRating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProfilePage() {
  const user = users[0];
  const favoriteMovies = movies.filter((m) => user.favoriteMovies.includes(m.id));

  return (
    <div className="pb-20 md:pb-0">
      <div className="cinema-gradient py-12">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row items-center md:items-start gap-6"
          >
            <img
              src={user.avatar}
              alt={user.displayName}
              className="h-24 w-24 rounded-full border-4 border-primary bg-muted"
            />
            <div className="text-center md:text-left">
              <h1 className="font-display text-2xl font-bold text-primary-foreground">
                {user.displayName}
              </h1>
              <p className="text-sm text-primary-foreground/60">@{user.username}</p>
              <p className="mt-2 text-sm text-primary-foreground/80 max-w-md">
                {user.bio}
              </p>
              <div className="flex items-center gap-6 mt-4 justify-center md:justify-start">
                {[
                  { label: "Followers", value: user.followers },
                  { label: "Following", value: user.following },
                  { label: "Reviews", value: user.reviewCount },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <span className="text-lg font-bold text-primary-foreground">
                      {value.toLocaleString()}
                    </span>
                    <p className="text-xs text-primary-foreground/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:ml-auto flex flex-col gap-2">
              <button className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                Edit Profile
              </button>
              <div className="flex gap-2 justify-center">
                <Link
                  href="/stats"
                  className="flex items-center gap-1 text-xs text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                >
                  <BarChart3 className="h-3 w-3" /> Stats
                </Link>
                <Link
                  href="/compare"
                  className="flex items-center gap-1 text-xs text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                >
                  <ArrowLeftRight className="h-3 w-3" /> Compare
                </Link>
                <Link
                  href="/import-export"
                  className="flex items-center gap-1 text-xs text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                >
                  <FileText className="h-3 w-3" /> Import
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mt-8">
        <Tabs defaultValue="favorites" className="w-full">
          <TabsList className="mb-6 bg-secondary">
            <TabsTrigger value="favorites" className="gap-1.5">
              <Heart className="h-3.5 w-3.5" /> Favorites
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-1.5">
              <List className="h-3.5 w-3.5" /> Watchlist
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Reviews
            </TabsTrigger>
          </TabsList>

          <TabsContent value="favorites">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {favoriteMovies.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} index={i} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="watchlist">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {movies.slice(0, 4).map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} index={i} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reviews">
            <div className="space-y-4 max-w-2xl">
              {movies.slice(0, 3).map((movie) => (
                <div key={movie.id} className="rounded-lg bg-card p-5 card-shadow flex gap-4">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="h-20 w-14 rounded object-cover poster-shadow flex-shrink-0"
                  />
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{movie.title}</h3>
                    <StarRating rating={movie.rating} size="sm" />
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                      {movie.reviews[0]?.comment}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
