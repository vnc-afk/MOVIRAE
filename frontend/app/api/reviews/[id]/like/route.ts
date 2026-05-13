import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { randomUUID } from "crypto";

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

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.review.findUnique({
      where: { id },
      include: {
        user: true,
        replies: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const existingLike = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "ReviewLike"
      WHERE "reviewId" = ${id} AND "userId" = ${currentUser.id}
      LIMIT 1
    `;

    const likedByMe = existingLike.length === 0;

    if (!likedByMe) {
      await prisma.$transaction([
        prisma.$executeRaw`
          DELETE FROM "ReviewLike"
          WHERE "reviewId" = ${id} AND "userId" = ${currentUser.id}
        `,
        prisma.$executeRaw`
          UPDATE "Review"
          SET "likes" = GREATEST("likes" - 1, 0)
          WHERE id = ${id}
        `,
      ]);
    } else {
      await prisma.$transaction([
        prisma.$executeRaw`
          INSERT INTO "ReviewLike" ("id", "reviewId", "userId")
          VALUES (${randomUUID()}, ${id}, ${currentUser.id})
        `,
        prisma.$executeRaw`
          UPDATE "Review"
          SET "likes" = "likes" + 1
          WHERE id = ${id}
        `,
      ]);
    }

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: true,
        replies: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ value: serializeReview(review, currentUser.id, likedByMe) });
  } catch (error) {
    console.error("/api/reviews/[id]/like POST error:", error);
    return NextResponse.json({ error: "Failed to like review" }, { status: 500 });
  }
}