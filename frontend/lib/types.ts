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
  | "Thought-Provoking"
  | "Fun"
  | "Intense";

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
}

export interface Review {
  id: string;
  movieId?: string;
  user: UserProfile;
  rating: number;
  comment: string;
  date: string;
  likes: number;
  likedByMe?: boolean;
  replies: Reply[];
}

export interface Movie {
  id: string;
  title: string;
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

export interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  avatar: string;
  creatorId: string;
  members: UserProfile[];
  sharedList: Movie[];
}

export interface SharedList {
  id: string;
  name: string;
  description: string;
  visibility: "public" | "private" | "group";
  owner: UserProfile;
  collaborators: UserProfile[];
  movies: Movie[];
  likes: number;
  likedByMe?: boolean;
  comments: number;
  commentItems?: SharedListComment[];
  createdAt: string;
  groupId?: string;
}

export interface SharedListComment {
  id: string;
  user: UserProfile;
  body: string;
  date: string;
  parentId?: string | null;
  replies: SharedListComment[];
}

export interface NotificationItem {
  id: string;
  type: "like" | "reply" | "follow" | "group_invite" | "recommendation";
  user: UserProfile;
  message: string;
  date: string;
  read: boolean;
  movieId?: string;
}

export interface Message {
  id: string;
  from: UserProfile;
  text: string;
  date: string;
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
  monthlyBreakdown: Array<{ month: string; count: number }>;
  genreBreakdown: Array<{ genre: string; count: number; pct: number }>;
  ratingDistribution: Array<{ stars: number; count: number }>;
  moodBreakdown: Array<{ mood: Mood; count: number }>;
  platformBreakdown: Array<{ platform: WatchPlatform; count: number }>;
  contextBreakdown: Array<{ context: WatchContext; count: number }>;
  weekdayBreakdown: Array<{ day: string; count: number }>;
}