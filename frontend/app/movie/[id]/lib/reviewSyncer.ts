
import type { Review } from "@/lib/types";
import type { ReviewSSEPayload } from "../types";
import { ReviewDeduplicator } from "./reviewDeduplicator";

export class ReviewEventSyncer {
  private eventSource: EventSource | null = null;
  private listeners: Set<(reviews: Review[]) => void> = new Set();
  private currentReviews: Review[] = [];

  constructor(private movieId: string) {}

  connect(): void {
    if (this.eventSource) {
      return;
    }

    try {
      this.eventSource = new EventSource(`/api/reviews/events?movieId=${this.movieId}`);

      this.eventSource.addEventListener("review-updated", (ev) => {
        this.handleReviewUpdate(ev as MessageEvent);
      });

      this.eventSource.onerror = () => {
        console.warn("Review events connection error, browser will retry");
      };
    } catch (error) {
      console.warn("Could not open review events source:", error);
    }
  }

  subscribe(listener: (reviews: Review[]) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  setCurrentReviews(reviews: Review[]): void {
    this.currentReviews = reviews;
  }

  private handleReviewUpdate(ev: MessageEvent): void {
    try {
      const payload = JSON.parse(ev.data || "{}") as ReviewSSEPayload;
      const incomingMovieId = payload?.movieId;
      
      if (incomingMovieId !== this.movieId) {
        return;
      }

      const action = payload?.action;
      const serverReview = payload?.review;
      const incomingOpId = payload?.opId;

      let nextReviews = [...this.currentReviews];

      if (action === "deleted" && serverReview?.id) {
        nextReviews = ReviewDeduplicator.removeById(nextReviews, serverReview.id);
        this.notifyListeners(nextReviews);
        return;
      }

      if (action === "liked" && serverReview?.id) {
        nextReviews = nextReviews.map((review) =>
          review.id === serverReview.id
            ? { ...review, likes: serverReview.likes, likedByMe: serverReview.likedByMe }
            : review
        );
        this.notifyListeners(nextReviews);
        return;
      }

      if (action === "updated" && serverReview?.id) {
        nextReviews = nextReviews.map((review) =>
          review.id === serverReview.id ? serverReview : review
        );
        this.notifyListeners(nextReviews);
        return;
      }

      if (action === "created" && serverReview) {
        if (incomingOpId) {
          const tempReview = nextReviews.find(
            (r) => (r as any).opId === incomingOpId || (r as any).tempId === incomingOpId
          );

          if (tempReview) {
            nextReviews = ReviewDeduplicator.reconcileTemp(
              nextReviews,
              (tempReview as any).tempId || tempReview.id,
              serverReview
            );
          } else {
            nextReviews = [serverReview, ...nextReviews];
          }
        } else {
          const exists = nextReviews.some((r) => r.id === serverReview.id);
          if (!exists) {
            nextReviews = [serverReview, ...nextReviews];
          }
        }

        this.notifyListeners(nextReviews);
        return;
      }

      if (action === "replied" && incomingOpId && serverReview) {
        let handled = false;

        for (let i = 0; i < nextReviews.length; i++) {
          const review = nextReviews[i];
          const tempReply = (review.replies ?? []).find(
            (rep: any) => rep.opId === incomingOpId || rep.tempId === incomingOpId
          ) as any;

          if (tempReply && serverReview.replies) {
            const serverReply = serverReview.replies.find(
              (sr: any) => sr.comment === tempReply.comment && sr.user?.id === tempReply.user?.id && !String(sr.id).startsWith("temp-")
            );

            if (serverReply) {
              nextReviews[i] = {
                ...review,
                replies: (review.replies ?? [])
                  .map((rep) => (rep.id === tempReply.id ? serverReply : rep))
                  .filter((rep) => !String(rep.id).startsWith("temp-")),
              };
              handled = true;
              break;
            }
          }
        }

        if (handled) {
          this.notifyListeners(nextReviews);
          return;
        }
        
        if (serverReview.id) {
          nextReviews = nextReviews.map((review) => (review.id === serverReview.id ? serverReview : review));
          this.notifyListeners(nextReviews);
        }
      }
    } catch (error) {
      console.error("Failed to process review SSE payload:", error);
    }
  }

  private notifyListeners(reviews: Review[]): void {
    this.currentReviews = reviews;
    for (const listener of this.listeners) {
      listener(reviews);
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }
}

const syncerRegistry = new Map<string, ReviewEventSyncer>();

export function getOrCreateSyncer(movieId: string): ReviewEventSyncer {
  if (!syncerRegistry.has(movieId)) {
    syncerRegistry.set(movieId, new ReviewEventSyncer(movieId));
  }
  return syncerRegistry.get(movieId)!;
}

export function releaseSyncer(movieId: string): void {
  const syncer = syncerRegistry.get(movieId);
  if (syncer) {
    syncer.disconnect();
    syncerRegistry.delete(movieId);
  }
}
