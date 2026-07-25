
import { useState, useCallback } from "react";
import type { Review } from "@/lib/types";

export interface UseReviewDialogResult {
  isOpen: boolean;
  rating: number;
  comment: string;
  isSubmitting: boolean;
  editingReview: Review | null;
  open: (review?: Review | null) => void;
  close: () => void;
  setRating: (rating: number) => void;
  setComment: (comment: string) => void;
  setSubmitting: (submitting: boolean) => void;
  reset: () => void;
}

/**
 * Manages review dialog open state and form values for creating or editing reviews.
 */
export function useReviewDialog(): UseReviewDialogResult {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const open = useCallback((review?: Review | null) => {
    if (review) {
      setEditingReview(review);
      setRating(review.rating);
      setComment(review.comment);
    } else {
      setEditingReview(null);
      setRating(0);
      setComment("");
    }
    setSubmitting(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const reset = useCallback(() => {
    setIsOpen(false);
    setRating(0);
    setComment("");
    setEditingReview(null);
    setSubmitting(false);
  }, []);

  return {
    isOpen,
    rating,
    comment,
    isSubmitting,
    editingReview,
    open,
    close,
    setRating,
    setComment,
    setSubmitting,
    reset,
  };
}
