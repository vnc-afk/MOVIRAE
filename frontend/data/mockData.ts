import poster1 from "@/assets/poster1.jpg";
import poster2 from "@/assets/poster2.jpg";
import poster3 from "@/assets/poster3.jpg";
import poster4 from "@/assets/poster4.jpg";
import poster5 from "@/assets/poster5.jpg";
import poster6 from "@/assets/poster6.jpg";

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
  user: UserProfile;
  rating: number;
  comment: string;
  date: string;
  likes: number;
  replies: Reply[];
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  reviewCount: number;
  watchlistCount: number;
  favoriteMovies: string[];
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
  members: UserProfile[];
  sharedList: Movie[];
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

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

export const users: UserProfile[] = [
  {
    id: "1",
    username: "cinephile_alex",
    displayName: "Alex Chen",
    avatar: avatarUrl("alex"),
    bio: "Film critic & eternal optimist. 🎬",
    followers: 1243,
    following: 342,
    reviewCount: 187,
    watchlistCount: 56,
    favoriteMovies: ["1", "3", "5"],
  },
  {
    id: "2",
    username: "movie_maven",
    displayName: "Sarah Kim",
    avatar: avatarUrl("sarah"),
    bio: "Horror enthusiast. Watches everything.",
    followers: 892,
    following: 201,
    reviewCount: 134,
    watchlistCount: 89,
    favoriteMovies: ["4", "1"],
  },
  {
    id: "3",
    username: "reeltalks",
    displayName: "Marcus Reid",
    avatar: avatarUrl("marcus"),
    bio: "Sci-fi nerd & soundtrack collector.",
    followers: 567,
    following: 445,
    reviewCount: 76,
    watchlistCount: 23,
    favoriteMovies: ["3", "6"],
  },
];

const castPool: CastMember[] = [
  { name: "Emma Stone", role: "Lead", avatar: avatarUrl("emma") },
  { name: "Oscar Isaac", role: "Supporting", avatar: avatarUrl("oscar") },
  { name: "Florence Pugh", role: "Lead", avatar: avatarUrl("florence") },
  { name: "Dev Patel", role: "Supporting", avatar: avatarUrl("dev") },
  { name: "Saoirse Ronan", role: "Lead", avatar: avatarUrl("saoirse") },
  { name: "Pedro Pascal", role: "Supporting", avatar: avatarUrl("pedro") },
];

const streamingPlatforms = ["Netflix", "Amazon Prime", "Hulu", "Disney+", "Apple TV+", "HBO Max"];
const tagPool = ["mind-bending", "atmospheric", "slow-burn", "feel-good", "dark", "visually-stunning", "gripping", "emotional", "action-packed", "indie", "cult-classic", "award-winner"];

