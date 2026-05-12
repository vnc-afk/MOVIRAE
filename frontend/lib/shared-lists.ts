import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { buildUserProfile } from "@/lib/group-discussions";
import { prisma } from "@/lib/prisma";
import { getMovieDetails } from "@/lib/tmdb";
import type { Movie, SharedList, SharedListComment, UserProfile } from "@/lib/types";

type CurrentUser = Awaited<ReturnType<typeof prisma.user.findUnique>>;

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

type SharedListCommentRow = {
  id: string;
  sharedListId: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  user: any;
};

type SharedListLikeRow = {
  userId: string;
};

type SharedListRow = {
  id: string;
  ownerId: string;
  owner: any;
  collaborators: Array<{ user: any }>;
  movies: Array<{ tmdbId: string; metadata: Movie | null }>;
  likesRecords: SharedListLikeRow[];
  commentRecords: SharedListCommentRow[];
  name: string;
  description: string;
  visibility: "public" | "private" | "group";
  likes: number;
  comments: number;
  createdAt: Date;
  groupId: string | null;
};

function normalizeCommentTree(rows: SharedListCommentRow[]) {
  const commentMap = new Map<string, SharedListComment>();
  const rootComments: SharedListComment[] = [];

  for (const row of rows) {
    const profile = buildUserProfile(row.user) ?? ({
      id: row.userId,
      username: "unknown",
      displayName: "Unknown",
      avatar: "",
      bio: "",
      followers: 0,
      following: 0,
      reviewCount: 0,
      watchlistCount: 0,
      favoriteMovies: [],
    } satisfies UserProfile);

    commentMap.set(row.id, {
      id: row.id,
      user: profile,
      body: row.body,
      date: row.createdAt.toISOString(),
      parentId: row.parentId,
      replies: [],
    });
  }

  for (const row of rows) {
    const comment = commentMap.get(row.id);
    if (!comment) continue;

    if (row.parentId) {
      const parentComment = commentMap.get(row.parentId);
      if (parentComment) {
        parentComment.replies.push(comment);
        continue;
      }
    }

    rootComments.push(comment);
  }

  const sortTree = (items: SharedListComment[]) => {
    items.sort((left, right) => left.date.localeCompare(right.date));
    for (const item of items) {
      sortTree(item.replies);
    }
  };

  sortTree(rootComments);
  return rootComments;
}

function serializeSharedList(
  list: {
    id: string;
    owner: any;
    collaborators: Array<{ user: any }>;
    movies: Array<{ tmdbId: string; metadata: Movie | null }>;
    likesRecords: SharedListLikeRow[];
    commentRecords: SharedListCommentRow[];
    name: string;
    description: string;
    visibility: "public" | "private" | "group";
    likes: number;
    comments: number;
    createdAt: Date;
    groupId: string | null;
  },
  currentUser: CurrentUser | null
): SharedList {
  const likes = list.likesRecords.length;
  const commentItems = normalizeCommentTree(list.commentRecords);

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    visibility: list.visibility,
    owner: buildUserProfile(list.owner) ?? fallbackProfile,
    collaborators: list.collaborators
      .map((collaborator) => buildUserProfile(collaborator.user))
      .filter(Boolean) as UserProfile[],
    movies: list.movies.map((movie) => movie.metadata ?? ({ id: movie.tmdbId } as Movie)),
    likes,
    likedByMe: currentUser ? list.likesRecords.some((record) => record.userId === currentUser.id) : false,
    comments: commentItems.length,
    commentItems,
    createdAt: list.createdAt.toISOString(),
    groupId: list.groupId ?? undefined,
  };
}

function buildSharedListViewFilter(currentUser: CurrentUser | null): Prisma.SharedListWhereInput {
  if (!currentUser) {
    return { visibility: "public" };
  }

  return {
    OR: [
      { visibility: "public" },
      { ownerId: currentUser.id },
      {
        visibility: "group",
        group: {
          members: {
            some: {
              userId: currentUser.id,
            },
          },
        },
      },
    ],
  };
}

