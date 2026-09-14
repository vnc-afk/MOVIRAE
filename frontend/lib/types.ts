export type WatchPlatform =
  | "Cinema"
  | "Netflix"
  | "Amazon Prime"
  | "Hulu"
  | "Disney+"
  | "Apple TV+"
  | "HBO Max"
  | "Blu-ray"
  | "DVD";

export type WatchContext =
  | "Solo"
  | "With Friends"
  | "Date Night"
  | "Family"
  | "Movie Club";

export type Mood =
  | "Thrilling"
  | "Relaxing"
  | "Romantic"
  | "Dark"
  | "Uplifting"
  | "Emotional"
  | "Thought-Provoking"
  | "Fun"
  | "Intense";

export interface WatchExperience {
  platform: WatchPlatform;
  context: WatchContext;
  mood: Mood;
}

export interface WatchExperienceRecord extends WatchExperience {
  id: string;
  userId: string;
  tmdbId: string;
  watchedAt: string;
  updatedAt: string;
}

export interface WatchEntry {
  platform: WatchPlatform;
  context: WatchContext;
  date: string;
  mood: Mood;
}

export interface CastMember {
  name: string;
  role: string;
  avatar: string;
}

export interface Reply {
  id: string;
  user: UserProfile;
  comment: string;
  date: string;
  likes: number;
  likedByMe?: boolean;
}

export type ReviewTone = "funny" | "serious" | "analytical" | "casual";

export interface Review {
  id: string;
  movieId?: string;
  user: UserProfile;
  rating: number;
  comment: string;
  date: string;
  likes: number;
  likedByMe?: boolean;
  helpfulCount?: number;
  helpfulByMe?: boolean;
  tone?: ReviewTone;
  isSpoiler?: boolean;
  replies: Reply[];
}

export interface Movie {
  id: string;
  title: string;
  releaseDate?: string;
  year: number;
  rating: number;
  genre: string;
  poster: string;
  synopsis: string;
  director: string;
  cast: CastMember[];
  reviews: Review[];
  tags: string[];
  streamingOn: string[];
  runtime: number;
  language: string;
  country: string;
  moods: Mood[];
}

export interface UserProfile {
  id: string;
  email?: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  reviewCount: number;
  watchlistCount: number;
  favoriteMovies: string[];
  isFollowing?: boolean;
}

export interface ActivityItem {
  id: string;
  user: UserProfile;
  action: "reviewed" | "watched" | "added_to_watchlist" | "liked";
  movie: Movie;
  rating?: number;
  comment?: string;
  date: string;
}

export interface NotificationItem {
  id: string;
  type: "follow" | "review_like" | "review_reply" | "discussion_created" | "discussion_like" | "discussion_reply" | "event_created" | "shared_list_like" | "shared_list_comment" | "group_invite" | "recommendation";
  user: UserProfile | null;
  message: string;
  date: string;
  read: boolean;
  movieId?: string;
  reviewId?: string;
  discussionId?: string;
  eventId?: string;
  sharedListId?: string;
  groupId?: string;
}

export interface Message {
  id: string;
  from: UserProfile;
  to?: UserProfile;
  fromId?: string;
  toId?: string;
  text: string;
  date: string;
  isRead?: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: { moods?: Mood[]; genres?: string[]; minRuntime?: number; maxRuntime?: number };
}

export interface UserStats {
  totalWatched: number;
  totalHours: number;
  avgRating: number;
  favoriteGenre: string;
  topDirector: string;
  longestStreak: number;
  countriesExplored: number;
  activityStart?: string | null;
  activityEnd?: string | null;
  monthlyBreakdown: Array<{ month: string; count: number }>;
  genreBreakdown: Array<{ genre: string; count: number; pct: number }>;
  ratingDistribution: Array<{ stars: number; count: number }>;
  moodBreakdown: Array<{ mood: Mood; count: number }>;
  platformBreakdown: Array<{ platform: WatchPlatform; count: number }>;
  contextBreakdown: Array<{ context: WatchContext; count: number }>;
  weekdayBreakdown: Array<{ day: string; count: number }>;
}