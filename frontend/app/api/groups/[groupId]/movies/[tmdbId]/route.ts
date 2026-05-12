import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string; tmdbId: string }> }
) {
  const { groupId, tmdbId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Validate user is a member of the group
  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  try {
    // Check if movie exists
    const movie = await prisma.groupMovie.findUnique({
      where: {
        groupId_tmdbId: { groupId, tmdbId },
      },
    });

    if (!movie) {
      return NextResponse.json({ error: "Movie not found in watchlist" }, { status: 404 });
    }

    // Delete movie
    await prisma.groupMovie.delete({
      where: {
        groupId_tmdbId: { groupId, tmdbId },
      },
    });

    publishGroupEvent(groupId, { type: "group-updated" });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("/api/groups/[groupId]/movies/[tmdbId] DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove movie" }, { status: 500 });
  }
}
