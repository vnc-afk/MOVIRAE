export const RECOMMENDATIONS_CONFIG = {
  API_RETRY_ATTEMPTS: 2,
  API_PATH: "/api/recommendations",
  PAGE_PATH: "/api/recommendations/page",
  DEFAULT_SECTION: "top-picks" as const,
  PAGE_SIZE: 20,
  REVIEW_EVENTS_PATH: "/api/reviews/events",
  REVIEW_REFRESH_DEBOUNCE_MS: 500,
  SECTION_QUERY_PARAM: "section",
  RECOMMENDATION_GENRE_ID: 28,
};
