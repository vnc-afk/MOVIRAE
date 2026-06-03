import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMovieDetails } from "@/lib/tmdb";
import { getSharedListForView } from "@/lib/shared-lists";
import type { CurrentUser } from "./api-utils";

export { getSharedListForView } from "@/lib/shared-lists";

export async function addSharedListComment(
  listId: string,
  body: string,
  currentUser: CurrentUser,
  parentId?: string
): Promise<{ value: any } | { error: "not-found" | "unauthorized" }> {
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
  const list = await prisma.sharedList.findUnique({
    where: { id: listId },
    include: { collaborators: true },
  });

  if (!list) {
    return { error: "not-found" };
  }

  const isEditor = list.ownerId === currentUser.id || list.collaborators.some((collaborator) => collaborator.userId === currentUser.id);
  if (!isEditor) {
    return { error: "unauthorized" };
  }

  const movie = await getMovieDetails(movieId);
  if (!movie) {
    return { error: "movie-not-found" };
  }

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
  const list = await prisma.sharedList.findUnique({
    where: { id: listId },
    include: { collaborators: true },
  });

  if (!list) {
    return { error: "not-found" };
  }

  const isEditor = list.ownerId === currentUser.id || list.collaborators.some((collaborator) => collaborator.userId === currentUser.id);
  if (!isEditor) {
    return { error: "unauthorized" };
  }

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
  const list = await prisma.sharedList.findUnique({ where: { id: listId } });
  if (!list) {
    return { error: "not-found" };
  }

  if (list.ownerId !== currentUser.id) {
    return { error: "unauthorized" };
  }

  await prisma.sharedList.delete({ where: { id: listId } });
  return { value: {} };
}
