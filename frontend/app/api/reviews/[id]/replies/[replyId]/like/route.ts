import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeReview } from "@/lib/reviews";

export const runtime = "nodejs";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return null;
  }

  return prisma.user.findUnique({ where: { email } });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, replyId } = await params;
    const reply = await prisma.reviewReply.findUnique({
      where: { id: replyId },
      select: { id: true, reviewId: true },
    });

    if (!reply || reply.reviewId !== id) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    const existingLike = await prisma.reviewReplyLike.findUnique({
      where: {
        reviewReplyId_userId: {
          reviewReplyId: replyId,
          userId: currentUser.id,
        },
      },
    });

    if (existingLike) {
      await prisma.$transaction([
        prisma.reviewReplyLike.delete({
          where: { reviewReplyId_userId: { reviewReplyId: replyId, userId: currentUser.id } },
        }),
        prisma.reviewReply.update({
          where: { id: replyId },
          data: { likes: { decrement: 1 } },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.reviewReplyLike.create({
          data: {
            reviewReplyId: replyId,
            userId: currentUser.id,
          },
        }),
        prisma.reviewReply.update({
          where: { id: replyId },
          data: { likes: { increment: 1 } },
        }),
      ]);
    }

    const updatedReview = await prisma.review.findUnique({
      where: { id },
      include: {
        user: true,
        replies: {
          include: { user: true, likesRecords: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!updatedReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ value: serializeReview(updatedReview, currentUser.id, undefined) });
  } catch (error) {
    console.error("/api/reviews/[id]/replies/[replyId]/like POST error:", error);
    return NextResponse.json({ error: "Failed to like reply" }, { status: 500 });
  }
}
