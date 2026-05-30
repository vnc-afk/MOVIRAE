export const queryKeys = {
  movie: {
    detail: (id: string) => ["movie", "detail", id] as const,
    credits: (id: string) => ["movie", "credits", id] as const,
    streaming: (id: string) => ["movie", "streaming", id] as const,
    recommendations: (id: string) => ["movie", "recommendations", id] as const,
    list: (params?: Record<string, unknown>) => ["movies", "list", JSON.stringify(params ?? {})] as const,
  },
  group: {
    list: () => ["group", "list"] as const,
    detail: (id: string) => ["group", "detail", id] as const,
  },
  sharedLists: {
    all: () => ["shared-lists", "all"] as const,
    detail: (id: string) => ["shared-lists", "detail", id] as const,
  },
  notifications: {
    all: (sessionEmail?: string | null) => ["notifications", "all", sessionEmail ?? "anonymous"] as const,
  },
  messaging: {
    snapshot: () => ["messaging", "snapshot"] as const,
    friends: () => ["messaging", "friends"] as const,
    thread: (userId: string) => ["messaging", "thread", userId] as const,
  },
  profile: {
    detail: (id: string) => ["profile", "detail", id] as const,
    current: () => ["profile", "detail", "current"] as const,
  },
  recommendations: {
    home: () => ["recommendations", "home"] as const,
  },
  home: {
    activityFeed: () => ["home", "activity-feed"] as const,
  },
  wrapped: {
    current: () => ["wrapped", "current"] as const,
  },
  compare: {
    users: () => ["compare", "users"] as const,
    watchlist: (userId: string) => ["compare", "watchlist", userId] as const,
  },
  stats: {
    current: () => ["stats", "current"] as const,
  },
  discover: {
    seeds: (params?: string) => ["discover", "seeds", params ?? ""] as const,
    search: (query: string) => ["discover", "search", query] as const,
  },
} as const;

export type TypedQueryKey = readonly unknown[];

export function makeKey<T extends readonly unknown[]>(k: T): T {
  return k;
}

export default queryKeys;