async function getSharedListForView(listId: string, currentUser: CurrentUser | null) {
  return prisma.sharedList.findFirst({
    where: {
      id: listId,
      ...(currentUser
        ? {
            OR: [
              { visibility: "public" },
              { ownerId: currentUser.id },
              {
                visibility: "group",
                group: {
                  members: {
                    some: {
                      userId: currentUser.id,
                    },
                  },
                },
              },
            ],
          }
        : { visibility: "public" }),
    },
    include: {
      owner: true,
      collaborators: { include: { user: true } },
      movies: true,
      likesRecords: true,
      commentRecords: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function getSharedListForEdit(listId: string, currentUser: CurrentUser | null) {
  if (!currentUser) return null;

  return prisma.sharedList.findFirst({
    where: {
      id: listId,
      OR: [
        { ownerId: currentUser.id },
        { collaborators: { some: { userId: currentUser.id } } },
      ],
    },
    include: {
      owner: true,
      collaborators: { include: { user: true } },
      movies: true,
      likesRecords: true,
      commentRecords: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

function isSharedListEditor(
  list: { ownerId: string; collaborators: Array<{ userId: string }> },
  currentUser: CurrentUser | null
) {
  if (!currentUser) return false;
  if (list.ownerId === currentUser.id) return true;
  return list.collaborators.some((collaborator) => collaborator.userId === currentUser.id);
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function fetchSharedLists(currentUser: CurrentUser | null) {
  const where = buildSharedListViewFilter(currentUser);
  const lists = await prisma.sharedList.findMany({
    where,
    include: {
      owner: true,
      collaborators: { include: { user: true } },
      movies: true,
      likesRecords: true,
      commentRecords: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return lists.map((list) => serializeSharedList(list as any, currentUser));
}

export async function createSharedList(
  input: { name: string; description: string; visibility: "public" | "private" | "group"; groupId?: string },
  currentUser: CurrentUser | null
) {
  if (!currentUser) return { error: "unauthorized" as const };

  await prisma.sharedList.create({
    data: {
      ownerId: currentUser.id,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      groupId: input.groupId,
    },
  });

  return { value: await fetchSharedLists(currentUser) } as const;
}

export async function deleteSharedList(listId: string, currentUser: CurrentUser | null) {
  if (!currentUser) return { error: "unauthorized" as const };

  const list = await prisma.sharedList.findUnique({ where: { id: listId } });
  if (!list) return { error: "not-found" as const };
  if (list.ownerId !== currentUser.id) return { error: "unauthorized" as const };

  await prisma.sharedList.delete({ where: { id: listId } });
  return { value: await fetchSharedLists(currentUser) } as const;
}

export async function toggleSharedListLike(listId: string, currentUser: CurrentUser | null) {
  if (!currentUser) return { error: "unauthorized" as const };

  const list = await getSharedListForView(listId, currentUser);
  if (!list) return { error: "not-found" as const };

  const existingLike = await prisma.sharedListLike.findUnique({
    where: { sharedListId_userId: { sharedListId: listId, userId: currentUser.id } },
  });

  await prisma.$transaction(async (tx) => {
    if (existingLike) {
      await tx.sharedListLike.delete({
        where: { sharedListId_userId: { sharedListId: listId, userId: currentUser.id } },
      });
      await tx.sharedList.update({ where: { id: listId }, data: { likes: { decrement: 1 } } });
      return;
    }

    await tx.sharedListLike.create({
      data: { sharedListId: listId, userId: currentUser.id },
    });
    await tx.sharedList.update({ where: { id: listId }, data: { likes: { increment: 1 } } });
  });

  return { value: await fetchSharedLists(currentUser) } as const;
}

export async function addSharedListComment(
  listId: string,
  body: string,
  currentUser: CurrentUser | null,
  parentId?: string
) {
  if (!currentUser) return { error: "unauthorized" as const };

  const list = await getSharedListForView(listId, currentUser);
  if (!list) return { error: "not-found" as const };

  if (parentId) {
    const parent = await prisma.sharedListComment.findFirst({ where: { id: parentId, sharedListId: listId } });
    if (!parent) return { error: "parent-not-found" as const };
  }

  await prisma.sharedListComment.create({
    data: {
      sharedListId: listId,
      userId: currentUser.id,
      body,
      parentId: parentId || null,
    },
  });

  await prisma.sharedList.update({ where: { id: listId }, data: { comments: { increment: 1 } } });

  return { value: await fetchSharedLists(currentUser) } as const;
}

export async function addSharedListMovie(listId: string, movieId: string, currentUser: CurrentUser | null) {
  if (!currentUser) return { error: "unauthorized" as const };

  const list = await prisma.sharedList.findUnique({
    where: { id: listId },
    include: { collaborators: true },
  });

  if (!list) return { error: "not-found" as const };
  if (!isSharedListEditor(list, currentUser)) return { error: "unauthorized" as const };

  const movie = await getMovieDetails(movieId);
  if (!movie) return { error: "movie-not-found" as const };

  const existingCount = await prisma.sharedListMovie.count({ where: { sharedListId: listId } });

  await prisma.sharedListMovie.upsert({
    where: { sharedListId_tmdbId: { sharedListId: listId, tmdbId: movieId } },
    create: {
      sharedListId: listId,
      tmdbId: movieId,
      position: existingCount,
      metadata: movie as unknown as Prisma.InputJsonValue,
    },
    update: {
      metadata: movie as unknown as Prisma.InputJsonValue,
    },
  });

  return { value: await fetchSharedLists(currentUser) } as const;
}

export async function removeSharedListMovie(listId: string, movieId: string, currentUser: CurrentUser | null) {
  if (!currentUser) return { error: "unauthorized" as const };

  const list = await prisma.sharedList.findUnique({
    where: { id: listId },
    include: { collaborators: true },
  });

  if (!list) return { error: "not-found" as const };
  if (!isSharedListEditor(list, currentUser)) return { error: "unauthorized" as const };

  const result = await prisma.sharedListMovie.deleteMany({
    where: { sharedListId: listId, tmdbId: movieId },
  });

  if (result.count === 0) return { error: "movie-not-found" as const };

  return { value: await fetchSharedLists(currentUser) } as const;
}
