import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  buildLogContext,
} from "@/app/groups/lib/api-utils";
import {
  apiNotFound,
  apiForbidden,
  apiBadRequest,
  apiConflict,
  apiInternalError,
} from "@/app/groups/lib/api-response";
import { fetchGroupDetail } from "@/services/groups/discussions.server";
import { publishGroupEvent } from "@/app/groups/lib/events";

export const runtime = "nodejs";

/**
 * Returns the shared movie watchlist for a group.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const logCtx = buildLogContext(_request);

  try {
    const currentUser = await requireAuth(_request);
    logCtx.userId = currentUser.id;

    const group = await fetchGroupDetail(groupId, currentUser);
    if (!group) {
      return apiNotFound("Group");
    }

    return NextResponse.json({ value: group.sharedList });
  } catch (err) {
    console.error("/api/groups/[groupId]/movies GET error:", err);
    return apiInternalError();
  }
}

/**
 * Adds a movie to the group's shared watchlist.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const logCtx = buildLogContext(request);

  try {
    const user = await requireAuth(request);
    logCtx.userId = user.id;

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    });

    if (!member) {
      return apiForbidden("Not a member of this group");
    }

    const body = await request.json().catch(() => ({}));
    const tmdbId =
      typeof body?.tmdbId === "string"
        ? body.tmdbId.trim()
        : typeof body?.movieId === "string"
        ? body.movieId.trim()
        : "";
    const metadata = body?.metadata ?? null;

    if (!tmdbId) {
      return apiBadRequest("tmdbId is required");
    }

    // Prevent duplicate watchlist entries for the same movie within a group.
    const existing = await prisma.groupMovie.findUnique({
      where: { groupId_tmdbId: { groupId, tmdbId } },
    });

    if (existing) {
      return apiConflict("Movie already in watchlist");
    }

    const movie = await prisma.groupMovie.create({
      data: { groupId, tmdbId, metadata },
    });

    const headerOpId = request.headers.get("x-op-id");
    const opId = typeof body?.opId === "string" ? body.opId : headerOpId ?? undefined;
    const group = await fetchGroupDetail(groupId, user);
    publishGroupEvent(groupId, { type: "group-updated", group: group ?? undefined }, opId);

    return NextResponse.json({ value: movie }, { status: 201 });
  } catch (err) {
    console.error("/api/groups/[groupId]/movies POST error:", err);
    return apiInternalError();
  }
}
