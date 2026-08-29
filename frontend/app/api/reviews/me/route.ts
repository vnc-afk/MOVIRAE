import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ value: [] });
  }

  const currentUser = await prisma.user.findUnique({ where: { email } });
  if (!currentUser) {
    return NextResponse.json({ value: [] });
  }

  const reviews = await prisma.review.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    value: reviews.map((review) => ({
      id: review.id,
      movieId: review.tmdbId,
      rating: review.rating,
      comment: review.comment || "",
      date: review.createdAt.toISOString(),
      likes: review.likes,
    })),
  });
}
