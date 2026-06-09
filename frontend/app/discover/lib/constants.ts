/**
 * Application-wide constants for the Discover feature
 */

// API & Data Fetching
export const API_CONFIG = {
  TIMEOUT_MS: 8000, // Request timeout
  RETRY_ATTEMPTS: 2, // Number of retries for failed requests
  RETRY_DELAY_MS: 1000, // Delay between retries
} as const;

// Pagination
export const PAGINATION_CONFIG = {
  INITIAL_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  DEDUPLICATION_THRESHOLD: 0.4, // 40% - minimum results to continue pagination
  INTERSECTION_OBSERVER_MARGIN: "500px", // How far below the fold to trigger load
} as const;

// Movie filters
export const FILTER_CONFIG = {
  MIN_RUNTIME: 0,
  MAX_RUNTIME: 200,
  RUNTIME_STEP: 5, // Slider step size
} as const;

// UI Grid
export const GRID_CONFIG = {
  MOBILE_COLS: 2,
  TABLET_COLS: 3,
  DESKTOP_COLS: 4,
  LARGE_COLS: 6,
  SKELETON_COUNT: 12, // Number of skeleton loaders to show
} as const;

// Debounce & Timing
export const TIMING_CONFIG = {
  SEARCH_DEBOUNCE_MS: 300, // Debounce search input
  URL_SYNC_DEBOUNCE_MS: 500, // Debounce URL updates
  ANIMATION_DURATION_MS: 400, // Standard animation duration
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  FILTER_PRESETS: "discover_filter_presets",
  LAST_QUERY: "discover_last_query",
  SCROLL_POSITION: "discover_scroll_position",
} as const;

// Error messages
export const ERROR_MESSAGES = {
  FETCH_FAILED: "Failed to load movies. Please try again.",
  GENRES_FAILED: "Unable to load genres. Some features may be unavailable.",
  PRESET_SAVE_FAILED: "Failed to save preset. Please try again.",
  PRESET_DELETE_FAILED: "Failed to delete preset. Please try again.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  TIMEOUT_ERROR: "Request took too long. Please try again.",
  VALIDATION_ERROR: "Invalid filter parameters.",
} as const;

// Cache invalidation
export const CACHE_CONFIG = {
  QUERY_STALE_TIME_MS: 5 * 60 * 1000, // 5 minutes
  QUERY_CACHE_TIME_MS: 10 * 60 * 1000, // 10 minutes
} as const;