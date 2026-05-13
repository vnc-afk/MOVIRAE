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
      include: {
        user: true,
        replies: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({ value: serializeReview(review) });
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
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (existing.userId !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.review.delete({ where: { id } });

    return NextResponse.json({ value: true });
  } catch (error) {
    console.error("/api/reviews/[id] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
