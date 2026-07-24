import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMovieDetails } from "@/lib/tmdb";
import { buildUserProfile, isProfileUser } from "@/lib/user-profiles";
import type { Group, Movie, UserProfile } from "@/lib/types";

type PrismaUser = Awaited<ReturnType<typeof prisma.user.findUnique>>;

/**
 * A single discussion reply normalized for the frontend.
 */
export interface DiscussionReplyRecord {
  id: string;
  author: UserProfile;
  body: string;
  date: string;
}

/**
 * Normalized discussion payload used by the UI.
 */
export interface DiscussionRecord {
  id: string;
  author: UserProfile;
  title: string;
  body: string;
  date: string;
  likes: number;
  replies: number;
  likedByMe: boolean;
  replyItems: DiscussionReplyRecord[];
  pinned?: boolean;
  movieId?: string;
}

export type GroupDetailRecord = Group & {
  discussions: DiscussionRecord[];
  joined: boolean;
};

export type CurrentUser = { id: string } | NonNullable<PrismaUser>;

const fallbackProfile: UserProfile = {
  id: "unknown",
  username: "unknown",
  displayName: "Unknown",
  avatar: "",
  bio: "",
  followers: 0,
  following: 0,
  reviewCount: 0,
  watchlistCount: 0,
  favoriteMovies: [],
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true, email: true, name: true, username: true,
      displayName: true, avatar: true, image: true, bio: true,
    },
  });
}

/**
 * Returns the current authenticated user record (server-side session lookup).
 * Returns `null` when not signed in.
 */

const userSelectForProfile = {
  id: true, email: true, name: true, username: true,
  displayName: true, avatar: true, image: true, bio: true,
} as const;

const discussionInclude = {
  author: { select: userSelectForProfile },
  likesRecords: { select: { userId: true } },
  replyRecords: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: userSelectForProfile } },
  },
};

function serializeDiscussionRow(
  discussion: {
    id: string;
    title: string;
    body: string;
    createdAt: Date;
    pinned: boolean;
    movieId: string | null;
    author?: unknown;
    likesRecords?: Array<{ userId: string }>;
    replyRecords?: Array<{ id: string; body: string; createdAt: Date; author?: unknown }>;
  },
  currentUserId?: string | null
): DiscussionRecord {
  // Map the DB row shape into the frontend-friendly DiscussionRecord.
  return {
    id: discussion.id,
    author: (isProfileUser(discussion.author) ? buildUserProfile(discussion.author) : null) ?? fallbackProfile,
    title: discussion.title,
    body: discussion.body,
    date: discussion.createdAt.toISOString(),
    likes: discussion.likesRecords?.length ?? 0,
    replies: discussion.replyRecords?.length ?? 0,
    likedByMe: currentUserId ? (discussion.likesRecords?.some((r) => r.userId === currentUserId) ?? false) : false,
    replyItems: (discussion.replyRecords ?? []).map((reply) => ({
      id: reply.id,
      author: (isProfileUser(reply.author) ? buildUserProfile(reply.author) : null) ?? fallbackProfile,
      body: reply.body,
      date: reply.createdAt.toISOString(),
    })),
    pinned: discussion.pinned,
    movieId: discussion.movieId ?? undefined,
  };
}

/**
 * Loads and serializes all discussions for a group.
 */
export async function fetchGroupDiscussions(groupId: string, currentUser: CurrentUser | null) {
  const discussions = await prisma.groupDiscussion.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    include: discussionInclude,
  });

  return discussions.map((discussion: Awaited<ReturnType<typeof prisma.groupDiscussion.findMany>>[number]) =>
    serializeDiscussionRow(discussion, currentUser?.id)
  );
}

/**
 * Fetches a single discussion by id and serializes it for the UI.
 */
export async function fetchDiscussionById(discussionId: string, currentUserId?: string | null) {
  const discussion = await prisma.groupDiscussion.findUnique({
    where: { id: discussionId },
    include: discussionInclude,
  });

  if (!discussion) return null;
  return serializeDiscussionRow(discussion, currentUserId);
}

