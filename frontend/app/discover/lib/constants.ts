
export const API_CONFIG = {
  TIMEOUT_MS: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000, 
} as const;

export const PAGINATION_CONFIG = {
  INITIAL_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  DEDUPLICATION_THRESHOLD: 0.4, 
  INTERSECTION_OBSERVER_MARGIN: "500px",
} as const;

export const FILTER_CONFIG = {
  MIN_RUNTIME: 0,
  MAX_RUNTIME: 200,
  RUNTIME_STEP: 5,
} as const;

export const GRID_CONFIG = {
  MOBILE_COLS: 2,
  TABLET_COLS: 3,
  DESKTOP_COLS: 4,
  LARGE_COLS: 6,
  SKELETON_COUNT: 12, 
} as const;

export const TIMING_CONFIG = {
  SEARCH_DEBOUNCE_MS: 300,
  URL_SYNC_DEBOUNCE_MS: 500, 
  ANIMATION_DURATION_MS: 400, 
} as const;

export const STORAGE_KEYS = {
  FILTER_PRESETS: "discover_filter_presets",
  LAST_QUERY: "discover_last_query",
  SCROLL_POSITION: "discover_scroll_position",
} as const;

export const ERROR_MESSAGES = {
  FETCH_FAILED: "Failed to load movies. Please try again.",
  GENRES_FAILED: "Unable to load genres. Some features may be unavailable.",
  PRESET_SAVE_FAILED: "Failed to save preset. Please try again.",
  PRESET_DELETE_FAILED: "Failed to delete preset. Please try again.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  TIMEOUT_ERROR: "Request took too long. Please try again.",
  VALIDATION_ERROR: "Invalid filter parameters.",
} as const;

export const CACHE_CONFIG = {
  QUERY_STALE_TIME_MS: 5 * 60 * 1000,
  QUERY_CACHE_TIME_MS: 10 * 60 * 1000, 
} as const;