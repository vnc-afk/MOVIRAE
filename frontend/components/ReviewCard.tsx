"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { Heart, MessageCircle, ChevronDown, ChevronUp, Send, PencilLine, Trash2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { Button } from "./ui/button";
import { toast } from "sonner";
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
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [likeCount, setLikeCount] = useState(review.likes);
  const [liked, setLiked] = useState(Boolean(review.likedByMe));
  const [actionPending, setActionPending] = useState(false);
  const canManageReview = Boolean(session?.user?.email && review.user.email && session.user.email === review.user.email);
  const reviewAvatar = getSafeImageSrc(review.user.avatar);

  useEffect(() => {
    setLikeCount(review.likes);
    setLiked(Boolean(review.likedByMe));
  }, [review.likes, review.likedByMe]);

  async function refreshReviews() {
    await onRefresh?.();
  }

  async function handleLike() {
    if (!session?.user?.email || actionPending) {
      return;
    }

    setActionPending(true);
    try {
      const response = await fetch(`/api/reviews/${review.id}/like`, { method: "POST" });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(json?.error || "Unable to like review.");
        return;
      }

      const nextLiked = typeof json?.value?.likedByMe === "boolean" ? json.value.likedByMe : !liked;
      setLiked(nextLiked);

      if (typeof json?.value?.likes === "number") {
        setLikeCount(json.value.likes);
      } else {
        setLikeCount((current) => (nextLiked ? current + 1 : Math.max(current - 1, 0)));
      }

      await refreshReviews();
    } catch (error) {
      console.error("Failed to like review:", error);
      toast.error("Unable to like review.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleReplySubmit() {
    const trimmedReply = replyText.trim();

    if (!session?.user?.email || actionPending || !trimmedReply) {
      return;
    }

    setActionPending(true);
    try {
      const response = await fetch(`/api/reviews/${review.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: trimmedReply }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(json?.error || "Unable to post reply.");
        return;
      }

      setReplyText("");
      setShowReplyInput(false);
      setShowReplies(true);
      await refreshReviews();
    } catch (error) {
      console.error("Failed to post reply:", error);
      toast.error("Unable to post reply.");
    } finally {
      setActionPending(false);
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
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {review.comment}
          </p>

          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={handleLike}
              aria-disabled={!session?.user?.email || actionPending}
              className={`flex items-center gap-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${liked ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? "fill-primary" : ""}`} />
              <span>{likeCount}</span>
            </button>
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              disabled={!session?.user?.email || actionPending}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Reply</span>
            </button>
            {review.replies && review.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {review.replies.length} {review.replies.length === 1 ? "reply" : "replies"}
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
                disabled={!session?.user?.email || actionPending}
                className="flex-1 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleReplySubmit}
                disabled={!session?.user?.email || actionPending || !replyText.trim()}
                className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Threaded replies */}
          {showReplies && review.replies && (
            <div className="mt-4 ml-4 border-l-2 border-border pl-4 space-y-3">
              {review.replies.map((reply) => {
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
                      <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1">
                        <Heart className="h-3 w-3" />
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
