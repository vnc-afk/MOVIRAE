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
      id: true,
      email: true,
      name: true,
      username: true,
      displayName: true,
      avatar: true,
      image: true,
      bio: true,
    },
  });
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

export function serializeDiscussion(discussion: any, currentUserId?: string | null): DiscussionRecord {
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

export async function fetchGroupDiscussions(groupId: string, currentUser: CurrentUser | null) {
  const discussions = await prisma.groupDiscussion.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      author: {
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          displayName: true,
          avatar: true,
          image: true,
          bio: true,
        },
      },
      title: true,
      body: true,
      createdAt: true,
      likes: true,
      replies: true,
      likedBy: true,
      replyItems: true,
      pinned: true,
      movieId: true,
    },
  });

  return discussions.map((discussion) => serializeDiscussion(discussion, currentUser?.id));
}

async function normalizeGroupMovie(movie: any): Promise<Movie> {
  const metadata = movie.metadata && typeof movie.metadata === "object" ? (movie.metadata as Record<string, unknown>) : null;

  if (metadata) {
    const metadataId = typeof metadata.id === "string" && metadata.id.trim() ? metadata.id : movie.tmdbId;
    const title = typeof metadata.title === "string" ? metadata.title : "";

    if (title.trim()) {
      return {
        id: metadataId,
        title,
        year: typeof metadata.year === "number" ? metadata.year : 0,
        rating: typeof metadata.rating === "number" ? metadata.rating : 0,
        genre: typeof metadata.genre === "string" ? metadata.genre : "Unknown",
        poster: typeof metadata.poster === "string" ? metadata.poster : "",
        synopsis: typeof metadata.synopsis === "string" ? metadata.synopsis : "",
        director: typeof metadata.director === "string" ? metadata.director : "Unknown",
        cast: Array.isArray(metadata.cast) ? (metadata.cast as any[]) : [],
        reviews: Array.isArray(metadata.reviews) ? (metadata.reviews as any[]) : [],
        tags: Array.isArray(metadata.tags) ? (metadata.tags as string[]) : [],
        streamingOn: Array.isArray(metadata.streamingOn) ? (metadata.streamingOn as string[]) : [],
        runtime: typeof metadata.runtime === "number" ? metadata.runtime : 0,
        language: typeof metadata.language === "string" ? metadata.language : "Unknown",
        country: typeof metadata.country === "string" ? metadata.country : "Unknown",
        moods: Array.isArray(metadata.moods) ? (metadata.moods as any[]) : [],
      };
    }
  }

  const tmdbDetails = await getMovieDetails(movie.tmdbId);
  if (tmdbDetails) {
    return tmdbDetails;
  }

  return {
    id: typeof metadata?.id === "string" && metadata.id.trim() ? metadata.id : movie.tmdbId,
    title: typeof metadata?.title === "string" ? metadata.title : "Unknown",
    year: typeof metadata?.year === "number" ? metadata.year : typeof metadata?.year === "string" && !Number.isNaN(Number(metadata.year)) ? Number(metadata.year) : 0,
    rating: typeof metadata?.rating === "number" ? metadata.rating : 0,
    genre: typeof metadata?.genre === "string" ? metadata.genre : "Unknown",
    poster: typeof metadata?.poster === "string" ? metadata.poster : "",
    synopsis: typeof metadata?.synopsis === "string" ? metadata.synopsis : "",
    director: typeof metadata?.director === "string" ? metadata.director : "Unknown",
    cast: Array.isArray(metadata?.cast) ? (metadata.cast as any[]) : [],
    reviews: Array.isArray(metadata?.reviews) ? (metadata.reviews as any[]) : [],
    tags: Array.isArray(metadata?.tags) ? (metadata.tags as string[]) : [],
    streamingOn: Array.isArray(metadata?.streamingOn) ? (metadata.streamingOn as string[]) : [],
    runtime: typeof metadata?.runtime === "number" ? metadata.runtime : typeof metadata?.runtime === "string" && !Number.isNaN(Number(metadata.runtime)) ? Number(metadata.runtime) : 0,
    language: typeof metadata?.language === "string" ? metadata.language : "Unknown",
    country: typeof metadata?.country === "string" ? metadata.country : "Unknown",
    moods: Array.isArray(metadata?.moods) ? (metadata.moods as any[]) : [],
  };
}

export async function fetchGroupDetail(groupId: string, currentUser: CurrentUser | null) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      creatorId: true,
      members: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              username: true,
              displayName: true,
              avatar: true,
              image: true,
              bio: true,
            },
          },
        },
      },
      movies: {
        select: {
          tmdbId: true,
          metadata: true,
        },
      },
      discussions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          author: {
            select: {
              id: true,
              email: true,
              name: true,
              username: true,
              displayName: true,
              avatar: true,
              image: true,
              bio: true,
            },
          },
          title: true,
          body: true,
          createdAt: true,
          likes: true,
          replies: true,
          likedBy: true,
          replyItems: true,
          pinned: true,
          movieId: true,
        },
      },
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