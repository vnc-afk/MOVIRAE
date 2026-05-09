"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Heart, ListPlus, Play } from "lucide-react";
import { use, useState } from "react";
import { movies, getSimilarMovies } from "@/data/mockData";
import { StarRating } from "@/components/StarRating";
import { CastCarousel } from "@/components/CastCarousel";
import { ReviewCard } from "@/components/ReviewCard";
import { TrailerModal } from "@/components/TrailerModal";
import { StreamingBadges } from "@/components/StreamingBadges";
import { SimilarMovies } from "@/components/SimilarMovies";
import { Button } from "@/components/ui/button";

type MovieDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function MovieDetailPage({ params }: MovieDetailPageProps) {
  const resolvedParams = use(params);
  const movie = movies.find((m) => m.id === resolvedParams.id);
  const [trailerOpen, setTrailerOpen] = useState(false);

  if (!movie) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Movie not found.</p>
        <Link href="/" className="text-primary underline mt-4 inline-block">
          Go home
        </Link>
      </div>
    );
  }

  const similar = getSimilarMovies(movie.id);

  return (
    <div className="pb-20 md:pb-0">
      <div className="relative h-[300px] md:h-[400px] overflow-hidden">
        <img
          src={movie.poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="relative container h-full flex items-end pb-6">
          <Link
            href="/"
            className="absolute top-4 left-4 md:left-0 h-9 w-9 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="container -mt-24 md:-mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex-shrink-0 mx-auto md:mx-0"
          >
            <img
              src={movie.poster}
              alt={movie.title}
              width={260}
              height={390}
              className="w-[180px] md:w-[260px] rounded-xl poster-shadow"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 pt-2"
          >
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span>{movie.year}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span>{movie.genre}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span>Dir. {movie.director}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span>{movie.runtime} min</span>
            </div>

            <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground">
              {movie.title}
            </h1>

            <div className="flex items-center gap-3 mt-3">
              <StarRating rating={movie.rating} size="lg" />
              <span className="text-lg font-semibold text-foreground">
                {movie.rating.toFixed(1)}
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xl">
              {movie.synopsis}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-4">
              {movie.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              <Button onClick={() => setTrailerOpen(true)} className="gap-2">
                <Play className="h-4 w-4" /> Watch Trailer
              </Button>
              <Button variant="secondary" className="gap-2">
                <Eye className="h-4 w-4" /> Watched
              </Button>
              <Button variant="secondary" className="gap-2">
                <ListPlus className="h-4 w-4" /> Watchlist
              </Button>
              <Button variant="secondary" className="gap-2">
                <Heart className="h-4 w-4" /> Like
              </Button>
            </div>

            <div className="mt-6">
              <StreamingBadges platforms={movie.streamingOn} />
            </div>
          </motion.div>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Cast</h2>
          <CastCarousel cast={movie.cast} />
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Reviews</h2>
          <div className="space-y-4 max-w-2xl">
            {movie.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </section>

        <SimilarMovies movies={similar} />
      </div>

      <TrailerModal open={trailerOpen} onOpenChange={setTrailerOpen} title={movie.title} />
    </div>
  );
}
