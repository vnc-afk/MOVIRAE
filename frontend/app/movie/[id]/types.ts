/**
 * Movie Detail Feature - Type Definitions
 * Centralized types for movie detail page domain
 */

import type { Movie, Review, WatchExperience } from "@/lib/types";

/**
 * Movie state with derived streaming info
 */
export interface MovieDetailState {
  movie: Movie | null;
  streamingOn: string[];
  streamingLoading: boolean;
  isLoading: boolean;
}

/**
 * User interaction state for a movie
 */
export interface MovieActionState {
  isWatched: boolean;
  isWatchlist: boolean;
  isLiked: boolean;
  watchExperience: WatchExperience | null;
  loading: {
    watched: boolean;
    watchlist: boolean;
    liked: boolean;
  };
}

/**
 * Review management state
 */
export interface ReviewsState {
  items: Review[];
  isLoading: boolean;
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    total: number;
  };
}

/**
 * Review dialog state
 */
export interface ReviewDialogState {
  isOpen: boolean;
  rating: number;
  comment: string;
  isSubmitting: boolean;
  editingReview: Review | null;
}

/**
 * Combined movie detail page state
 */
export interface MovieDetailPageState {
  movie: MovieDetailState;
  actions: MovieActionState;
  reviews: ReviewsState;
  reviewDialog: ReviewDialogState;
}

/**
 * SSE event payload from server
 */
export interface ReviewSSEPayload {
  movieId?: string;
  opId?: string;
  action?: "created" | "updated" | "deleted" | "liked" | "replied";
  review?: Review | null;
  reply?: any;
}

/**
 * Optimistic operation metadata
 */
export interface OptimisticOp {
  opId: string;
  type: "create" | "update" | "delete";
  tempId?: string;
  timestamp: number;
}

/**
 * Movie API response shape
 */
export interface MovieApiResponse<T> {
  value: T;
  opId?: string;
  error?: string;
}

/**
 * Query options for reviews
 */
export interface ReviewsQueryOptions {
  movieId: string;
  page?: number;
  pageSize?: number;
  sortBy?: "recent" | "rating" | "helpful";
}