export const movies: Movie[] = [
  {
    id: "1",
    title: "Midnight Rain",
    year: 2025,
    rating: 4.2,
    genre: "Thriller",
    poster: poster1.src,
    synopsis: "A detective navigates the rain-slicked streets of a neon-lit city to unravel a conspiracy that reaches the highest echelons of power.",
    director: "Denis Villeneuve",
    cast: castPool.slice(0, 4),
    reviews: [],
    tags: ["atmospheric", "dark", "gripping"],
    streamingOn: ["Netflix", "Amazon Prime"],
    runtime: 142,
  },
  {
    id: "2",
    title: "Golden Horizon",
    year: 2024,
    rating: 3.8,
    genre: "Romance",
    poster: poster2.src,
    synopsis: "Two strangers meet on a sun-drenched coast and discover that love can bloom in the most unexpected places.",
    director: "Greta Gerwig",
    cast: castPool.slice(1, 5),
    reviews: [],
    tags: ["feel-good", "emotional", "visually-stunning"],
    streamingOn: ["Hulu", "Apple TV+"],
    runtime: 118,
  },
  {
    id: "3",
    title: "Cosmic Drift",
    year: 2025,
    rating: 4.5,
    genre: "Sci-Fi",
    poster: poster3.src,
    synopsis: "An astronaut adrift near an alien planet must confront the boundaries of human understanding to find a way home.",
    director: "Christopher Nolan",
    cast: castPool.slice(2, 6),
    reviews: [],
    tags: ["mind-bending", "visually-stunning", "slow-burn"],
    streamingOn: ["HBO Max"],
    runtime: 169,
  },
  {
    id: "4",
    title: "The Hollow",
    year: 2024,
    rating: 3.5,
    genre: "Horror",
    poster: poster4.src,
    synopsis: "A family inherits a decaying mansion only to discover that some doors were never meant to be opened.",
    director: "Ari Aster",
    cast: castPool.slice(0, 3),
    reviews: [],
    tags: ["dark", "atmospheric", "slow-burn"],
    streamingOn: ["Amazon Prime", "Hulu"],
    runtime: 131,
  },
  {
    id: "5",
    title: "Sky Legends",
    year: 2025,
    rating: 4.0,
    genre: "Animation",
    poster: poster5.src,
    synopsis: "In a magical world of flying creatures, a young adventurer must unite warring tribes to save their homeland.",
    director: "Hayao Miyazaki",
    cast: castPool.slice(3, 6),
    reviews: [],
    tags: ["feel-good", "visually-stunning", "emotional"],
    streamingOn: ["Disney+", "Netflix"],
    runtime: 105,
  },
  {
    id: "6",
    title: "Blaze Runner",
    year: 2024,
    rating: 3.9,
    genre: "Action",
    poster: poster6.src,
    synopsis: "An ex-driver is pulled back into the underground racing world for one last high-stakes heist across the city.",
    director: "George Miller",
    cast: castPool.slice(0, 4),
    reviews: [],
    tags: ["action-packed", "gripping", "visually-stunning"],
    streamingOn: ["Apple TV+", "HBO Max"],
    runtime: 128,
  },
];

// Populate reviews with replies
movies.forEach((movie) => {
  movie.reviews = [
    {
      id: `${movie.id}-r1`,
      user: users[0],
      rating: movie.rating + (Math.random() * 0.5 - 0.25),
      comment: `${movie.title} is a masterclass in storytelling. Every frame feels intentional and the performances are electric.`,
      date: "2025-03-15",
      likes: 42,
      replies: [
        { id: `${movie.id}-r1-rp1`, user: users[1], comment: "Couldn't agree more! The cinematography was breathtaking.", date: "2025-03-16", likes: 8 },
        { id: `${movie.id}-r1-rp2`, user: users[2], comment: "I think you're overrating it a bit, but still a solid watch.", date: "2025-03-16", likes: 3 },
      ],
    },
    {
      id: `${movie.id}-r2`,
      user: users[1],
      rating: movie.rating - 0.3,
      comment: `Solid film with great atmosphere, though the pacing drags in the second act. Still worth a watch.`,
      date: "2025-03-10",
      likes: 18,
      replies: [
        { id: `${movie.id}-r2-rp1`, user: users[0], comment: "Fair point about the pacing. Second act could've been tighter.", date: "2025-03-11", likes: 5 },
      ],
    },
  ];
});

export const activityFeed: ActivityItem[] = [
  { id: "a1", user: users[0], action: "reviewed", movie: movies[0], rating: 4.5, comment: "An absolute stunner. Best thriller of the year.", date: "2 hours ago" },
  { id: "a2", user: users[1], action: "watched", movie: movies[3], date: "4 hours ago" },
  { id: "a3", user: users[2], action: "added_to_watchlist", movie: movies[2], date: "6 hours ago" },
  { id: "a4", user: users[0], action: "liked", movie: movies[4], date: "8 hours ago" },
  { id: "a5", user: users[1], action: "reviewed", movie: movies[5], rating: 3.5, comment: "Fun ride but doesn't break new ground.", date: "1 day ago" },
];

