"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Heart, ListPlus, Play, Star, Loader2 } from "lucide-react";
import { use } from "react";
import { getMovieDetails, getSimilarMovies } from "@/lib/tmdb";
import { getStreamingPlatforms } from "@/lib/watchmode";
import type { Movie, Review } from "@/lib/types";
import { StarRating } from "@/components/StarRating";
import { generateOpId, attachOpToBody, attachOpToHeaders, makeTempId, reconcileTempItem } from "@/lib/optimistic";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { CastCarousel } from "@/components/CastCarousel";
import { ReviewCard } from "@/components/ReviewCard";
import { TrailerModal } from "@/components/TrailerModal";
import { StreamingBadges } from "@/components/StreamingBadges";
import { SimilarMovies } from "@/components/SimilarMovies";
import { HowYouWatched } from "@/components/HowYouWatched";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { WatchExperience } from "@/lib/types";

type MovieDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function MovieDetailPage({ params }: MovieDetailPageProps) {
  const resolvedParams = use(params);
  const { data: session } = useSession();
  const { addInFlightOp, removeInFlightOp, isInFlight } = useOptimisticOps();
  const queryClient = useQueryClient();
  const [streamingOn, setStreamingOn] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [watchExperience, setWatchExperience] = useState<WatchExperience | null>(null);
  const [buttonLoading, setButtonLoading] = useState({ watched: false, watchlist: false, liked: false });

  const movieQuery = usePrefetchAwareQuery<Movie | null>({
    queryKey: queryKeys.movie.detail(resolvedParams.id),
    queryFn: () => getMovieDetails(resolvedParams.id),
    enabled: Boolean(resolvedParams.id),
  });

  const similarQuery = usePrefetchAwareQuery<Movie[]>({
    queryKey: queryKeys.movie.recommendations(resolvedParams.id),
    queryFn: () => getSimilarMovies(resolvedParams.id),
    enabled: Boolean(resolvedParams.id),
  });

  const movie = movieQuery.data ?? null;
  const similar = similarQuery.data?.slice(0, 6) ?? [];
  const loading = movieQuery.isPending;
  const movieWithStreaming = movie ? { ...movie, streamingOn } : null;

  useEffect(() => {
    async function fetchReviews(movieId: string) {
      try {
        const response = await fetch(`/api/reviews/movie/${movieId}`);
        const json = await response.json().catch(() => null);
        if (response.ok && Array.isArray(json?.value)) {
          setReviews(json.value);
        } else {
          setReviews([]);
        }
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
        setReviews([]);
      }
    }

    if (!movie) {
      return;
    }

    let cancelled = false;

    async function fetchMovieExtras(movieId: string) {
      try {
        const platforms = await getStreamingPlatforms(movieId);
        if (!cancelled) {
          setStreamingOn(platforms);
        }

        await fetchReviews(movieId);
      } catch (error) {
        console.error("Failed to fetch movie extras:", error);
      }
    }

    fetchMovieExtras(movie.id);

    return () => {
      cancelled = true;
    };
  }, [movie]);

  useEffect(() => {
    if (!movie) {
      return;
    }

    const movieId = movie.id;

    let eventSource: EventSource | null = null;

    async function fetchUserMovieState() {
      try {
        const responses = await Promise.all([
          fetch("/api/data/user-watchlist-current"),
          fetch("/api/data/user-favorites-current"),
          fetch("/api/data/user-watched-current"),
          fetch(`/api/watch-experiences/${movieId}`),
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

        const watchExperienceResponse = responses[3];
        const watchExperienceJson = await watchExperienceResponse.json().catch(() => null);
        setWatchExperience(watchExperienceResponse.ok ? watchExperienceJson?.value ?? null : null);
      } catch (error) {
        console.error("Failed to load movie action state:", error);
      }
    }

    fetchUserMovieState();

    // Subscribe to review events and reconcile temp items when opId is present
    try {
      eventSource = new EventSource(`/api/reviews/events?movieId=${movieId}`);
      eventSource.addEventListener("review-updated", async (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data || "{}");
          const incomingOpId = typeof payload?.opId === "string" ? payload.opId : undefined;
          const action = typeof payload?.action === "string" ? payload.action : undefined;
          const serverReview = payload?.review ?? null;

          if (serverReview && action === "deleted") {
            setReviews((prev) => {
              const next = prev.filter((review) => review.id !== serverReview.id);
              try {
                applyEntityUpdate(queryClient, [queryKeys.movie.detail(movieId)], (current: any) => {
                  if (!current) return current;
                  return { ...current, reviews: next };
                });
              } catch (e) {
                /* best-effort */
              }
              return next;
            });
            return;
          }

          // Fast-path: handle simple actions in-place without full reconciliation
          if (action === "liked" && serverReview?.id) {
            setReviews((prev) => {
              const next = prev.map((review) => (review.id === serverReview.id ? { ...review, likes: serverReview.likes, likedByMe: serverReview.likedByMe } : review));
              try {
                applyEntityUpdate(queryClient, [queryKeys.movie.detail(movieId)], (current: any) => {
                  if (!current) return current;
                  return { ...current, reviews: next };
                });
              } catch (e) {
                /* best-effort */
              }
              return next;
            });
            return;
          }

          if (action === "updated" && serverReview?.id) {
            setReviews((prev) => {
              const next = prev.map((review) => (review.id === serverReview.id ? serverReview : review));
              try {
                applyEntityUpdate(queryClient, [queryKeys.movie.detail(movieId)], (current: any) => {
                  if (!current) return current;
                  return { ...current, reviews: next };
                });
              } catch (e) {
                /* best-effort */
              }
              return next;
            });
            return;
          }

          // Op-based reconciliation for created/replied items below
          if (incomingOpId) {
            // Try to reconcile a temp review create
            const tempReview = reviews.find((r) => (r as any).opId === incomingOpId || (r as any).tempId === incomingOpId) as any;
              if (tempReview && serverReview) {
              const reconciled = reconcileTempItem(reviews, { opId: incomingOpId, type: "create" as const, tempId: tempReview.tempId, ts: Date.now() }, serverReview);
              setReviews(reconciled);
              try {
                applyEntityUpdate(queryClient, [queryKeys.movie.detail(movieId)], (current: any) => {
                  if (!current) return current;
                  return { ...current, reviews: reconciled };
                });
              } catch (e) {
                /* best-effort */
              }
              return;
            }

            // Try to reconcile a temp reply on an existing review
            for (const r of reviews) {
              const tempReply = (r.replies ?? []).find((rep: any) => (rep as any).opId === incomingOpId || (rep as any).tempId === incomingOpId) as any;
              if (tempReply && serverReview) {
                const serverReply = serverReview.replies?.find((sr: any) => sr.comment === tempReply.comment && sr.user?.id === tempReply.user?.id && !String(sr.id).startsWith("temp-"));
                if (serverReply) {
                  const opObj = { opId: incomingOpId, type: "create" as const, tempId: tempReply.tempId, ts: Date.now() };
                  const updated = reviews.map((review) => {
                    if (review.id !== serverReview.id) return review;
                    return { ...review, replies: reconcileTempItem(review.replies ?? [], opObj, serverReply) } as any;
                  });
                  setReviews(updated);
                  try {
                    applyEntityUpdate(queryClient, [queryKeys.movie.detail(movieId)], (current: any) => {
                      if (!current) return current;
                      return { ...current, reviews: updated };
                    });
                  } catch (e) {
                    /* best-effort */
                  }
                  return;
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to process review SSE payload:", err);
        }
      });
      eventSource.onerror = () => {
        // browser will retry
      };
    } catch (err) {
      console.warn("Could not open review events source:", err);
    }
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

  const handleSaveWatchExperience = async (experience: WatchExperience) => {
    if (!movie) return;

    if (!session?.user?.email) {
      toast.error("Sign in to log how you watched this movie.");
      return;
    }

    const response = await fetch(`/api/watch-experiences/${movie.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(experience),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(json?.error || "Unable to save watch experience.");
      return;
    }

    setWatchExperience(json?.value ?? experience);
    setIsWatched(true);
    toast.success("Watch experience saved");
  };

  const currentUserReview = reviews.find((review) => review.user.email && review.user.email === session?.user?.email) ?? null;

  const refreshReviews = async () => {
    if (!movie) return;

    try {
      const response = await fetch(`/api/reviews/movie/${movie.id}`);
      const json = await response.json().catch(() => null);
      setReviews(response.ok && Array.isArray(json?.value) ? json.value : []);
    } catch (error) {
      console.error("Failed to refresh reviews:", error);
    }
  };

  const openReviewDialog = (review?: Review | null) => {
    const targetReview = review ?? currentUserReview;
    setReviewRating(targetReview?.rating ?? 0);
    setReviewComment(targetReview?.comment ?? "");
    setReviewDialogOpen(true);
  };

  const handleSaveReview = async () => {
    if (!movie) return;

    if (!reviewRating) {
      toast.error("Choose a rating before saving your review.");
      return;
    }

    const editing = Boolean(currentUserReview);
    setReviewSubmitting(true);

    if (!editing) {
      // optimistic create
      const tempId = makeTempId("review");
      const op = { opId: generateOpId("review"), type: "create" as const, tempId, ts: Date.now() };
      
      const opId = `movie-review-${movie.id}`;
      addInFlightOp(opId, {
        opId,
        type: "post",
        surface: "movie",
        itemId: movie.id,
        payload: { rating: reviewRating, comment: reviewComment },
      });
      
      const optimisticReview: Review = {
        id: tempId,
        tempId,
        opId: op.opId,
        user: { id: session?.user?.email ?? tempId, email: session?.user?.email ?? "", username: session?.user?.email?.split("@")[0] ?? "user", displayName: session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "You", avatar: session?.user?.image ?? "", bio: "", followers: 0, following: 0, reviewCount: 0, watchlistCount: 0, favoriteMovies: [] },
        tmdbId: movie.id,
        rating: reviewRating,
        comment: reviewComment,
        date: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        replies: [],
      } as Review;

      setReviews((current) => [optimisticReview, ...current]);

      try {
        const body = attachOpToBody({ tmdbId: movie.id, rating: reviewRating, comment: reviewComment }, op);
        const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

        const response = await fetch("/api/reviews", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const json = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(json?.error || "Unable to save review.");
        }

        const serverReview = json?.value;
        const respOpId = json?.opId;

        if (serverReview && respOpId) {
          setReviews((prev) => reconcileTempItem(prev, op, serverReview));
        } else if (serverReview) {
          await refreshReviews();
        }

        toast.success("Review posted");
      } catch (error) {
        // rollback
        setReviews((prev) => prev.filter((r) => r.id !== ("temp-" + tempId) && r.id !== tempId));
        toast.error(error instanceof Error ? error.message : "Unable to save review.");
      } finally {
        removeInFlightOp(opId);
        setReviewDialogOpen(false);
        setReviewRating(0);
        setReviewComment("");
        setReviewSubmitting(false);
      }
      return;
    }

    // editing existing review - keep previous flow
    try {
      const response = await fetch(`/api/reviews/${currentUserReview?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: movie.id, rating: reviewRating, comment: reviewComment }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(json?.error || "Unable to save review.");
        setReviewSubmitting(false);
        return;
      }

      toast.success("Review updated");
      setReviewDialogOpen(false);
      setReviewRating(0);
      setReviewComment("");
      setReviewSubmitting(false);
      await refreshReviews();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save review.");
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    const confirmed = window.confirm("Delete this review?");
    if (!confirmed) return;

    const response = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" });
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(json?.error || "Unable to delete review.");
      return;
    }

    toast.success("Review deleted");
    await refreshReviews();
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

      <div className="container -mt-20 md:-mt-28 relative z-10">
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
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => openReviewDialog()}
                disabled={!session?.user?.email || (!isWatched && !currentUserReview)}
              >
                <Star className="h-4 w-4" /> {currentUserReview ? "Edit Review" : "Write Review"}
              </Button>
            </div>

            <div className="mt-6">
              <StreamingBadges platforms={movieWithStreaming?.streamingOn ?? []} />
            </div>
          </motion.div>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Cast</h2>
          <CastCarousel cast={movieWithStreaming?.cast ?? []} />
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Reviews</h2>
          {!session?.user?.email && (
            <p className="mb-4 text-sm text-muted-foreground">Sign in to write a review.</p>
          )}
          {session?.user?.email && !isWatched && !currentUserReview && (
            <p className="mb-4 text-sm text-muted-foreground">Mark this movie as watched before reviewing it.</p>
          )}
          <div className="space-y-4 max-w-2xl">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onEdit={openReviewDialog}
                onDelete={handleDeleteReview}
                onRefresh={refreshReviews}
              />
            ))}
            {reviews.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No reviews yet.
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 max-w-md">
          <HowYouWatched
            movieTitle={movie.title}
            initialValue={watchExperience}
            onSave={handleSaveWatchExperience}
            disabled={!session?.user?.email}
          />
        </section>


        <SimilarMovies movies={similar} />
      </div>

      <TrailerModal open={trailerOpen} onOpenChange={setTrailerOpen} title={movie.title} />

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentUserReview ? "Edit your review" : "Write a review"}</DialogTitle>
            <DialogDescription>Share your rating and thoughts about {movie.title}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Rating</p>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={reviewRating >= value ? "default" : "secondary"}
                    size="icon"
                    onClick={() => setReviewRating(value)}
                    className="h-10 w-10"
                  >
                    <Star className={reviewRating >= value ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Comment</p>
              <Textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="What did you think of the movie?"
                className="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveReview} disabled={reviewSubmitting || !reviewRating || isInFlight(`movie-review-${movie?.id}`)}>
              {(reviewSubmitting || isInFlight(`movie-review-${movie?.id}`)) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : currentUserReview ? "Update Review" : "Post Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
