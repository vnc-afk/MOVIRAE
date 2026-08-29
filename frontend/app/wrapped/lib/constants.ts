export const WRAPPED_CONFIG = {
  TOTAL_SLIDES: 7,
  SLIDE_IDS: [
    "intro",
    "stats",
    "genres",
    "mood",
    "platform",
    "weekday",
    "summary",
  ] as const,
  REFETCH_DELAY: 600,
  CACHE_VERSION: 1,
} as const;

export const SLIDE_LABELS: Record<typeof WRAPPED_CONFIG.SLIDE_IDS[number], string> = {
  intro: "Introduction",
  stats: "Big Numbers",
  genres: "Genre Breakdown",
  mood: "Emotional Landscape",
  platform: "How You Watched",
  weekday: "Viewing Rhythm",
  summary: "Your Summary",
};

export const COLORS = [
  "hsl(36, 90%, 50%)",   // Orange
  "hsl(150, 50%, 40%)",  // Green
  "hsl(220, 60%, 50%)",  // Blue
  "hsl(0, 72%, 51%)",    // Red
  "hsl(280, 60%, 50%)",  // Purple
  "hsl(45, 80%, 50%)",   // Yellow
  "hsl(180, 50%, 45%)",  // Cyan
  "hsl(330, 60%, 50%)",  // Pink
] as const;

export const BADGE_CONFIG = {
  CINEPHILE_THRESHOLD: 100,
  MOVIEGOER_THRESHOLD: 10,
  STREAK_MASTER_THRESHOLD: 14,
  RISING_STREAK_THRESHOLD: 3,
  WORLD_EXPLORER_THRESHOLD: 5,
} as const;

export const SUMMARY_THRESHOLDS = [
  { threshold: 100, title: "You're a Cinema Connoisseur" },
  { threshold: 50, title: "You're a Film Aficionado" },
  { threshold: 10, title: "You're a Movie Lover" },
  { threshold: 1, title: "You're Getting Into Movies" },
  { threshold: 0, title: "You're a Curious Viewer" },
] as const;

export const ANIMATION_DELAYS = {
  STAGGER_ITEM: 0.1,
  SLIDE_TRANSITION: 0.4,
  CHART_ANIMATION: 800,
} as const;
