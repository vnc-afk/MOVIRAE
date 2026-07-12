import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Movie, SharedList, SharedListComment, UserProfile } from "@/lib/types";
import { buildUserProfile } from "@/lib/user-profiles";

// Current authenticated user payload shape returned by Prisma.
type CurrentUser = Awaited<ReturnType<typeof prisma.user.findUnique>>;

// Fallback profile used when a user row is missing or not buildable.
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

// Converts a flat list of comment rows into a nested comment tree.
// This is used to derive `commentItems` for the shared list detail response.
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

  // Ensure top-level comments and nested replies are ordered by creation time.
  sortTree(rootComments);
  return rootComments;
}

// Convert a detailed shared list DB result into the frontend `SharedList` shape.
function serializeSharedListDetail(
  list: {
    id: string;
    owner: any;
    group?: { id: string; name: string } | null;
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
    groupName: list.group?.name ?? undefined,
  };
}

// Convert a lighter shared list summary for list grids and pagination.
function serializeSharedListSummary(
  list: {
    id: string;
    owner: any;
    group?: { id: string; name: string } | null;
    collaborators: Array<{ user: any }>;
    movies: Array<{ tmdbId: string; metadata: Movie | null }>;
    likesRecords: SharedListLikeRow[];
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
    commentItems: undefined,
    createdAt: list.createdAt.toISOString(),
    groupId: list.groupId ?? undefined,
    groupName: list.group?.name ?? undefined,
  };
}

export function buildSharedListViewFilter(currentUser: CurrentUser | null): Prisma.SharedListWhereInput {
  // Restrict visible shared lists based on the current user.
  // - anonymous users see only public lists.
  // - authenticated users see public lists, their own lists, and group lists for groups they belong to.
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

// Prisma include shapes used by the shared list fetch helpers.
// The detail include loads full comment records and the nested user rows needed for threading.
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

// Summary include is lighter and used for list grid pagination.
const sharedListSummaryInclude = {
  owner: true,
  group: { select: { id: true, name: true } },
  collaborators: { include: { user: true } },
  movies: true,
  likesRecords: true,
};

export async function getSharedListForView(listId: string, currentUser: CurrentUser | null) {
  // Retrieve a fully detailed shared list if the current user has permission to view it.
  return prisma.sharedList.findFirst({
    where: {
      id: listId,
      ...buildSharedListViewFilter(currentUser),
    },
    include: sharedListDetailInclude,
  });
}

export async function getSharedListAccessInfo(listId: string, currentUser: CurrentUser | null) {
  // Used by permission checks when only the list id and owner id are needed.
  return prisma.sharedList.findFirst({
    where: {
      id: listId,
      ...buildSharedListViewFilter(currentUser),
    },
    select: { id: true, ownerId: true },
  });
}

export async function getCurrentUser() {
  // Resolve the current user from the NextAuth session.
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({ where: { email: session.user.email } });
}

// Default pagination size for shared list fetches.
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
  // Normalize pagination options and cap the page size to avoid overly large responses.
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE));

  const where = buildSharedListViewFilter(currentUser);
  const rows = await prisma.sharedList.findMany({
    where,
    include: sharedListSummaryInclude,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });

  // Load one extra row to determine whether there is a next page.
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  return {
    lists: pageRows.map((list) => serializeSharedListSummary(list as any, currentUser)),
    hasMore,
    nextPage: hasMore ? page + 1 : null,
  };
}

export async function getSharedListDetail(listId: string, currentUser: CurrentUser | null) {
  const row = await prisma.sharedList.findFirst({
    where: {
      id: listId,
      ...buildSharedListViewFilter(currentUser),
    },
    include: sharedListDetailInclude,
  });

  if (!row) return null;
  return serializeSharedListDetail(row as any, currentUser);
}

export async function createSharedList(
  input: { name: string; description: string; visibility: "public" | "private" | "group"; groupId?: string },
  currentUser: CurrentUser | null
) {
  if (!currentUser) return { error: "unauthorized" as const };

  // Persist a new shared list and return refreshed paginated results for the client.

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