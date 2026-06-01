import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeReview } from "@/lib/reviews";
import { publishReviewEvent } from "@/lib/review-events";
import { refreshHomeActivityFeedSnapshot, refreshUserStatsSnapshot } from "@/lib/aggregations";

export const runtime = "nodejs";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return null;
  }

  return prisma.user.findUnique({ where: { email } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payload = await request.json().catch(() => null);
    const rating = Number(payload?.rating);
    const comment = typeof payload?.comment === "string" ? payload.comment.trim() : "";

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (existing.userId !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const review = await prisma.review.update({
      where: { id },
      data: {
        rating,
        comment: comment || null,
      },
      select: {
        id: true,
        tmdbId: true,
        userId: true,
        rating: true,
        comment: true,
        likes: true,
        createdAt: true,
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
        likesRecords: { select: { userId: true } },
        replies: {
          select: {
            id: true,
            comment: true,
            likes: true,
            createdAt: true,
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
            likesRecords: { select: { userId: true } },
          },
          orderBy: { createdAt: "asc" },
        },
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

    return NextResponse.json({ value: serializeReview(review, currentUser.id) });
  } catch (error) {
    console.error("/api/reviews/[id] PUT error:", error);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        tmdbId: true,
        userId: true,
        rating: true,
        comment: true,
        likes: true,
        createdAt: true,
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
        likesRecords: { select: { userId: true } },
        replies: {
          select: {
            id: true,
            comment: true,
            likes: true,
            createdAt: true,
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
            likesRecords: { select: { userId: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (existing.userId !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.review.delete({ where: { id } });

    try {
      const serialized = serializeReview(existing, null, false);
      publishReviewEvent(existing.tmdbId, id, "deleted", undefined, serialized);
    } catch (e) {
      console.warn("publishReviewEvent failed:", e);
    }

    void refreshUserStatsSnapshot(currentUser.id).catch((error) => console.error("refreshUserStatsSnapshot failed", error));
    void refreshHomeActivityFeedSnapshot().catch((error) => console.error("refreshHomeActivityFeedSnapshot failed", error));

    return NextResponse.json({ value: true });
  } catch (error) {
    console.error("/api/reviews/[id] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
