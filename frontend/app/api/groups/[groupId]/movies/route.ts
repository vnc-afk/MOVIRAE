import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { fetchGroupDetail } from "@/lib/group-discussions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
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

  const body = await request.json().catch(() => null);
  const tmdbId = typeof body?.tmdbId === "string" ? body.tmdbId.trim() : "";
  const metadata = body?.metadata || null;

  if (!tmdbId) {
    return NextResponse.json({ error: "tmdbId is required" }, { status: 400 });
  }

  try {
    // Check if movie already exists in group
    const existing = await prisma.groupMovie.findUnique({
      where: {
        groupId_tmdbId: { groupId, tmdbId },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Movie already in watchlist" }, { status: 409 });
    }

    // Add movie to group
    const movie = await prisma.groupMovie.create({
      data: {
        groupId,
        tmdbId,
        metadata,
      },
    });

    const headerOpId = request.headers.get("x-op-id");
    const opId = typeof body?.opId === "string" ? body.opId : headerOpId ?? undefined;
    const group = await fetchGroupDetail(groupId, user);
    publishGroupEvent(groupId, { type: "group-updated", group: group ?? undefined }, opId);
    return NextResponse.json(movie, { status: 201 });
  } catch (err) {
    console.error("/api/groups/[groupId]/movies POST error:", err);
    return NextResponse.json({ error: "Failed to add movie" }, { status: 500 });
  }
}
