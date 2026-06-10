/**
 * ReviewsSection Component
 * Displays list of reviews with loading state
 */

import { Skeleton } from "@/components/ui/skeleton";
import { ReviewCard } from "@/components/ReviewCard";
import type { Review } from "@/lib/types";

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
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold text-foreground mb-4">Reviews</h2>

      {!isAuthenticated && (
        <p className="mb-4 text-sm text-muted-foreground">Sign in to write a review.</p>
      )}

      {isAuthenticated && !isWatched && !hasCurrentReview && (
        <p className="mb-4 text-sm text-muted-foreground">Mark this movie as watched before reviewing it.</p>
      )}

      <div className="space-y-4 max-w-2xl">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No reviews yet.
          </div>
        ) : (
          reviews.map((review) => (
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
