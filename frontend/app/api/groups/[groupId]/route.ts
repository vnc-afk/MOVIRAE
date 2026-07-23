import { NextResponse } from "next/server";

import { fetchGroupDetail, getCurrentUser } from "@/lib/group-discussions";
import { buildUserProfile } from "@/lib/user-profiles";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Returns the full detail payload for a single group, including members, discussions, and watchlist data.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const currentUser = await getCurrentUser();

  try {
    // The shared detail loader already assembles the group shape expected by the UI.
    const group = await fetchGroupDetail(groupId, currentUser);
    if (!group) {
      const avail = await prisma.group.findMany({ select: { id: true }, take: 10, orderBy: { createdAt: "desc" } });
      console.warn("/api/groups/[groupId]: group not found", {
        requestedId: groupId,
        availableIds: avail.map((r: { id: string }) => r.id),
      });
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ value: group, currentUser: buildUserProfile(currentUser) });
  } catch (err) {
    console.error("/api/groups/[groupId] GET error:", err);

    try {
      const rows: Array<{
        id: string;
        name: string;
        description: string | null;
        avatar: string | null;
        creatorId: string;
        createdAt: Date;
      }> = await prisma.$queryRaw`
          SELECT id, name, description, avatar, "creatorId", "createdAt"
          FROM "Group"
          WHERE id = ${groupId}
          LIMIT 1
        `;

      const row = rows[0];
      if (!row) {
        const avail = await prisma.group.findMany({ select: { id: true }, take: 10, orderBy: { createdAt: "desc" } });
        console.warn("/api/groups/[groupId]: raw fallback also found no group", {
          requestedId: groupId,
          availableIds: avail.map((r: { id: string }) => r.id),
        });
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      const minimal = {
        id: row.id,
        name: row.name,
        description: row.description || "",
        memberCount: 0,
        avatar: row.avatar || "",
        creatorId: row.creatorId,
        members: [],
        sharedList: [],
        discussions: [],
        joined: false,
      };

      return NextResponse.json({ value: minimal, currentUser: buildUserProfile(currentUser) });
    } catch (rawErr) {
      console.error("/api/groups/[groupId] raw fallback failed:", rawErr);
      return NextResponse.json({ error: "Failed to load group" }, { status: 500 });
    }
  }
}