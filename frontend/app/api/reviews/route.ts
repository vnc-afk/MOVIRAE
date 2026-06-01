import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReviewMovie, serializeReview } from "@/lib/reviews";
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

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const opId = typeof payload?.opId === "string" ? payload.opId : request.headers.get("x-op-id") ?? undefined;
    const tmdbId = typeof payload?.tmdbId === "string" ? payload.tmdbId.trim() : "";
    const rating = Number(payload?.rating);
    const comment = typeof payload?.comment === "string" ? payload.comment.trim() : "";

    if (!tmdbId) {
      return NextResponse.json({ error: "Movie ID is required" }, { status: 400 });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    const watched = await canReviewMovie(currentUser.id, tmdbId);
    if (!watched) {
      return NextResponse.json({ error: "Mark the movie as watched before reviewing it" }, { status: 403 });
    }

    const existing = await prisma.review.findFirst({
      where: {
        userId: currentUser.id,
        tmdbId,
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
        likesRecords: {
          select: { userId: true },
        },
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
            likesRecords: {
              select: { userId: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "You already reviewed this movie" }, { status: 409 });
    }

    const review = await prisma.review.create({
      data: {
        userId: currentUser.id,
        tmdbId,
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

    // publish review-created event so other clients can reconcile using opId
    try {
      const serialized = serializeReview(review, null, false);
      publishReviewEvent(review.tmdbId, review.id, "created", opId, serialized);
    } catch (e) {
      // non-fatal
      console.warn("publishReviewEvent failed:", e);
    }

    void refreshUserStatsSnapshot(currentUser.id).catch((error) => console.error("refreshUserStatsSnapshot failed", error));
    void refreshHomeActivityFeedSnapshot().catch((error) => console.error("refreshHomeActivityFeedSnapshot failed", error));

    return NextResponse.json({ value: serializeReview(review, currentUser.id), opId });
  } catch (error) {
    console.error("/api/reviews POST error:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
