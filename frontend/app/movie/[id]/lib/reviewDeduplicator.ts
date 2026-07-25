
import type { Review } from "@/lib/types";
export class ReviewDeduplicator {
  static isTemporary(review: Review): boolean {
    return (
      String(review.id).startsWith("temp-") ||
      (review as any).tempId ||
      (review as any).opId
    );
  }

  static findMatchingTemp(
    tempReview: Review,
    serverReview: Review,
    userEmail: string | undefined
  ): boolean {
    if (tempReview.user.email === serverReview.user.email) {
      return (
        tempReview.rating === serverReview.rating &&
        tempReview.comment === serverReview.comment &&
        (tempReview as any).movieId === (serverReview as any).movieId
      );
    }
    return false;
  }

  static deduplicate(reviews: Review[]): Review[] {
    const seen = new Set<string>();
    const deduped: Review[] = [];

    for (const review of reviews) {
      if (!this.isTemporary(review)) {
        if (!seen.has(review.id)) {
          seen.add(review.id);
          deduped.push(review);
        }
      }
    }

    for (const review of reviews) {
      if (this.isTemporary(review)) {
        const tempId = (review as any).tempId || review.id;
        if (!seen.has(tempId) && !seen.has(review.id)) {
          seen.add(tempId);
          deduped.push(review);
        }
      }
    }

    return deduped;
  }

  static reconcileTemp(
    reviews: Review[],
    tempId: string,
    serverReview: Review
  ): Review[] {
    return reviews
      .map((review) => {
        const isTarget =
          review.id === tempId ||
          (review as any).tempId === tempId ||
          (review as any).opId === tempId;

        if (isTarget) {
          return serverReview;
        }
        return review;
      })
      .filter((review, index, self) => {
        // Remove duplicates of the same server review
        const isTemp = this.isTemporary(review);
        if (!isTemp && review.id === serverReview.id) {
          return index === self.findIndex((r) => r.id === serverReview.id);
        }
        return true;
      });
  }

  static removeById(reviews: Review[], reviewId: string): Review[] {
    return reviews.filter((review) => review.id !== reviewId);
  }
}
