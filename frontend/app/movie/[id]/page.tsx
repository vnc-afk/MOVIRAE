"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Heart, ListPlus, Play } from "lucide-react";
import { use } from "react";
import { getMovieDetails, getSimilarMovies } from "@/lib/tmdb";
import { getStreamingPlatforms } from "@/lib/watchmode";
import type { Movie } from "@/lib/types";
import { StarRating } from "@/components/StarRating";
import { CastCarousel } from "@/components/CastCarousel";
import { ReviewCard } from "@/components/ReviewCard";
import { TrailerModal } from "@/components/TrailerModal";
import { StreamingBadges } from "@/components/StreamingBadges";
import { SimilarMovies } from "@/components/SimilarMovies";
import { HowYouWatched } from "@/components/HowYouWatched";
import { Button } from "@/components/ui/button";

type MovieDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function MovieDetailPage({ params }: MovieDetailPageProps) {
  const resolvedParams = use(params);
  const { data: session } = useSession();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [streamingOn, setStreamingOn] = useState<string[]>([]);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isWatched, setIsWatched] = useState(false);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [buttonLoading, setButtonLoading] = useState({ watched: false, watchlist: false, liked: false });

  useEffect(() => {
    async function fetchMovieData() {
      try {
        const movieData = await getMovieDetails(resolvedParams.id);
        if (movieData) {
          setMovie(movieData);

          // Fetch similar movies
          const similarMovies = await getSimilarMovies(resolvedParams.id);
          setSimilar(similarMovies.slice(0, 6));

          // Fetch streaming platforms
          const platforms = await getStreamingPlatforms(resolvedParams.id);
          setStreamingOn(platforms);

          // Update movie with streaming info
          movieData.streamingOn = platforms;
        }
      } catch (error) {
        console.error("Failed to fetch movie data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMovieData();
  }, [resolvedParams.id]);

  useEffect(() => {
    if (!movie) {
      return;
    }

    const movieId = movie.id;

    async function fetchUserMovieState() {
      try {
        const responses = await Promise.all([
          fetch("/api/data/user-watchlist-current"),
          fetch("/api/data/user-favorites-current"),
          fetch("/api/data/user-watched-current"),
        ]);

        const data = await Promise.all(responses.map(async (response) => {
          if (!response.ok) {
            return [] as string[];
          }
          const json = await response.json().catch(() => null);
          return Array.isArray(json?.value) ? json.value : [];
        }));

        const [watchlistIds, favoriteIds, watchedIds] = data;
        setIsWatchlist(watchlistIds.includes(movieId));
        setIsLiked(favoriteIds.includes(movieId));
        setIsWatched(watchedIds.includes(movieId));
      } catch (error) {
        console.error("Failed to load movie action state:", error);
      }
    }

    fetchUserMovieState();
  }, [movie?.id, session?.user?.email]);

  async function updateMovieAction(key: string, active: boolean) {
    const response = await fetch(`/api/data/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: movie?.id, active }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      console.error("Movie action failed:", json?.error || response.statusText);
      return null;
    }

    const json = await response.json().catch(() => null);
    return Array.isArray(json?.value) ? json.value : null;
  }

  const handleToggleWatchlist = async () => {
    if (!movie) return;
    setButtonLoading((prev) => ({ ...prev, watchlist: true }));
    const value = await updateMovieAction("user-watchlist-current", !isWatchlist);
    setButtonLoading((prev) => ({ ...prev, watchlist: false }));
    if (Array.isArray(value)) {
      setIsWatchlist(value.includes(movie.id));
    }
  };

  const handleToggleLiked = async () => {
    if (!movie) return;
    setButtonLoading((prev) => ({ ...prev, liked: true }));
    const value = await updateMovieAction("user-favorites-current", !isLiked);
    setButtonLoading((prev) => ({ ...prev, liked: false }));
    if (Array.isArray(value)) {
      setIsLiked(value.includes(movie.id));
    }
  };

  const handleToggleWatched = async () => {
    if (!movie) return;
    setButtonLoading((prev) => ({ ...prev, watched: true }));
    const value = await updateMovieAction("user-watched-current", !isWatched);
    setButtonLoading((prev) => ({ ...prev, watched: false }));
    if (Array.isArray(value)) {
      setIsWatched(value.includes(movie.id));
    }
  };

  if (loading) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Loading movie details...</p>
      </div>
    );
  }

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
              <Button
                variant="secondary"
                className={`gap-2 ${isWatched ? "bg-primary text-primary-foreground" : ""}`}
                onClick={handleToggleWatched}
                disabled={!session?.user?.email || buttonLoading.watched}
              >
                <Eye className="h-4 w-4" /> {isWatched ? "Watched" : "Mark Watched"}
              </Button>
              <Button
                variant="secondary"
                className={`gap-2 ${isWatchlist ? "bg-primary text-primary-foreground" : ""}`}
                onClick={handleToggleWatchlist}
                disabled={!session?.user?.email || buttonLoading.watchlist}
              >
                <ListPlus className="h-4 w-4" /> {isWatchlist ? "In Watchlist" : "Watchlist"}
              </Button>
              <Button
                variant="secondary"
                className={`gap-2 ${isLiked ? "bg-primary text-primary-foreground" : ""}`}
                onClick={handleToggleLiked}
                disabled={!session?.user?.email || buttonLoading.liked}
              >
                <Heart className="h-4 w-4" /> {isLiked ? "Liked" : "Like"}
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

        <section className="mt-10 max-w-md">
          <HowYouWatched movieTitle={movie.title} />
        </section>


        <SimilarMovies movies={similar} />
      </div>

      <TrailerModal open={trailerOpen} onOpenChange={setTrailerOpen} title={movie.title} />
    </div>
  );
}
