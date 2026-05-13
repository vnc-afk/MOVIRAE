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

export async function GET(_request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  try {
    const { tmdbId } = await params;
    const currentUser = await getCurrentUser();

    const reviews = await prisma.review.findMany({
      where: { tmdbId },
      include: {
        user: true,
        replies: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let likedReviewIds = new Set<string>();

    if (currentUser) {
      try {
        const rows = await prisma.$queryRaw<Array<{ reviewId: string }>>`
          SELECT "reviewId"
          FROM "ReviewLike"
          WHERE "userId" = ${currentUser.id}
        `;
        likedReviewIds = new Set(rows.map((row) => row.reviewId));
      } catch (error) {
        console.warn("/api/reviews/movie/[tmdbId] GET could not load review likes:", error);
      }
    }

    return NextResponse.json({ value: reviews.map((review) => serializeReview(review, currentUser?.id, likedReviewIds.has(review.id))) });
  } catch (error) {
    console.error("/api/reviews/movie/[tmdbId] GET error:", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}
