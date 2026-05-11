import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  likedBy: string[];
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

export function buildUserProfile(user: any) {
  if (!user) return null;

  const displayName = user.displayName || user.name || user.email?.split("@")[0] || "Movie Lover";
  const username = user.username || displayName.toLowerCase().replace(/\s+/g, "_");

  return {
    id: user.id,
    email: user.email || undefined,
    username,
    displayName,
    avatar: user.avatar || user.image || "",
    bio: user.bio || "",
    followers: 0,
    following: 0,
    reviewCount: 0,
    watchlistCount: 0,
    favoriteMovies: [],
  } satisfies UserProfile;
}

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
      author: buildUserProfile(reply.author) ?? buildUserProfile(reply.user) ?? buildUserProfile(reply.authorProfile) ?? fallbackProfile,
      body: typeof reply.body === "string" ? reply.body : typeof reply.comment === "string" ? reply.comment : "",
      date: typeof reply.date === "string" ? reply.date : new Date().toISOString(),
    }));
}

function serializeDiscussion(discussion: any): DiscussionRecord {
  return {
    id: discussion.id,
    author: buildUserProfile(discussion.author) ?? fallbackProfile,
    title: discussion.title,
    body: discussion.body,
    date: discussion.createdAt.toISOString(),
    likes: discussion.likes,
    replies: discussion.replies,
    likedBy: normalizeLikedBy(discussion.likedBy),
    replyItems: normalizeReplyItems(discussion.replyItems),
    pinned: discussion.pinned,
    movieId: discussion.movieId ?? undefined,
  };
}

export async function fetchGroupDetail(groupId: string, currentUser: CurrentUser | null) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: true } },
      movies: true,
      discussions: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!group) return null;

  const members = group.members
    .map((member) => buildUserProfile(member.user))
    .filter(Boolean) as UserProfile[];

  return {
    id: group.id,
    name: group.name,
    description: group.description || "",
    memberCount: group.members.length,
    avatar: group.avatar || "",
    members,
    sharedList: group.movies.map((movie) => movie.metadata ?? ({ id: movie.tmdbId } as Movie)) as Movie[],
    discussions: group.discussions.map(serializeDiscussion),
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