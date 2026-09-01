import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMovieDetails } from "@/lib/tmdb";
import { getSharedListForView } from "@/app/shared-lists/lib/service";
import type { CurrentUser } from "./api-utils";

/**
 * Check if user can edit a shared list (owner or explicit collaborator)
 */
async function canEditSharedList(listId: string, userId: string): Promise<boolean> {
  const list = await prisma.sharedList.findUnique({
    where: { id: listId },
    select: { ownerId: true, collaborators: { select: { userId: true } } },
  });

  if (!list) return false;
  if (list.ownerId === userId) return true;
  return list.collaborators.some((c) => c.userId === userId);
}

/**
 * Check if user is the owner of a shared list
 */
async function isSharedListOwner(listId: string, userId: string): Promise<boolean> {
  const list = await prisma.sharedList.findUnique({
    where: { id: listId },
    select: { ownerId: true },
  });
  return list?.ownerId === userId;
}

/*
  Server-side helpers for shared lists API routes.
  - These functions encapsulate common DB operations (comments, likes, movie add/remove, delete list).
  - Each function returns a `{ value: ... }` on success or `{ error: ... }` on failure to make handling
    consistent for the API route callers.
  - Important: callers should treat returned `value` as already-serialized/view-ready via
    `getSharedListForView` whenever applicable.
*/

export { getSharedListForView, getSharedListAccessInfo, getSharedListDetail } from "@/app/shared-lists/lib/service";

export async function addSharedListComment(
  listId: string,
  body: string,
  currentUser: CurrentUser,
  parentId?: string
): Promise<{ value: any } | { error: "not-found" | "unauthorized" }> {
  // Create a new comment record and increment the parent list's comment counter.
  // We keep the DB write separate from the view-generation to avoid long transactions.
  await prisma.sharedListComment.create({
    data: {
      sharedListId: listId,
      userId: currentUser.id,
      body,
      parentId: parentId || null,
    },
  });

  await prisma.sharedList.update({
    where: { id: listId },
    data: { comments: { increment: 1 } },
  });

  const updatedList = await getSharedListForView(listId, currentUser);
  if (!updatedList) {
    return { error: "not-found" };
  }

  return { value: updatedList as any };
}

export async function toggleSharedListLike(
  listId: string,
  currentUser: CurrentUser
): Promise<
  | { value: any; isNewLike: boolean }
  | { error: "not-found" | "unauthorized" }
> {
  // Use a transaction for like/unlike to ensure the like record and the
  // `likes` counter on `sharedList` remain consistent.
  const transactionResult = await prisma.$transaction(async (tx) => {
    const existingLike = await tx.sharedListLike.findUnique({
      where: {
        sharedListId_userId: {
          sharedListId: listId,
          userId: currentUser.id,
        },
      },
    });

    const isNewLike = !existingLike;

    if (existingLike) {
      await tx.sharedListLike.delete({
        where: {
          sharedListId_userId: {
            sharedListId: listId,
            userId: currentUser.id,
          },
        },
      });
      await tx.sharedList.update({
        where: { id: listId },
        data: { likes: { decrement: 1 } },
      });
    } else {
      await tx.sharedListLike.create({
        data: {
          sharedListId: listId,
          userId: currentUser.id,
        },
      });
      await tx.sharedList.update({
        where: { id: listId },
        data: { likes: { increment: 1 } },
      });
    }

    return { isNewLike };
  });

  const updatedList = await getSharedListForView(listId, currentUser);
  if (!updatedList) {
    return { error: "not-found" };
  }

  return { value: updatedList, isNewLike: transactionResult.isNewLike };
}

export async function addSharedListMovie(
  listId: string,
  movieId: string,
  currentUser: CurrentUser
): Promise<
  | { value: any }
  | { error: "unauthorized" | "movie-not-found" | "not-found" }
> {
  // Check if list exists and user can edit it
  const hasAccess = await canEditSharedList(listId, currentUser.id);
  if (!hasAccess) {
    return { error: "unauthorized" };
  }

  // Fetch fresh movie metadata from TMDb before adding/updating the list entry
  const movie = await getMovieDetails(movieId);
  if (!movie) {
    return { error: "movie-not-found" };
  }

  // Position new movie at the end of the list by counting existing entries
  const existingCount = await prisma.sharedListMovie.count({
    where: { sharedListId: listId },
  });

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

  const updatedList = await getSharedListForView(listId, currentUser);
  if (!updatedList) {
    return { error: "not-found" };
  }

  return { value: updatedList as any };
}

export async function removeSharedListMovie(
  listId: string,
  movieId: string,
  currentUser: CurrentUser
): Promise<
  | { value: any }
  | { error: "unauthorized" | "movie-not-found" | "not-found" }
> {
  // Check if user can edit the list
  const hasAccess = await canEditSharedList(listId, currentUser.id);
  if (!hasAccess) {
    return { error: "unauthorized" };
  }

  // Delete any matching movie rows (should be 0 or 1). We use deleteMany for idempotency
  const result = await prisma.sharedListMovie.deleteMany({
    where: { sharedListId: listId, tmdbId: movieId },
  });

  if (result.count === 0) {
    return { error: "movie-not-found" };
  }

  const updatedList = await getSharedListForView(listId, currentUser);
  if (!updatedList) {
    return { error: "not-found" };
  }

  return { value: updatedList as any };
}

export async function deleteSharedList(
  listId: string,
  currentUser: CurrentUser
): Promise<{ value: any } | { error: "unauthorized" | "not-found" }> {
  // Only the owner may fully delete a list
  const isOwner = await isSharedListOwner(listId, currentUser.id);
  if (!isOwner) {
    return { error: "unauthorized" };
  }

  await prisma.sharedList.delete({ where: { id: listId } });
  return { value: {} };
}
