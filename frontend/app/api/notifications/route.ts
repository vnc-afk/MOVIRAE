import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ value: [] });
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const notifications = await prisma.notification.findMany({
    where: { recipientId: currentUser.id },
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      read: true,
      movieId: true,
      reviewId: true,
      discussionId: true,
      eventId: true,
      sharedListId: true,
      groupId: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const missingMovieByReviewIds = Array.from(
    new Set(
      notifications
        .filter((notification) => !notification.movieId && notification.reviewId)
        .map((notification) => notification.reviewId as string)
    )
  );

  const missingGroupByDiscussionIds = Array.from(
    new Set(
      notifications
        .filter((notification) => !notification.groupId && notification.discussionId)
        .map((notification) => notification.discussionId as string)
    )
  );

  const reviews = missingMovieByReviewIds.length
    ? await prisma.review.findMany({
        where: { id: { in: missingMovieByReviewIds } },
        select: { id: true, tmdbId: true },
      })
    : [];

  const discussions = missingGroupByDiscussionIds.length
    ? await prisma.groupDiscussion.findMany({
        where: { id: { in: missingGroupByDiscussionIds } },
        select: { id: true, groupId: true },
      })
    : [];

  const reviewMovieMap = new Map(reviews.map((review) => [review.id, review.tmdbId]));
  const discussionGroupMap = new Map(discussions.map((discussion) => [discussion.id, discussion.groupId]));

  const value = notifications.map((notification) => {
    const movieId = notification.movieId ?? (notification.reviewId ? reviewMovieMap.get(notification.reviewId) : undefined);
    const groupId = notification.groupId ?? (notification.discussionId ? discussionGroupMap.get(notification.discussionId) : undefined);

    return {
      id: notification.id,
      type: notification.type,
      user: {
        id: notification.actor?.id ?? currentUser.id,
        email: notification.actor?.email ?? currentUser.email ?? undefined,
        username: notification.actor?.username ?? notification.actor?.email?.split("@")[0] ?? "unknown",
        displayName: notification.actor?.displayName ?? notification.actor?.name ?? notification.actor?.email?.split("@")[0] ?? "Unknown",
        avatar: notification.actor?.avatar ?? notification.actor?.image ?? "",
        bio: notification.actor?.bio ?? "",
        followers: 0,
        following: 0,
        reviewCount: 0,
        watchlistCount: 0,
        favoriteMovies: [],
      },
      message: notification.message,
      date: notification.createdAt.toISOString(),
      read: notification.read,
      movieId: movieId ?? undefined,
      reviewId: notification.reviewId ?? undefined,
      discussionId: notification.discussionId ?? undefined,
      eventId: notification.eventId ?? undefined,
      sharedListId: notification.sharedListId ?? undefined,
      groupId: groupId ?? undefined,
    };
  });

  return NextResponse.json({ value });
}
