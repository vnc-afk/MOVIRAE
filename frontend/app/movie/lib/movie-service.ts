import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { canReviewMovie, serializeReview } from "@/lib/features/reviews/service";
import { publishReviewEvent } from "@/lib/features/reviews/events";
import { refreshHomeActivityFeedSnapshot } from "@/lib/features/activity/feed";
import { refreshUserStatsSnapshot } from "@/app/stats/lib/user-stats";
import type { CurrentUser } from "./api-utils";

export async function addReview(
  payload: { tmdbId: string; rating: number; comment?: string | null; tone?: string | null; isSpoiler?: boolean; opId?: string | undefined },
  currentUser: CurrentUser
): Promise<{ value: any; opId?: string } | { error: "unauthorized" | "conflict" | "not-found" | "validation" }>
{
  const { tmdbId, rating, comment, tone, isSpoiler, opId } = payload;

  const watched = await canReviewMovie(currentUser.id, tmdbId);
  if (!watched) {
    return { error: "unauthorized" };
  }

  const existing = await prisma.review.findFirst({ where: { userId: currentUser.id, tmdbId } });
  if (existing) return { error: "conflict" };

  const review = await prisma.review.create({
    data: {
      userId: currentUser.id,
      tmdbId,
      rating,
      comment: comment || null,
      tone: tone || null,
      isSpoiler: Boolean(isSpoiler),
    },
    include: {
      user: true,
      likesRecords: true,
      helpfulRecords: true,
      replies: { include: { user: true, likesRecords: true }, orderBy: { createdAt: "asc" } },
    },
  });

  try {
    const serialized = serializeReview(review, null, false);
    publishReviewEvent(review.tmdbId, review.id, "created", opId, serialized);
  } catch (e) {
    console.warn("publishReviewEvent failed:", e);
  }

  void refreshUserStatsSnapshot(currentUser.id).catch((error) => console.error("refreshUserStatsSnapshot failed", error));
  void refreshHomeActivityFeedSnapshot().catch((error) => console.error("refreshHomeActivityFeedSnapshot failed", error));

  return { value: serializeReview(review, currentUser.id), opId };
}

export async function editReview(
  reviewId: string,
  payload: { rating: number; comment?: string | null; tone?: string | null; isSpoiler?: boolean },
  currentUser: CurrentUser
): Promise<{ value: any } | { error: "unauthorized" | "not-found" | "validation" }> {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) return { error: "not-found" };
  if (existing.userId !== currentUser.id) return { error: "unauthorized" };

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: {
      rating: payload.rating,
      comment: payload.comment || null,
      tone: payload.tone || null,
      isSpoiler: Boolean(payload.isSpoiler),
    },
    include: {
      user: true,
      likesRecords: true,
      helpfulRecords: true,
      replies: { include: { user: true, likesRecords: true }, orderBy: { createdAt: "asc" } },
    },
  });

  try {
    const serialized = serializeReview(review, null, false);
    publishReviewEvent(review.tmdbId, review.id, "updated", undefined, serialized);
  } catch (e) {
    console.warn("publishReviewEvent failed:", e);
  }

  void refreshUserStatsSnapshot(currentUser.id).catch((error) => console.error("refreshUserStatsSnapshot failed", error));
  void refreshHomeActivityFeedSnapshot().catch((error) => console.error("refreshHomeActivityFeedSnapshot failed", error));

  return { value: serializeReview(review, currentUser.id) };
}

export async function deleteReview(
  reviewId: string,
  currentUser: CurrentUser
): Promise<{ value: true } | { error: "unauthorized" | "not-found" }> {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) return { error: "not-found" };
  if (existing.userId !== currentUser.id) return { error: "unauthorized" };

  await prisma.review.delete({ where: { id: reviewId } });

  try {
    const serialized = serializeReview(existing, null, false);
    publishReviewEvent(existing.tmdbId, reviewId, "deleted", undefined, serialized);
  } catch (e) {
    console.warn("publishReviewEvent failed:", e);
  }

  void refreshUserStatsSnapshot(currentUser.id).catch((err: unknown) => console.error("refreshUserStatsSnapshot failed", err));
  void refreshHomeActivityFeedSnapshot().catch((err: unknown) => console.error("refreshHomeActivityFeedSnapshot failed", err));

  return { value: true };
}

