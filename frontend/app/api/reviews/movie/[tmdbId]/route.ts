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
    const currentUserPromise = getCurrentUser();
    const reviewsPromise = prisma.review.findMany({
      where: { tmdbId },
      include: {
        user: true,
        likesRecords: true,
        replies: {
          include: { user: true, likesRecords: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const [currentUser, reviews] = await Promise.all([currentUserPromise, reviewsPromise]);

    return NextResponse.json({ value: reviews.map((review) => serializeReview(review, currentUser?.id)) });
  } catch (error) {
    console.error("/api/reviews/movie/[tmdbId] GET error:", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}
