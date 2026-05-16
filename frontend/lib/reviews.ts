import { prisma } from "@/lib/prisma";
import type { Reply, Review, UserProfile } from "@/lib/types";

type PrismaUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  image?: string | null;
  bio?: string | null;
};

export function buildUserProfile(user: PrismaUser | null | undefined): UserProfile {
  const displayName = user?.displayName || user?.name || "Movie Lover";
  const username = user?.username || displayName.toLowerCase().replace(/\s+/g, "_");

  return {
    id: user?.id || "",
    email: user?.email || undefined,
    username,
    displayName,
    avatar: user?.avatar || user?.image || "",
    bio: user?.bio || "",
    followers: 0,
    following: 0,
    reviewCount: 0,
    watchlistCount: 0,
    favoriteMovies: [],
  };
}

export async function getWatchedMovieIds(userId: string) {
  const data = await prisma.appData.findUnique({ where: { key: `user-watched-${userId}` } });

  if (!data?.value || !Array.isArray(data.value)) {
    return [] as string[];
  }

  return data.value.filter((item: unknown) => typeof item === "string").map(String);
}

export async function canReviewMovie(userId: string, tmdbId: string) {
  const watched = await getWatchedMovieIds(userId);
  return watched.includes(tmdbId);
}

export function serializeReply(reply: any, currentUserId?: string | null): Reply {
  const likedByMe = currentUserId && Array.isArray(reply.likesRecords)
    ? reply.likesRecords.some((record: { userId?: string }) => record.userId === currentUserId)
    : false;

  return {
    id: reply.id,
    user: buildUserProfile(reply.user),
    comment: typeof reply.comment === "string" ? reply.comment : "",
    date: reply.createdAt instanceof Date ? reply.createdAt.toISOString() : new Date(reply.createdAt).toISOString(),
    likes: typeof reply.likes === "number" ? reply.likes : 0,
    likedByMe,
  };
}

export function serializeReview(review: any, currentUserId?: string | null, likedByMeOverride?: boolean): Review & { movieId?: string } {
  const likedByMe = typeof likedByMeOverride === "boolean"
    ? likedByMeOverride
    : currentUserId && Array.isArray(review.likesRecords)
      ? review.likesRecords.some((record: { userId?: string }) => record.userId === currentUserId)
      : false;

  return {
    id: review.id,
    movieId: review.tmdbId,
    user: buildUserProfile(review.user),
    rating: review.rating,
    comment: typeof review.comment === "string" ? review.comment : "",
    date: review.createdAt instanceof Date ? review.createdAt.toISOString() : new Date(review.createdAt).toISOString(),
    likes: typeof review.likes === "number" ? review.likes : 0,
    likedByMe,
    replies: Array.isArray(review.replies) ? review.replies.map((reply: any) => serializeReply(reply, currentUserId)) : [],
  };
}