export async function toggleReviewLike(
  reviewId: string,
  currentUser: CurrentUser,
  opId?: string
): Promise<{ value: any; opId?: string } | { error: "not-found" | "unauthorized" }> {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) return { error: "not-found" };
  
  const existingLike = await prisma.reviewLike.findUnique({
    where: { reviewId_userId: { reviewId, userId: currentUser.id } },
  });

  let willBeLiked = !existingLike;

  if (existingLike) {
    await prisma.$transaction([
      prisma.reviewLike.delete({ where: { reviewId_userId: { reviewId, userId: currentUser.id } } }),
      prisma.review.update({ where: { id: reviewId }, data: { likes: { decrement: 1 } } }),
    ]);
  } else {
    try {
      await prisma.$transaction([
        prisma.reviewLike.create({ data: { reviewId, userId: currentUser.id } }),
        prisma.review.update({ where: { id: reviewId }, data: { likes: { increment: 1 } } }),
      ]);
    } catch (err) {
      // FIX: this is the race window — a concurrent request (double-click,
      // retry) may have already inserted the like between our check above
      // and this transaction. P2002 is Prisma's unique-constraint-violation
      // code; treat that as "already liked" instead of surfacing a 500.
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
        willBeLiked = true; // the other request already applied this like
      } else {
        throw err;
      }
    }

    if (willBeLiked && existing.userId !== currentUser.id && currentUser.displayName) {
      const actorName = currentUser.displayName.trim();
      const recentNotification = await prisma.notification.findFirst({
        where: {
          recipientId: existing.userId,
          actorId: currentUser.id,
          type: "review_like",
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      if (!recentNotification) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: existing.userId,
            actorId: currentUser.id,
            type: "review_like",
            movieId: existing.tmdbId,
            reviewId: reviewId,
            message: `liked your review`,
          },
        });
        try {
          const { publishNotificationEvent } = await import("@/app/notifications/lib/events");
          publishNotificationEvent({ notificationId: notification.id, recipientId: notification.recipientId });
        } catch (e) {
          console.warn("publishNotificationEvent failed:", e);
        }
      }
    }
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      user: true,
      likesRecords: true,
      helpfulRecords: true,
      replies: { include: { user: true, likesRecords: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!review) return { error: "not-found" };

  try {
    const serialized = serializeReview(review, currentUser.id, willBeLiked);
    publishReviewEvent(review.tmdbId, review.id, "liked", opId, serialized);
  } catch (e) {
    console.warn("publishReviewEvent failed:", e);
  }

  return { value: serializeReview(review, currentUser.id, willBeLiked), opId };
}

