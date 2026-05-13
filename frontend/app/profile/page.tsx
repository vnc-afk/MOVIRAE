"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Heart, List, MessageCircle, BarChart3, ArrowLeftRight, FileText } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { StarRating } from "@/components/StarRating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Movie, UserProfile } from "@/lib/types";
import { getMovieDetails } from "@/lib/tmdb";

interface ReviewSummary {
  movieId: string;
  rating: number;
  comment: string;
  date: string;
}

function formatReviewDate(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;

  return format(parsedDate, "PPp");
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [favoriteMovies, setFavoriteMovies] = useState<Movie[]>([]);
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>([]);
  const [reviewSummaries, setReviewSummaries] = useState<ReviewSummary[]>([]);
  const [reviewMovies, setReviewMovies] = useState<Record<string, Movie | null>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((response) => response.json()),
      fetch("/api/data/user-reviews-current").then((response) => response.json()),
      fetch("/api/data/user-watchlist-current").then((response) => response.json()),
    ])
      .then(async ([usersResponse, reviewsResponse, watchlistResponse]) => {
        const users = Array.isArray(usersResponse.value) ? usersResponse.value : [];
        const currentUser = users.find((item: UserProfile) => item.email === session?.user?.email) ?? users[0] ?? null;
        setUser(currentUser);

        const favoriteIds = currentUser?.favoriteMovies ?? [];
        const favoriteResults = await Promise.all(favoriteIds.map((movieId: string) => getMovieDetails(movieId)));
        setFavoriteMovies(favoriteResults.filter((movie): movie is Movie => movie !== null));

        const watchlistIds = Array.isArray(watchlistResponse.value) ? watchlistResponse.value : [];
        const watchlistResults = await Promise.all(watchlistIds.map((movieId: string) => getMovieDetails(movieId)));
        setWatchlistMovies(watchlistResults.filter((movie): movie is Movie => movie !== null));

        const reviewList = Array.isArray(reviewsResponse.value) ? reviewsResponse.value : [];
        setReviewSummaries(reviewList);

        const reviewedMovieResults = await Promise.all(
          reviewList.map(async (review: ReviewSummary) => [review.movieId, await getMovieDetails(review.movieId)] as const)
        );
        setReviewMovies(Object.fromEntries(reviewedMovieResults));
      })
      .catch((error) => console.error("Failed to load profile data:", error));
  }, [session?.user?.name]);

  if (!user) {
    return <div className="container py-20 text-center text-sm text-muted-foreground">Loading profile...</div>;
  }

  return (
    <div className="pb-20 md:pb-0">
      <div className="cinema-gradient py-12">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {user.avatar ? <img src={user.avatar} alt={user.displayName} className="h-24 w-24 rounded-full border-4 border-primary bg-muted" /> : <div className="h-24 w-24 rounded-full border-4 border-primary bg-muted" />}
            <div className="text-center md:text-left">
              <h1 className="font-display text-2xl font-bold text-primary-foreground">{user.displayName}</h1>
              <p className="text-sm text-primary-foreground/60">@{user.username}</p>
              <p className="mt-2 text-sm text-primary-foreground/80 max-w-md">{user.bio || ""}</p>
              <div className="flex items-center gap-6 mt-4 justify-center md:justify-start">
                {[
                  { label: "Followers", value: user.followers },
                  { label: "Following", value: user.following },
                  { label: "Reviews", value: user.reviewCount },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <span className="text-lg font-bold text-primary-foreground">{value.toLocaleString()}</span>
                    <p className="text-xs text-primary-foreground/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:ml-auto flex flex-col gap-2">
              <button className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">Edit Profile</button>
              <div className="flex gap-2 justify-center">
                <Link href="/stats" className="flex items-center gap-1 text-xs text-primary-foreground/60 hover:text-primary-foreground transition-colors"><BarChart3 className="h-3 w-3" /> Stats</Link>
                <Link href="/compare" className="flex items-center gap-1 text-xs text-primary-foreground/60 hover:text-primary-foreground transition-colors"><ArrowLeftRight className="h-3 w-3" /> Compare</Link>
                <Link href="/import" className="flex items-center gap-1 text-xs text-primary-foreground/60 hover:text-primary-foreground transition-colors"><FileText className="h-3 w-3" /> Import</Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mt-8">
        <Tabs defaultValue="favorites" className="w-full">
          <TabsList className="mb-6 bg-secondary">
            <TabsTrigger value="favorites" className="gap-1.5"><Heart className="h-3.5 w-3.5" /> Favorites</TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-1.5"><List className="h-3.5 w-3.5" /> Watchlist</TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="favorites">
            {favoriteMovies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No favorites yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {favoriteMovies.map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="watchlist">
            {watchlistMovies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No watchlist items yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {watchlistMovies.map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews">
            {reviewSummaries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No reviews yet.</div>
            ) : (
              <div className="space-y-4 max-w-2xl">
                {reviewSummaries.map((review) => {
                  const movie = reviewMovies[review.movieId] ?? null;
                  const movieHref = movie ? `/movie/${movie.id}` : `/movie/${review.movieId}`;
                  return (
                    <Link
                      key={review.movieId}
                      href={movieHref}
                      className="rounded-lg bg-card p-5 card-shadow flex gap-4 transition-transform transition-colors hover:-translate-y-0.5 hover:bg-card/90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {movie?.poster ? <img src={movie.poster} alt={movie.title} className="h-20 w-14 rounded object-cover poster-shadow flex-shrink-0" /> : <div className="h-20 w-14 rounded bg-secondary" />}
                      <div>
                        <h3 className="font-semibold text-sm text-foreground">{movie?.title || review.movieId}</h3>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatReviewDate(review.date)}</p>
                        <StarRating rating={review.rating} size="sm" />
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{review.comment}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
