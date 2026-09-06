import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { withRedisCached } from "@/lib/redis-cache";
import type { Movie, UserProfile } from "@/lib/types";
import type { SharedList, SharedListComment } from "./types";
import { buildUserProfile } from "@/lib/features/profiles/service";

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
    group?: { id: string; name: string } | null;
    collaborators: Array<{ user: any }>;
    movies: Array<{ tmdbId: string; metadata: Movie | null }>;
    likesRecords: SharedListLikeRow[];
    commentRecords?: SharedListCommentRow[];
    name: string;
    description: string;
    visibility: "public" | "private" | "group";
    likes: number;
    comments: number;
    createdAt: Date;
    groupId: string | null;
  },
  currentUser: CurrentUser | null,
  includeComments = false
): SharedList {
  const commentItems = includeComments ? normalizeCommentTree(list.commentRecords ?? []) : undefined;

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
    likes: list.likesRecords.length,
    likedByMe: currentUser ? list.likesRecords.some((record) => record.userId === currentUser.id) : false,
    comments: list.comments,
    commentItems,
    createdAt: list.createdAt.toISOString(),
    groupId: list.groupId ?? undefined,
    groupName: list.group?.name ?? undefined,
  };
}

export function buildSharedListViewFilter(currentUser: CurrentUser | null): Prisma.SharedListWhereInput {
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
          members: { some: { userId: currentUser.id } },
        },
      },
    ],
  };
}

const sharedListDetailInclude = {
  owner: true,
  group: { select: { id: true, name: true } },
  collaborators: { include: { user: true } },
  movies: true,
  likesRecords: true,
  commentRecords: {
    include: { user: true },
    orderBy: { createdAt: "asc" as const },
  },
};

const sharedListSummaryInclude = {
  owner: true,
  group: { select: { id: true, name: true } },
  collaborators: { include: { user: true } },
  movies: true,
  likesRecords: true,
};

export async function getSharedListForView(listId: string, currentUser: CurrentUser | null) {
  return prisma.sharedList.findFirst({
    where: {
      id: listId,
      ...buildSharedListViewFilter(currentUser),
    },
    include: sharedListDetailInclude,
  });
}

export async function getSharedListAccessInfo(listId: string, currentUser: CurrentUser | null) {
  return prisma.sharedList.findFirst({
    where: {
      id: listId,
      ...buildSharedListViewFilter(currentUser),
    },
    select: { id: true, ownerId: true },
  });
}

const DEFAULT_PAGE_SIZE = 12;

export type FetchSharedListsResult = {
  lists: SharedList[];
  hasMore: boolean;
  nextPage: number | null;
};

export async function fetchSharedLists(
  currentUser: CurrentUser | null,
  options?: { page?: number; pageSize?: number }
): Promise<FetchSharedListsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE));
  const scopeKey = currentUser?.id ?? "anonymous";

  return withRedisCached(
    "shared-lists",
    `page:${scopeKey}:${page}:${pageSize}`,
    async () => {
      const where = buildSharedListViewFilter(currentUser);
      const rows = await prisma.sharedList.findMany({
        where,
        include: sharedListSummaryInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      });

      const hasMore = rows.length > pageSize;
      const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

      return {
        lists: pageRows.map((list) => serializeSharedList(list as any, currentUser, false)),
        hasMore,
        nextPage: hasMore ? page + 1 : null,
      };
    },
    180
  );
}

export async function getSharedListDetail(listId: string, currentUser: CurrentUser | null) {
  const scopeKey = currentUser?.id ?? "anonymous";

  return withRedisCached(
    "shared-lists",
    `detail:${scopeKey}:${listId}`,
    async () => {
      const row = await prisma.sharedList.findFirst({
        where: {
          id: listId,
          ...buildSharedListViewFilter(currentUser),
        },
        include: sharedListDetailInclude,
      });

      if (!row) return null;
      return serializeSharedList(row as any, currentUser, true);
    },
    180
  );
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
