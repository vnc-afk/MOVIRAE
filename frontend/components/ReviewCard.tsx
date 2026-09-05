"use client";

import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { Heart, MessageCircle, ChevronDown, ChevronUp, Send, PencilLine, Trash2, Loader2, ThumbsUp, Eye } from "lucide-react";
import { StarRating } from "./StarRating";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { generateOpId, attachOpToBody, attachOpToHeaders, makeTempId, reconcileTempItem } from "@/lib/optimistic";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import type { Review } from "@/lib/types";

interface ReviewCardProps {
  review: Review;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: string) => void;
  onRefresh?: () => Promise<void> | void;
}

function getSafeImageSrc(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function formatReviewDate(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;

  return format(parsedDate, "PPp");
}

export function ReviewCard({ review, onEdit, onDelete, onRefresh }: ReviewCardProps) {
  const { data: session } = useSession();
  const { isInFlight, addInFlightOp, removeInFlightOp, getInFlightByItemId } = useOptimisticOps();
  
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [likeCount, setLikeCount] = useState(review.likes);
  const [liked, setLiked] = useState(Boolean(review.likedByMe));
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount ?? 0);
  const [helpful, setHelpful] = useState(Boolean(review.helpfulByMe));
  const [helpfulPending, setHelpfulPending] = useState(false);
  const [replies, setReplies] = useState(review.replies);
  const [showSpoiler, setShowSpoiler] = useState(false);
  
  const canManageReview = Boolean(session?.user?.email && review.user.email && session.user.email === review.user.email);
  const reviewAvatar = getSafeImageSrc(review.user.avatar);
  const isSpoiler = review.isSpoiler || /^\s*(\[?spoilers?\]?\s*[:\-])/i.test(review.comment);
  const reviewComment = review.comment.replace(/^\s*(\[?spoilers?\]?\s*[:\-]\s*)/i, "");
  const toneBadgeClasses: Record<string, string> = {
    funny: "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/25",
    serious: "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/25",
    analytical: "bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-400/25",
    casual: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/25",
  };

  // Derive pending states from the centralized store
  const reviewLikeOpId = useMemo(() => `review-like-${review.id}`, [review.id]);
  const reviewReplyOpId = useMemo(() => `review-reply-${review.id}`, [review.id]);
  
  const likePending = isInFlight(reviewLikeOpId);
  const replyPending = isInFlight(reviewReplyOpId);
  const pendingReplyLikeIds = useMemo(
    () => {
      const inFlightByReview = getInFlightByItemId(review.id);
      return Object.fromEntries(
        inFlightByReview
          .filter((op: any) => op.type === "like" && op.surface === "review")
          .map((op: any) => [op.itemId, true])
      );
    },
    [review.id, getInFlightByItemId]
  );
  
  useEffect(() => {
    setLikeCount(review.likes);
    setLiked(Boolean(review.likedByMe));
    setHelpfulCount(review.helpfulCount ?? 0);
    setHelpful(Boolean(review.helpfulByMe));
    setReplies(review.replies);
  }, [review.likes, review.likedByMe, review.helpfulCount, review.helpfulByMe, review.replies]);

  async function refreshReviews() {
    await onRefresh?.();
  }

  async function handleLike() {
    if (!session?.user?.email || likePending) {
      return;
    }

    const previousLiked = liked;
    const previousLikeCount = likeCount;
    const nextLiked = !previousLiked;

    setLiked(nextLiked);
    setLikeCount((current) => (nextLiked ? current + 1 : Math.max(current - 1, 0)));
    
    const opId = reviewLikeOpId;
    addInFlightOp(opId, {
      opId,
      type: "like",
      surface: "review",
      itemId: review.id,
      payload: { nextLiked },
    });

    try {
      const response = await fetch(`/api/reviews/${review.id}/like`, { method: "POST" });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(json?.error || "Unable to like review.");
      }

      const serverLiked = typeof json?.value?.likedByMe === "boolean" ? json.value.likedByMe : nextLiked;
      const serverLikes = typeof json?.value?.likes === "number" ? json.value.likes : null;

      setLiked(serverLiked);
      if (serverLikes !== null) {
        setLikeCount(serverLikes);
      }

      await refreshReviews();
    } catch (error) {
      console.error("Failed to like review:", error);
      setLiked(previousLiked);
      setLikeCount(previousLikeCount);
      toast.error(error instanceof Error ? error.message : "Unable to like review.");
    } finally {
      removeInFlightOp(opId);
    }
  }

  async function handleHelpful() {
    if (!session?.user?.email || helpfulPending) return;

    const previousHelpful = helpful;
    const previousCount = helpfulCount;
    const nextHelpful = !previousHelpful;
    setHelpful(nextHelpful);
    setHelpfulCount(nextHelpful ? previousCount + 1 : Math.max(previousCount - 1, 0));
    setHelpfulPending(true);

    try {
      const response = await fetch(`/api/reviews/${review.id}/helpful`, { method: "POST" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || json?.error || "Unable to update helpful vote.");

      const updatedReview = json?.data;
      setHelpful(Boolean(updatedReview?.helpfulByMe ?? nextHelpful));
      setHelpfulCount(typeof updatedReview?.helpfulCount === "number" ? updatedReview.helpfulCount : previousCount);
      await refreshReviews();
    } catch (error) {
      setHelpful(previousHelpful);
      setHelpfulCount(previousCount);
      toast.error(error instanceof Error ? error.message : "Unable to update helpful vote.");
    } finally {
      setHelpfulPending(false);
    }
  }

  async function handleReplySubmit() {
    const trimmedReply = replyText.trim();

    if (!session?.user?.email || replyPending || !trimmedReply) {
      return;
    }

    const tempReplyId = makeTempId("reply");
    const op = { opId: generateOpId("reply"), type: "create" as const, tempId: tempReplyId, ts: Date.now() };
    
    const opId = reviewReplyOpId;
    addInFlightOp(opId, {
      opId,
      type: "reply",
      surface: "review",
      itemId: review.id,
      payload: { comment: trimmedReply },
    });
    
    const replyUser = {
      id: session.user?.email ?? tempReplyId,
      username: session.user?.email?.split("@")[0] ?? "user",
      displayName: session.user?.name ?? session.user?.email?.split("@")[0] ?? "You",
      avatar: session.user?.image ?? "",
      bio: "",
      followers: 0,
      following: 0,
      reviewCount: 0,
      watchlistCount: 0,
      favoriteMovies: [],
    };

    const optimisticReply = {
      id: tempReplyId,
      tempId: tempReplyId,
      opId: op.opId,
      user: replyUser,
      comment: trimmedReply,
      date: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };

    setReplies((current) => [...current, optimisticReply]);
    setShowReplies(true);

    try {
      const body = attachOpToBody({ comment: trimmedReply }, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch(`/api/reviews/${review.id}/replies`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(json?.error || "Unable to post reply.");
      }

      const serverReview = json?.value;
      const respOpId = json?.opId;

      if (serverReview && respOpId) {
        // try to find the created reply on server by matching content and author
        const serverReply = Array.isArray(serverReview.replies)
          ? serverReview.replies.find((r: any) => r.comment === trimmedReply && r.user?.email === session.user?.email && !String(r.id).startsWith("temp-"))
          : undefined;

        if (serverReply) {
          setReplies((prev) => reconcileTempItem(prev, op, serverReply));
        } else if (Array.isArray(serverReview.replies)) {
          setReplies(serverReview.replies);
        }
      } else if (serverReview && Array.isArray(serverReview.replies)) {
        setReplies(serverReview.replies);
      }

      await refreshReviews();

      setReplyText("");
      setShowReplyInput(false);
    } catch (error) {
      console.error("Failed to post reply:", error);
      setReplies((current) => current.filter((reply) => reply.id !== tempReplyId));
      toast.error(error instanceof Error ? error.message : "Unable to post reply.");
    } finally {
      removeInFlightOp(opId);
    }
  }

  async function handleReplyLike(replyId: string) {
    if (!session?.user?.email || isInFlight(`reply-like-${replyId}`)) {
      return;
    }

    const currentReply = replies.find((reply) => reply.id === replyId);

    if (!currentReply) {
      return;
    }

    const previousReplies = replies;
    const nextLiked = !Boolean(currentReply.likedByMe);
    const originalLikes = typeof currentReply.likes === "number" ? currentReply.likes : 0;
    const optimisticLikes = nextLiked ? originalLikes + 1 : Math.max(originalLikes - 1, 0);

    // Optimistically update using the pre-click likes value to avoid racey increments
    setReplies((current) => current.map((reply) => (
      reply.id === replyId
        ? { ...reply, likedByMe: nextLiked, likes: optimisticLikes }
        : reply
    )));

    const opId = `reply-like-${replyId}`;
    addInFlightOp(opId, {
      opId,
      type: "like",
      surface: "review",
      itemId: replyId,
      parentId: review.id,
    });

    try {
      const op = { opId, type: "like" as const, itemId: replyId, ts: Date.now() };
      // attach opId for server-side reconciliation
      const headers = attachOpToHeaders(undefined, op);
      const response = await fetch(`/api/reviews/${review.id}/replies/${replyId}/like`, {
        method: "POST",
        headers,
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(json?.error || "Unable to like reply.");
      }

      if (Array.isArray(json?.value?.replies)) {
        setReplies(json.value.replies);
      }

      await refreshReviews();
    } catch (error) {
      console.error("Failed to like reply:", error);
      setReplies(previousReplies);
      toast.error(error instanceof Error ? error.message : "Unable to like reply.");
    } finally {
      removeInFlightOp(opId);
    }
  }

  return (
    <div className="rounded-lg bg-card p-5 card-shadow hover:card-shadow-hover transition-shadow duration-300">
      <div className="flex items-start gap-3">
        {reviewAvatar ? (
          <img
            src={reviewAvatar}
            alt={review.user.displayName}
            className="h-10 w-10 rounded-full bg-muted"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-sm text-foreground">
                {review.user.displayName}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {formatReviewDate(review.date)}
              </span>
              {review.tone && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] capitalize ${toneBadgeClasses[review.tone] ?? "bg-secondary text-muted-foreground"}`}>
                  {review.tone}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} size="sm" />
              {canManageReview && (
                <div className="flex items-center gap-1">
                  {onEdit && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(review)}>
                      <PencilLine className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(review.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-2">
            <p className={`text-sm leading-relaxed text-muted-foreground ${isSpoiler && !showSpoiler ? "select-none blur-sm" : ""}`}>
              {reviewComment}
            </p>
            {isSpoiler && (
              <button
                type="button"
                onClick={() => setShowSpoiler((current) => !current)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {showSpoiler ? <Eye className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showSpoiler ? "Hide spoiler" : "Reveal spoiler"}
              </button>
            )}
          </div>

          {helpfulCount > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ThumbsUp className="h-3.5 w-3.5" />
              Most Helpful · {helpfulCount} {helpfulCount === 1 ? "person found this useful" : "people found this useful"}
            </p>
          )}

          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={handleLike}
              disabled={!session?.user?.email || likePending}
              aria-busy={likePending}
              className={`flex items-center gap-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${liked ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              {likePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className={`h-3.5 w-3.5 ${liked ? "fill-primary" : ""}`} />}
              <span>{likeCount}</span>
              <span>Like</span>
              {likePending && <span className="sr-only">Updating like</span>}
            </button>
            <button
              type="button"
              onClick={handleHelpful}
              disabled={!session?.user?.email || helpfulPending}
              aria-busy={helpfulPending}
              className={`flex items-center gap-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${helpful ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              {helpfulPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className={`h-3.5 w-3.5 ${helpful ? "fill-primary" : ""}`} />}
              <span>{helpfulCount}</span>
              <span>Helpful</span>
            </button>
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              disabled={!session?.user?.email || replyPending}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Reply</span>
            </button>
            {replies && replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          {/* Reply input */}
          {showReplyInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                  disabled={!session?.user?.email || replyPending}
                className="flex-1 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleReplySubmit}
                disabled={!session?.user?.email || replyPending || !replyText.trim()}
                className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {replyPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          {/* Threaded replies */}
          {showReplies && replies && (
            <div className="mt-4 ml-4 border-l-2 border-border pl-4 space-y-3">
              {replies.map((reply) => {
                const replyAvatar = getSafeImageSrc(reply.user.avatar);

                return (
                  <div key={reply.id} className="flex gap-2">
                    {replyAvatar ? (
                      <img
                        src={replyAvatar}
                        alt={reply.user.displayName}
                        className="h-7 w-7 rounded-full bg-muted flex-shrink-0"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted flex-shrink-0" aria-hidden="true" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {reply.user.displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatReviewDate(reply.date)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reply.comment}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleReplyLike(reply.id)}
                        disabled={!session?.user?.email || Boolean(pendingReplyLikeIds[reply.id])}
                        aria-busy={Boolean(pendingReplyLikeIds[reply.id])}
                        className={`flex items-center gap-1 text-[10px] transition-colors mt-1 disabled:cursor-not-allowed disabled:opacity-60 ${reply.likedByMe ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                      >
                        {pendingReplyLikeIds[reply.id] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Heart className={`h-3 w-3 ${reply.likedByMe ? "fill-primary" : ""}`} />
                        )}
                        <span>{reply.likes}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
