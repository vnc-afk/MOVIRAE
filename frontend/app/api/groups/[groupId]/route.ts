import { NextResponse } from "next/server";

import { fetchGroupDetail, getCurrentUser } from "@/lib/group-discussions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const currentUser = await getCurrentUser();

  try {
    const group = await fetchGroupDetail(groupId, currentUser);
    if (!group) {
      // Provide a short list of existing group ids to aid debugging when
      // a client requests an id that doesn't exist in the DB.
      const avail = await prisma.group.findMany({ select: { id: true }, take: 10, orderBy: { createdAt: "desc" } });
      return NextResponse.json({ error: "Group not found", availableIds: avail.map((r) => r.id) }, { status: 404 });
    }

    return NextResponse.json({ value: group });
  } catch (err) {
    // If fetchGroupDetail fails (e.g. missing JSON columns in DB),
    // log and return a minimal group shape fetched via a raw query so
    // the client can render a fallback instead of a bare 500.
    console.error("/api/groups/[groupId] GET error:", err);

    try {
      const rows: Array<{ id: string; name: string; description: string | null; avatar: string | null; "createdAt": Date }>
        = await prisma.$queryRaw`
          SELECT id, name, description, avatar, "createdAt"
          FROM "Group"
          WHERE id = ${groupId}
          LIMIT 1
        `;

      const row = rows[0];
      if (!row) {
        const avail = await prisma.group.findMany({ select: { id: true }, take: 10, orderBy: { createdAt: "desc" } });
        return NextResponse.json({ error: "Group not found", availableIds: avail.map((r) => r.id) }, { status: 404 });
      }

      const minimal = {
        id: row.id,
        name: row.name,
        description: row.description || "",
        memberCount: 0,
        avatar: row.avatar || "",
        members: [],
        sharedList: [],
        discussions: [],
        joined: false,
      };

      return NextResponse.json({ value: minimal });
    } catch (rawErr) {
      console.error("/api/groups/[groupId] raw fallback failed:", rawErr);
      const message = rawErr instanceof Error ? rawErr.message : String(rawErr);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
}