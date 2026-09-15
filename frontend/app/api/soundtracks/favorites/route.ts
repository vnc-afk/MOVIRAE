import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";
import { serializeSoundtrack } from "@/services/soundtracks/soundtracks.server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ value: [] });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ value: [] });

  const favorites = await prisma.userSoundtrackFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      soundtrack: {
        include: { tracks: { orderBy: { position: "asc" } } },
      },
    },
  });

  return NextResponse.json({ value: favorites.map(({ soundtrack }) => serializeSoundtrack(soundtrack)) });
}