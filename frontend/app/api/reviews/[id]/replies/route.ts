import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeReview } from "@/lib/reviews";
import { publishNotificationEvent } from "@/lib/group-events";

export const runtime = "nodejs";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return null;
  }

  return prisma.user.findUnique({ where: { email } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    const actorName = currentUser?.displayName?.trim();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payload = await request.json().catch(() => null);
    const comment = typeof payload?.comment === "string" ? payload.comment.trim() : "";

    if (!comment) {
      return NextResponse.json({ error: "Reply comment is required" }, { status: 400 });
    }

    const existing = await prisma.review.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    await prisma.reviewReply.create({
      data: {
        reviewId: id,
        userId: currentUser.id,
        comment,
      },
    });

    // Create notification if replying to someone else's review
    if (existing.userId !== currentUser.id && actorName) {
      const notification = await prisma.notification.create({
        data: {
          recipientId: existing.userId,
          actorId: currentUser.id,
          type: "review_reply",
          movieId: existing.tmdbId,
          reviewId: id,
          message: `replied to your review`,
        },
      });
      publishNotificationEvent(notification.id);
    }

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: true,
        replies: {
          include: { user: true, likesRecords: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ value: serializeReview(review, currentUser.id) });
  } catch (error) {
    console.error("/api/reviews/[id]/replies POST error:", error);
    return NextResponse.json({ error: "Failed to post reply" }, { status: 500 });
  }
}