export const groups: Group[] = [
  {
    id: "g1",
    name: "Neon Noir Club",
    description: "For fans of neo-noir and dark thrillers. We watch and discuss weekly.",
    memberCount: 234,
    avatar: avatarUrl("neonclub"),
    members: users,
    sharedList: [movies[0], movies[3]],
  },
  {
    id: "g2",
    name: "Sci-Fi Society",
    description: "Exploring the cosmos one film at a time. Monthly deep-dives into sci-fi classics.",
    memberCount: 567,
    avatar: avatarUrl("scifi"),
    members: [users[0], users[2]],
    sharedList: [movies[2], movies[5]],
  },
  {
    id: "g3",
    name: "Weekend Watchers",
    description: "Casual movie nights every Friday. All genres welcome!",
    memberCount: 89,
    avatar: avatarUrl("weekend"),
    members: [users[1], users[2]],
    sharedList: [movies[1], movies[4]],
  },
];

export const notifications: NotificationItem[] = [
  { id: "n1", type: "like", user: users[1], message: "liked your review of Midnight Rain", date: "5 min ago", read: false, movieId: "1" },
  { id: "n2", type: "reply", user: users[2], message: "replied to your review of Cosmic Drift", date: "1 hour ago", read: false, movieId: "3" },
  { id: "n3", type: "follow", user: users[1], message: "started following you", date: "3 hours ago", read: true },
  { id: "n4", type: "group_invite", user: users[2], message: "invited you to join Sci-Fi Society", date: "1 day ago", read: true },
  { id: "n5", type: "recommendation", user: users[0], message: "recommended The Hollow to you", date: "2 days ago", read: true, movieId: "4" },
];

export const messages: Message[] = [
  { id: "m1", from: users[1], text: "Hey! Have you seen Cosmic Drift yet? It's incredible.", date: "10:32 AM" },
  { id: "m2", from: users[0], text: "Not yet! It's on my watchlist. Should I bump it up?", date: "10:35 AM" },
  { id: "m3", from: users[1], text: "Absolutely. Nolan at his best. The final act will blow your mind.", date: "10:37 AM" },
  { id: "m4", from: users[0], text: "OK you've convinced me. Watching tonight! 🎬", date: "10:40 AM" },
];

export const userStats = {
  totalWatched: 187,
  totalHours: 412,
  avgRating: 3.8,
  favoriteGenre: "Thriller",
  topDirector: "Denis Villeneuve",
  monthlyBreakdown: [
    { month: "Jan", count: 12 },
    { month: "Feb", count: 15 },
    { month: "Mar", count: 18 },
    { month: "Apr", count: 10 },
    { month: "May", count: 22 },
    { month: "Jun", count: 14 },
    { month: "Jul", count: 20 },
    { month: "Aug", count: 16 },
    { month: "Sep", count: 11 },
    { month: "Oct", count: 19 },
    { month: "Nov", count: 13 },
    { month: "Dec", count: 17 },
  ],
  genreBreakdown: [
    { genre: "Thriller", count: 42, pct: 22 },
    { genre: "Sci-Fi", count: 35, pct: 19 },
    { genre: "Drama", count: 30, pct: 16 },
    { genre: "Horror", count: 25, pct: 13 },
    { genre: "Action", count: 20, pct: 11 },
    { genre: "Romance", count: 18, pct: 10 },
    { genre: "Animation", count: 17, pct: 9 },
  ],
  ratingDistribution: [
    { stars: 1, count: 5 },
    { stars: 2, count: 12 },
    { stars: 3, count: 38 },
    { stars: 4, count: 85 },
    { stars: 5, count: 47 },
  ],
};

export function getSimilarMovies(movieId: string): Movie[] {
  const movie = movies.find((m) => m.id === movieId);
  if (!movie) return [];
  return movies.filter(
    (m) => m.id !== movieId && (m.genre === movie.genre || m.director === movie.director || m.tags.some((t) => movie.tags.includes(t)))
  );
}

export function getRecommendations(): Movie[] {
  return [...movies].sort((a, b) => b.rating - a.rating);
}

export const allTags = [...new Set(movies.flatMap((m) => m.tags))];
export const allGenres = [...new Set(movies.map((m) => m.genre))];
