import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMovieDetails } from "@/lib/tmdb";
import { buildUserProfile, isProfileUser } from "@/lib/user-profiles";
import type { Group, Movie, UserProfile } from "@/lib/types";

type PrismaUser = Awaited<ReturnType<typeof prisma.user.findUnique>>;

export interface DiscussionReplyRecord {
  id: string;
  author: UserProfile;
  body: string;
  date: string;
}

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

export type CurrentUser = NonNullable<PrismaUser>;

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

  return prisma.user.findUnique({ where: { email: session.user.email } });
}

function normalizeLikedBy(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeReplyItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((reply, index) => ({
      id: typeof reply.id === "string" ? reply.id : `reply-${Date.now()}-${index}`,
      author:
        (
          isProfileUser(reply.author)
            ? buildUserProfile(reply.author)
            : isProfileUser(reply.user)
            ? buildUserProfile(reply.user)
            : isProfileUser(reply.authorProfile)
            ? buildUserProfile(reply.authorProfile)
            : null
        ) ?? fallbackProfile,
      body: typeof reply.body === "string" ? reply.body : typeof reply.comment === "string" ? reply.comment : "",
      date: typeof reply.date === "string" ? reply.date : new Date().toISOString(),
    }));
}

function serializeDiscussion(discussion: any, currentUserId?: string | null): DiscussionRecord {
  const likedBy = normalizeLikedBy(discussion.likedBy);
  return {
    id: discussion.id,
    author: (isProfileUser(discussion.author) ? buildUserProfile(discussion.author) : null) ?? fallbackProfile,
    title: discussion.title,
    body: discussion.body,
    date: discussion.createdAt.toISOString(),
    likes: discussion.likes,
    replies: discussion.replies,
    likedByMe: currentUserId ? likedBy.includes(currentUserId) : false,
    replyItems: normalizeReplyItems(discussion.replyItems),
    pinned: discussion.pinned,
    movieId: discussion.movieId ?? undefined,
  };
}

async function normalizeGroupMovie(movie: any): Promise<Movie> {
  const metadata = movie.metadata && typeof movie.metadata === "object" ? movie.metadata : null;

  if (metadata && typeof metadata.poster === "string" && metadata.poster.trim() !== "") {
    return metadata as Movie;
  }

  const tmdbDetails = await getMovieDetails(movie.tmdbId);
  if (tmdbDetails) {
    return tmdbDetails;
  }

  return {
    id: movie.tmdbId,
    title: metadata?.title || "Unknown",
    year: metadata?.year || 0,
    rating: metadata?.rating || 0,
    genre: metadata?.genre || "Unknown",
    poster: metadata?.poster || "",
    synopsis: metadata?.synopsis || "",
    director: metadata?.director || "Unknown",
    cast: metadata?.cast || [],
    reviews: metadata?.reviews || [],
    tags: metadata?.tags || [],
    streamingOn: metadata?.streamingOn || [],
    runtime: metadata?.runtime || 0,
    language: metadata?.language || "Unknown",
    country: metadata?.country || "Unknown",
    moods: metadata?.moods || [],
  };
}

export async function fetchGroupDetail(groupId: string, currentUser: CurrentUser | null) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { include: { _count: { select: { followers: true, followings: true, reviews: true, watchlist: true } } } } } },
      movies: true,
      discussions: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!group) return null;

  const memberIds = group.members.map((member) => member.userId);
  const followingIds = currentUser
    ? new Set(
        (
          await prisma.userFollow.findMany({
            where: {
              followerId: currentUser.id,
              followingId: { in: memberIds },
            },
            select: { followingId: true },
          })
        ).map((follow) => follow.followingId)
      )
    : new Set<string>();

  const members = group.members
    .map((member) => {
      const profile = buildUserProfile(member.user);
      if (!profile) return null;

      return {
        ...profile,
        isFollowing: followingIds.has(member.userId),
      } as UserProfile;
    })
    .filter(Boolean) as UserProfile[];

  const sharedList = await Promise.all(
    group.movies.map((movie) => normalizeGroupMovie(movie))
  );

  return {
    id: group.id,
    name: group.name,
    description: group.description || "",
    memberCount: group.members.length,
    avatar: group.avatar || "",
    creatorId: group.creatorId,
    members,
    sharedList,
    discussions: group.discussions.map((discussion) => serializeDiscussion(discussion, currentUser?.id)),
    joined: currentUser ? group.members.some((member) => member.userId === currentUser.id) : false,
  } satisfies GroupDetailRecord;
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
      likedBy: [],
      replyItems: [],
    },
  });

  return { value: await fetchGroupDetail(groupId, currentUser) } as const;
}

export async function toggleDiscussionLike(groupId: string, discussionId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "unauthorized" as const };

  const discussion = await prisma.groupDiscussion.findFirst({
    where: { id: discussionId, groupId },
  });

  if (!discussion) return { error: "not-found" as const };

  const likedBy = normalizeLikedBy(discussion.likedBy);
  const nextLikedBy = likedBy.includes(currentUser.id)
    ? likedBy.filter((userId) => userId !== currentUser.id)
    : [...likedBy, currentUser.id];

  await prisma.groupDiscussion.update({
    where: { id: discussionId },
    data: {
      likes: nextLikedBy.length,
      likedBy: nextLikedBy,
    },
  });

  return { value: await fetchGroupDetail(groupId, currentUser) } as const;
}

export async function addDiscussionReply(groupId: string, discussionId: string, body: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "unauthorized" as const };

  const discussion = await prisma.groupDiscussion.findFirst({
    where: { id: discussionId, groupId },
  });

  if (!discussion) return { error: "not-found" as const };

  const replyItems = normalizeReplyItems(discussion.replyItems);
  const nextReplyItems = [
    ...replyItems,
    {
      id: `reply-${Date.now()}`,
      author: buildUserProfile(currentUser)!,
      body,
      date: new Date().toISOString(),
    },
  ];

  await prisma.groupDiscussion.update({
    where: { id: discussionId },
    data: {
      replies: nextReplyItems.length,
      replyItems: nextReplyItems as any,
    },
  });

  return { value: await fetchGroupDetail(groupId, currentUser) } as const;
}