export type ReviewEvent = {
  type: "review-updated";
  movieId: string;
  reviewId: string;
  action: "created" | "updated" | "deleted" | "liked" | "replied";
  timestamp: string;
  opId?: string;
  review?: any;
};

type ReviewEventListener = (event: ReviewEvent) => void;

const listeners = new Set<ReviewEventListener>();

export function subscribeToReviewEvents(listener: ReviewEventListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function publishReviewEvent(movieId: string, reviewId: string, action: ReviewEvent["action"], opId?: string, review?: any) {
  if (listeners.size === 0) return;

  const payload: ReviewEvent = {
    type: "review-updated",
    movieId,
    reviewId,
    action,
    timestamp: new Date().toISOString(),
    opId,
    review,
  };

  for (const listener of listeners) {
    listener(payload);
  }
}

export default { subscribeToReviewEvents, publishReviewEvent };
