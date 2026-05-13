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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();

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

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: true,
        replies: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ value: serializeReview(review) });
  } catch (error) {
    console.error("/api/reviews/[id]/replies POST error:", error);
    return NextResponse.json({ error: "Failed to post reply" }, { status: 500 });
  }
}