export async function toggleReviewHelpful(
  reviewId: string,
  currentUser: CurrentUser,
  opId?: string
): Promise<{ value: any; opId?: string } | { error: "not-found" }> {
  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { helpfulRecords: true },
  });
  if (!existing) return { error: "not-found" };

  const existingHelpful = await prisma.reviewHelpful.findUnique({
    where: { reviewId_userId: { reviewId, userId: currentUser.id } },
  });

  if (existingHelpful) {
    await prisma.reviewHelpful.delete({ where: { reviewId_userId: { reviewId, userId: currentUser.id } } });
  } else {
    await prisma.reviewHelpful.create({ data: { reviewId, userId: currentUser.id } });
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      user: true,
      likesRecords: true,
      helpfulRecords: true,
      replies: { include: { user: true, likesRecords: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!review) return { error: "not-found" };

  return { value: serializeReview(review, currentUser.id), opId };
}

export async function toggleReplyLike(
  reviewId: string,
  replyId: string,
  currentUser: CurrentUser,
  opId?: string
): Promise<{ value: any; opId?: string } | { error: "not-found" }> {
  const reply = await prisma.reviewReply.findUnique({ where: { id: replyId }, select: { id: true, reviewId: true } });
  if (!reply || reply.reviewId !== reviewId) return { error: "not-found" };

  const existingLike = await prisma.reviewReplyLike.findUnique({
    where: { reviewReplyId_userId: { reviewReplyId: replyId, userId: currentUser.id } },
  });

  if (existingLike) {
    await prisma.$transaction([
      prisma.reviewReplyLike.delete({ where: { reviewReplyId_userId: { reviewReplyId: replyId, userId: currentUser.id } } }),
      prisma.reviewReply.update({ where: { id: replyId }, data: { likes: { decrement: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.reviewReplyLike.create({ data: { reviewReplyId: replyId, userId: currentUser.id } }),
      prisma.reviewReply.update({ where: { id: replyId }, data: { likes: { increment: 1 } } }),
    ]);
  }

  const updatedReview = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      user: true,
      likesRecords: true,
      helpfulRecords: true,
      replies: { include: { user: true, likesRecords: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!updatedReview) return { error: "not-found" };

  return { value: serializeReview(updatedReview, currentUser.id, undefined), opId };
}

export async function createReply(
  reviewId: string,
  payload: { comment: string; opId?: string | undefined },
  currentUser: CurrentUser
): Promise<{ value: any; opId?: string } | { error: "not-found" | "validation" | "unauthorized" }> {
  const comment = typeof payload.comment === "string" ? payload.comment.trim() : "";
  if (!comment) return { error: "validation" };

  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) return { error: "not-found" };

  await prisma.reviewReply.create({ data: { reviewId, userId: currentUser.id, comment } });

  // create notification if replying to someone else's review
  if (existing.userId !== currentUser.id && currentUser.displayName) {
    const notification = await prisma.notification.create({
      data: {
        recipientId: existing.userId,
        actorId: currentUser.id,
        type: "review_reply",
        movieId: existing.tmdbId,
        reviewId,
        message: `replied to your review`,
      },
    });
    try {
          const { publishNotificationEvent } = await import("@/app/notifications/lib/events");
      publishNotificationEvent({ notificationId: notification.id, recipientId: notification.recipientId });
    } catch (e) {
      console.warn("publishNotificationEvent failed:", e);
    }
  }

  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { user: true, likesRecords: true, helpfulRecords: true, replies: { include: { user: true, likesRecords: true }, orderBy: { createdAt: "asc" } } } });
  if (!review) return { error: "not-found" };

  try {
    const serialized = serializeReview(review, null, false);
    publishReviewEvent(review.tmdbId, review.id, "replied", payload.opId, serialized);
  } catch (e) {
    console.warn("publishReviewEvent failed:", e);
  }

  return { value: serializeReview(review, currentUser.id), opId: payload.opId };
}

export async function deleteReply(
  reviewId: string,
  replyId: string,
  currentUser: CurrentUser
): Promise<{ value: true } | { error: "not-found" | "unauthorized" }> {
  const reply = await prisma.reviewReply.findUnique({ where: { id: replyId } });
  if (!reply || reply.reviewId !== reviewId) return { error: "not-found" };
  if (reply.userId !== currentUser.id) return { error: "unauthorized" };

  await prisma.reviewReply.delete({ where: { id: replyId } });

  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (existing) {
    try {
      const serialized = serializeReview(existing, null, false);
      publishReviewEvent(existing.tmdbId, existing.id, "updated", undefined, serialized);
    } catch (e) {
      console.warn("publishReviewEvent failed:", e);
    }
  }

  return { value: true };
}

export async function toggleMovieFavorite(
  tmdbId: string,
  currentUser: CurrentUser
): Promise<{ value: { favorite: boolean } } | { error: "not-found" }> {
  // toggle in UserFavoriteMovie
  const existing = await prisma.userFavoriteMovie.findFirst({ where: { userId: currentUser.id, tmdbId } });
  if (existing) {
    await prisma.userFavoriteMovie.delete({ where: { id: existing.id } });
    return { value: { favorite: false } };
  }

  await prisma.userFavoriteMovie.create({ data: { userId: currentUser.id, tmdbId } });
  return { value: { favorite: true } };
}

export async function getMovieReviews(
  tmdbId: string,
  currentUser: CurrentUser | null
): Promise<any[]> {
  const reviews = await prisma.review.findMany({
    where: { tmdbId },
    include: {
      user: true,
      likesRecords: true,
      helpfulRecords: true,
      replies: { include: { user: true, likesRecords: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reviews.map((review) => serializeReview(review, currentUser?.id));
}

// Watch-experience helpers: thin wrappers over existing lib functions
import { getUserWatchExperience as _getUserWatchExperience, parseWatchExperiencePayload as _parseWatchExperiencePayload, saveUserWatchExperience as _saveUserWatchExperience, getWatchExperienceStats as _getWatchExperienceStats } from "@/lib/features/watch/experiences";

export async function getWatchExperience(userId: string, tmdbId: string) {
  return await _getUserWatchExperience(userId, tmdbId);
}

export function parseWatchExperiencePayload(payload: unknown) {
  return _parseWatchExperiencePayload(payload);
}

export async function saveWatchExperience(userId: string, tmdbId: string, input: any) {
  return await _saveUserWatchExperience(userId, tmdbId, input);
}

export async function getWatchExperienceStats(userId: string) {
  return await _getWatchExperienceStats(userId);
}
