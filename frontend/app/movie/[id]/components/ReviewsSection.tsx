
"use client";

import { useMemo, useState } from "react";
import { ReviewCard } from "@/components/ReviewCard";
import { ReviewFilters, type ReviewFilter } from "@/components/ReviewFilters";
import { Skeleton } from "@/components/ui/skeleton";
import type { Review, ReviewTone } from "@/lib/types";

interface ReviewsSectionProps {
  reviews: Review[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isWatched: boolean;
  hasCurrentReview: boolean;
  onEdit: (review: Review) => void;
  onDelete: (reviewId: string) => void;
  onRefresh: () => void;
}

/**
 * Review feed state for the movie detail page.
 * Shows loading placeholders, empty state, or review cards and forwards
 * edit/delete actions to the parent page.
 */
export function ReviewsSection({
  reviews,
  isLoading,
  isAuthenticated,
  isWatched,
  hasCurrentReview,
  onEdit,
  onDelete,
  onRefresh,
}: ReviewsSectionProps) {
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("all");

  const reviewsWithTone = useMemo(
    () => reviews.map((review) => ({ ...review, tone: review.tone ?? inferReviewTone(review.comment) })),
    [reviews],
  );

  const visibleReviews = useMemo(() => {
    const filtered = activeFilter === "all" || activeFilter === "most-helpful"
      ? reviewsWithTone
      : reviewsWithTone.filter((review) => review.tone === activeFilter);

    return activeFilter === "most-helpful"
      ? [...filtered].sort((a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0))
      : filtered;
  }, [activeFilter, reviewsWithTone]);

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold text-foreground mb-4">Reviews</h2>

      {!isAuthenticated && (
        <p className="mb-4 text-sm text-muted-foreground">Sign in to write a review.</p>
      )}

      {isAuthenticated && !isWatched && !hasCurrentReview && (
        <p className="mb-4 text-sm text-muted-foreground">Mark this movie as watched before reviewing it.</p>
      )}

      {!isLoading && reviews.length > 0 && (
        <div className="mb-5 max-w-2xl">
          <ReviewFilters activeTone={activeFilter} onToneChange={setActiveFilter} />
        </div>
      )}

      <div className="max-w-2xl space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No reviews yet.
          </div>
        ) : visibleReviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No reviews match this filter.
          </div>
        ) : (
          visibleReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onEdit={() => onEdit(review)}
              onDelete={() => onDelete(review.id)}
              onRefresh={onRefresh}
            />
          ))
        )}
      </div>
    </section>
  );
}

function inferReviewTone(comment: string): ReviewTone {
  const normalizedComment = comment.toLowerCase();

  if (/(lol|haha|hilarious|funny|laughed|comedy)/.test(normalizedComment)) return "funny";
  if (/(cinematography|screenplay|editing|performance|direction|themes|structure)/.test(normalizedComment)) {
    return "analytical";
  }
  if (/(masterpiece|masterclass|moving|powerful|beautiful|important|profound)/.test(normalizedComment)) {
    return "serious";
  }

  return "casual";
}
