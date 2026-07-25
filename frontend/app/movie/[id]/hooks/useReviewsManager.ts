/**
 * useReviewsManager Hook
 * Manages review list state with SSE synchronization and deduplication
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { Review } from "@/lib/types";
import * as reviewsApi from "../lib/reviewsApi";
import { ReviewDeduplicator } from "../lib/reviewDeduplicator";
import { getOrCreateSyncer, releaseSyncer } from "../lib/reviewSyncer";

export interface UseReviewsManagerResult {
  reviews: Review[];
  isLoading: boolean;
  currentUserReview: Review | null;
  refetch: () => Promise<void>;
  addOptimisticReview: (review: Review) => void;
  removeReview: (reviewId: string) => void;
  updateReview: (reviewId: string, updates: Partial<Review>) => void;
  reconcileReview: (tempId: string, serverReview: Review) => void;
}

export function useReviewsManager(movieId: string, userEmail: string | undefined): UseReviewsManagerResult {
  const queryClient = useQueryClient();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const reviewsRef = useRef<Review[]>([]);

  useEffect(() => {
    reviewsRef.current = reviews;
  }, [reviews]);

  useEffect(() => {
    async function loadReviews() {
      setIsLoading(true);
      try {
        const fetched = await reviewsApi.fetchMovieReviews(movieId);
        setReviews(fetched);
      } finally {
        setIsLoading(false);
      }
    }
    loadReviews();
  }, [movieId]);

  useEffect(() => {
    const syncer = getOrCreateSyncer(movieId);
    syncer.setCurrentReviews(reviewsRef.current);

    const unsubscribe = syncer.subscribe((updatedReviews) => {
      setReviews(ReviewDeduplicator.deduplicate(updatedReviews));
    });

    syncer.connect();

    return () => {
      unsubscribe();
      releaseSyncer(movieId);
    };
  }, [movieId]);

  useEffect(() => {
    const syncer = getOrCreateSyncer(movieId);
    syncer.setCurrentReviews(reviews);
  }, [movieId, reviews]);

  const refetch = useCallback(async () => {
    const fetched = await reviewsApi.fetchMovieReviews(movieId);
    setReviews(fetched);
  }, [movieId]);

  const addOptimisticReview = useCallback((review: Review) => {
    setReviews((prev) => [review, ...prev]);
  }, []);

  const removeReview = useCallback((reviewId: string) => {
    setReviews((prev) => ReviewDeduplicator.removeById(prev, reviewId));
  }, []);

  const updateReview = useCallback((reviewId: string, updates: Partial<Review>) => {
    setReviews((prev) => prev.map((review) => (review.id === reviewId ? { ...review, ...updates } : review)));
  }, []);

  const reconcileReview = useCallback((tempId: string, serverReview: Review) => {
    setReviews((prev) => ReviewDeduplicator.reconcileTemp(prev, tempId, serverReview));
  }, []);

  const currentUserReview = reviews.find((review) => review.user.email === userEmail) ?? null;

  return {
    reviews,
    isLoading,
    currentUserReview,
    refetch,
    addOptimisticReview,
    removeReview,
    updateReview,
    reconcileReview,
  };
}