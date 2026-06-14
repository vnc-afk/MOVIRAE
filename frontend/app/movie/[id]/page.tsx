"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { use } from "react";
import type { Review, WatchExperience } from "@/lib/types";
import { generateOpId, attachOpToBody, attachOpToHeaders, makeTempId, reconcileTempItem } from "@/lib/optimistic";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import { TrailerModal } from "@/components/TrailerModal";
import { toast } from "sonner";

// Feature module imports
import {
  useMovieDetail,
  useMovieActions,
  useReviewsManager,
  useWatchExperience,
  useReviewDialog,
} from "./hooks";
import {
  MovieHeader,
  MovieActions,
  ReviewDialog,
  ReviewsSection,
  StreamingSection,
  CastSection,
  WatchExperienceSection,
  SimilarMoviesSection,
} from "./components";
import * as movieApi from "./lib/movieApi";
import * as reviewsApi from "./lib/reviewsApi";

type MovieDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function MovieDetailPage({ params }: MovieDetailPageProps) {
  const resolvedParams = use(params);
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { addInFlightOp, removeInFlightOp, isInFlight } = useOptimisticOps();

  // State management hooks
  const movieDetail = useMovieDetail({ movieId: resolvedParams.id });
  const movieActions = useMovieActions(resolvedParams.id);
  const reviewsManager = useReviewsManager(resolvedParams.id, session?.user?.email ?? undefined);
  const watchExperience = useWatchExperience(resolvedParams.id);
  const reviewDialog = useReviewDialog();

  const [trailerOpen, setTrailerOpen] = useState(false);

  // Initialize user movie state
  useEffect(() => {
    async function initializeState() {
      const state = await movieApi.fetchUserMovieState(resolvedParams.id);
      movieActions.setInitialState(state.watchlistIds, state.favoriteIds, state.watchedIds);
      watchExperience.setInitialValue(state.watchExperience);
    }

    if (session?.user?.email) {
      initializeState();
    }
  }, [resolvedParams.id, session?.user?.email]);

  // Handle review operations
  const handleSaveReview = async () => {
    if (!movieDetail.movie) return;

    if (!reviewDialog.rating) {
      toast.error("Choose a rating before saving your review.");
      return;
    }

    const editing = Boolean(reviewsManager.currentUserReview);
    reviewDialog.setSubmitting(true);

    if (!editing) {
      // Optimistic create
      const tempId = makeTempId("review");
      const op = { opId: generateOpId("review"), type: "create" as const, tempId, ts: Date.now() };
      const opId = `movie-review-${movieDetail.movie.id}`;

      addInFlightOp(opId, {
        opId,
        type: "post",
        surface: "movie",
        itemId: movieDetail.movie.id,
        payload: { rating: reviewDialog.rating, comment: reviewDialog.comment },
      });

      const optimisticReview: Review = {
        id: tempId,
        tempId,
        opId: op.opId,
        user: {
          id: session?.user?.email ?? tempId,
          email: session?.user?.email ?? "",
          username: session?.user?.email?.split("@")[0] ?? "user",
          displayName: session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "You",
          avatar: session?.user?.image ?? "",
          bio: "",
          followers: 0,
          following: 0,
          reviewCount: 0,
          watchlistCount: 0,
          favoriteMovies: [],
        },
        tmdbId: movieDetail.movie.id,
        rating: reviewDialog.rating,
        comment: reviewDialog.comment,
        date: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        replies: [],
      } as Review;

      reviewsManager.addOptimisticReview(optimisticReview);

      try {
        const body = attachOpToBody(
          { tmdbId: movieDetail.movie.id, rating: reviewDialog.rating, comment: reviewDialog.comment },
          op
        );
        const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

        const result = await reviewsApi.createReview(
          movieDetail.movie.id,
          reviewDialog.rating,
          reviewDialog.comment,
          headers
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        const serverReview = result.data?.value;
        if (serverReview) {
          reviewsManager.reconcileReview(tempId, serverReview);
        } else {
          await reviewsManager.refetch();
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.stats.current() });
        queryClient.invalidateQueries({ queryKey: queryKeys.wrapped.current() });

        toast.success("Review posted");
        reviewDialog.reset();
      } catch (error) {
        reviewsManager.removeReview(tempId);
        toast.error(error instanceof Error ? error.message : "Unable to save review.");
      } finally {
        removeInFlightOp(opId);
      }
      return;
    }

    // Editing existing review
    if (!reviewsManager.currentUserReview) return;

    try {
      const result = await reviewsApi.updateReview(
        reviewsManager.currentUserReview.id,
        movieDetail.movie.id,
        reviewDialog.rating,
        reviewDialog.comment
      );

      if (!result.success) {
        toast.error(result.error || "Unable to save review.");
        return;
      }

      toast.success("Review updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.current() });
      queryClient.invalidateQueries({ queryKey: queryKeys.wrapped.current() });
      await reviewsManager.refetch();
      reviewDialog.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save review.");
    } finally {
      reviewDialog.setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Delete this review?")) return;

    const result = await reviewsApi.deleteReview(reviewId);

    if (!result.success) {
      toast.error(result.error || "Unable to delete review.");
      return;
    }

    toast.success("Review deleted");
    await reviewsManager.refetch();
  };

  const handleSaveWatchExperience = async (experience: WatchExperience) => {
    if (!movieDetail.movie) return;

    if (!session?.user?.email) {
      toast.error("Sign in to log how you watched this movie.");
      return;
    }

    const result = await watchExperience.saveWatchExperience(experience);

    if (result) {
      movieActions.setInitialState(
        movieActions.isWatchlist ? [movieDetail.movie.id] : [],
        movieActions.isLiked ? [movieDetail.movie.id] : [],
        [movieDetail.movie.id]
      );
      toast.success("Watch experience saved");
    } else {
      toast.error(watchExperience.error || "Unable to save watch experience.");
    }
  };

  // Loading and error states
  if (movieDetail.isLoading) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Loading movie details...</p>
      </div>
    );
  }

  if (!movieDetail.movie) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Movie not found.</p>
        <Link href="/" className="text-primary underline mt-4 inline-block">
          Go home
        </Link>
      </div>
    );
  }

  const movie = movieDetail.movie;

  return (
    <div className="pb-20 md:pb-0">
      {/* Header with backdrop */}
      <div className="relative h-[80px] md:h-[180px] overflow-hidden">
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

      {/* Main content */}
      <div className="container -mt-20 md:-mt-28 relative z-10">
        {/* Hero section with poster and info */}
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
            <MovieHeader movie={movie} poster={movie.poster} />

            <MovieActions
              movieId={movie.id}
              isWatched={movieActions.isWatched}
              isWatchlist={movieActions.isWatchlist}
              isLiked={movieActions.isLiked}
              initializing={movieActions.initializing}
              loading={movieActions.loading}
              isAuthenticated={Boolean(session?.user?.email)}
              hasCurrentReview={Boolean(reviewsManager.currentUserReview)}
              onToggleWatched={movieActions.toggleWatched}
              onToggleWatchlist={movieActions.toggleWatchlist}
              onToggleLiked={movieActions.toggleLiked}
              onPlayTrailer={() => setTrailerOpen(true)}
              onReview={() => reviewDialog.open(reviewsManager.currentUserReview)}
            />

            <StreamingSection
              platforms={movieDetail.streamingOn}
              isLoading={movieDetail.streamingLoading}
            />
          </motion.div>
        </div>

        {/* Cast section */}
        <CastSection cast={movie.cast ?? []} />

        {/* Reviews section */}
        <ReviewsSection
          reviews={reviewsManager.reviews}
          isLoading={reviewsManager.isLoading}
          isAuthenticated={Boolean(session?.user?.email)}
          isWatched={movieActions.isWatched}
          hasCurrentReview={Boolean(reviewsManager.currentUserReview)}
          onEdit={(review) => reviewDialog.open(review)}
          onDelete={handleDeleteReview}
          onRefresh={reviewsManager.refetch}
        />

        {/* Watch experience section */}
        <WatchExperienceSection
          movieTitle={movie.title}
          initialValue={watchExperience.watchExperience}
          isDisabled={!session?.user?.email}
          onSave={handleSaveWatchExperience}
        />

        {/* Similar movies section */}
        <SimilarMoviesSection movies={movieDetail.similar} />
      </div>

      {/* Modals */}
      <TrailerModal open={trailerOpen} onOpenChange={setTrailerOpen} title={movie.title} />

      <ReviewDialog
        isOpen={reviewDialog.isOpen}
        movieTitle={movie.title}
        rating={reviewDialog.rating}
        comment={reviewDialog.comment}
        isSubmitting={reviewDialog.isSubmitting}
        isEditing={Boolean(reviewsManager.currentUserReview)}
        onRatingChange={reviewDialog.setRating}
        onCommentChange={reviewDialog.setComment}
        onSubmit={handleSaveReview}
        onClose={reviewDialog.close}
        isInFlight={isInFlight(`movie-review-${movie.id}`)}
      />
    </div>
  );
}