async function normalizeGroupMovie(
  movie: { groupId?: string; tmdbId?: string | null; metadata?: any },
  index: number
): Promise<Movie> {

  try {
    const metadata = movie.metadata && typeof movie.metadata === "object" ? movie.metadata : null;

    if (metadata && typeof metadata.poster === "string" && metadata.poster.trim() !== "") {
      return metadata as Movie;
    }

    if (index < 3 && typeof movie.tmdbId === "string") {
      // For the first few items we attempt to fetch TMDB details to enrich the UI.
      const details = await getMovieDetails(movie.tmdbId);
      if (details) {
        if (movie.groupId) {
          // Cache enriched metadata back to the group movie row, ignore failures
          await prisma.groupMovie
            .update({
              where: { groupId_tmdbId: { groupId: movie.groupId, tmdbId: movie.tmdbId } },
              data: { metadata: details as unknown as Prisma.InputJsonValue },
            })
            .catch((err) => console.error("Failed to cache movie metadata:", err));
        }
        return details;
      }
    }

    return {
      id: typeof movie.tmdbId === "string" ? movie.tmdbId : typeof metadata?.id === "string" ? metadata.id : "unknown",
      title: typeof metadata?.title === "string" ? metadata.title : "Unknown",
      year: typeof metadata?.year === "number" ? metadata.year : 0,
      rating: typeof metadata?.rating === "number" ? metadata.rating : 0,
      genre: typeof metadata?.genre === "string" ? metadata.genre : "Unknown",
      poster: typeof metadata?.poster === "string" ? metadata.poster : "",
      synopsis: typeof metadata?.synopsis === "string" ? metadata.synopsis : "",
      director: typeof metadata?.director === "string" ? metadata.director : "Unknown",
      cast: Array.isArray(metadata?.cast) ? metadata.cast : [],
      reviews: Array.isArray(metadata?.reviews) ? metadata.reviews : [],
      tags: Array.isArray(metadata?.tags) ? metadata.tags : [],
      streamingOn: Array.isArray(metadata?.streamingOn) ? metadata.streamingOn : [],
      runtime: typeof metadata?.runtime === "number" ? metadata.runtime : 0,
      language: typeof metadata?.language === "string" ? metadata.language : "Unknown",
      country: typeof metadata?.country === "string" ? metadata.country : "Unknown",
      moods: Array.isArray(metadata?.moods) ? metadata.moods : [],
    };
  } catch (err) {
    console.error(`normalizeGroupMovie failed for tmdbId ${movie.tmdbId}:`, err);
    return {
      id: typeof movie.tmdbId === "string" ? movie.tmdbId : "unknown",
      title: "Unavailable",
      year: 0,
      rating: 0,
      genre: "Unknown",
      poster: "",
      synopsis: "",
      director: "Unknown",
      cast: [],
      reviews: [],
      tags: [],
      streamingOn: [],
      runtime: 0,
      language: "Unknown",
      country: "Unknown",
      moods: [],
    };
  }
}

export async function fetchGroupDetail(groupId: string, currentUser: CurrentUser | null): Promise<GroupDetailRecord | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: { select: userSelectForProfile } },
      },
      movies: true,
      discussions: {
        include: discussionInclude,
      },
    },
  });

  if (!group) return null;

  const currentUserId = currentUser?.id;
  const memberIds = group.members
    .map((member) => member.userId)
    .filter((memberId): memberId is string => Boolean(memberId));

  const followedMemberIds = currentUserId && memberIds.length > 0
    ? new Set(
        (
          await prisma.userFollow.findMany({
            where: {
              followerId: currentUserId,
              followingId: { in: memberIds },
            },
            select: { followingId: true },
          })
        ).map((follow) => follow.followingId)
      )
    : new Set<string>();

  const [sharedList, discussions] = await Promise.all([
    Promise.all(group.movies.map((movie, index) => normalizeGroupMovie(movie, index))),
    Promise.all(group.discussions.map((discussion) => serializeDiscussionRow(discussion, currentUserId))),
  ]);

  return {
    ...group,
    description: group.description ?? "",
    memberCount: group.members.length,
    avatar: group.avatar ?? "",
    members: group.members
      .map((member) => {
        if (!member.user) return null;

        return buildUserProfile(
          member.user as any,
          followedMemberIds.has(member.user.id)
        );
      })
      .filter((member): member is NonNullable<ReturnType<typeof buildUserProfile>> => Boolean(member)),
    sharedList,
    discussions,
    joined: currentUserId ? group.members.some((member) => member.userId === currentUserId) : false,
  } as GroupDetailRecord;
}

export async function createDiscussion(groupId: string, input: { title: string; body: string; movieId?: string }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "unauthorized" as const };

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "not-found" as const };

  await prisma.groupDiscussion.create({
    data: {
      groupId,
      authorId: currentUser.id,
      title: input.title,
      body: input.body,
      movieId: input.movieId,
      likes: 0,
      replies: 0,
    },
  });

  // Return the updated group detail so callers can refresh their UI state.
  return { value: await fetchGroupDetail(groupId, currentUser) } as const;
}

export async function toggleDiscussionLike(groupId: string, discussionId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "unauthorized" as const };

  const discussion = await prisma.groupDiscussion.findFirst({
    where: { id: discussionId, groupId },
    select: { id: true },
  });
  if (!discussion) return { error: "not-found" as const };

  const existingLike = await prisma.groupDiscussionLike.findUnique({
    where: { discussionId_userId: { discussionId, userId: currentUser.id } },
  });

  await prisma.$transaction(async (tx) => {
    if (existingLike) {
      await tx.groupDiscussionLike.delete({
        where: { discussionId_userId: { discussionId, userId: currentUser.id } },
      });
      await tx.groupDiscussion.update({ where: { id: discussionId }, data: { likes: { decrement: 1 } } });
    } else {
      await tx.groupDiscussionLike.create({
        data: { discussionId, userId: currentUser.id },
      });
      await tx.groupDiscussion.update({ where: { id: discussionId }, data: { likes: { increment: 1 } } });
    }
  });

  const updated = await fetchDiscussionById(discussionId, currentUser.id);
  if (!updated) return { error: "not-found" as const };
  return { value: updated } as const;
}

export async function addDiscussionReply(groupId: string, discussionId: string, body: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "unauthorized" as const };

  const discussion = await prisma.groupDiscussion.findFirst({
    where: { id: discussionId, groupId },
    select: { id: true },
  });
  if (!discussion) return { error: "not-found" as const };

  await prisma.$transaction([
    prisma.groupDiscussionReply.create({
      data: { discussionId, authorId: currentUser.id, body },
    }),
    prisma.groupDiscussion.update({
      where: { id: discussionId },
      data: { replies: { increment: 1 } },
    }),
  ]);

  const updated = await fetchDiscussionById(discussionId, currentUser.id);
  if (!updated) return { error: "not-found" as const };
  return { value: updated } as const;
}