"use client";

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Clock, Star } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { getRecommendations, movies } from "@/data/mockData";

export default function RecommendationsPage() {
  const recommended = getRecommendations();
  const recentlyPopular = [...movies].sort(() => Math.random() - 0.5);
  const becauseYouWatched = movies.slice(0, 3);

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              For You
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Personalized picks based on your watch history & ratings.
          </p>
        </motion.div>

        {/* Top picks */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Star className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Top Picks for You
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recommended.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
          </div>
        </section>

        {/* Because you watched */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Because You Watched "Midnight Rain"
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {becauseYouWatched.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
          </div>
        </section>

        {/* Trending */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Trending Among Friends
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentlyPopular.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
