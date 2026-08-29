
export const MOVIE_DETAIL_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50,

  // Timeouts
  STREAMING_FETCH_TIMEOUT: 5000,
  REVIEWS_FETCH_TIMEOUT: 8000,

  // Retry logic
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,

  // UI debounce/throttle
  BUTTON_DEBOUNCE_MS: 300,
  SSE_RECONNECT_DELAY: 5000,

  // Cache durations (in seconds)
  MOVIE_CACHE_TTL: 3600,
  REVIEWS_CACHE_TTL: 300,
  USER_STATE_CACHE_TTL: 60,
} as const;

export const MOVIE_ACTION_KEYS = {
  WATCHLIST: "watchlist",
  FAVORITES: "favorites",
  WATCHED: "watched",
} as const;

export const REVIEW_SORT_OPTIONS = ["recent", "rating", "helpful"] as const;
