import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  buildLogContext,
} from "@/app/groups/lib/api-utils";
import {
  apiNoContent,
  apiNotFound,
  apiForbidden,
  apiInternalError,
} from "@/app/groups/lib/api-response";
import { fetchGroupDetail } from "@/lib/group-discussions";
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string; tmdbId: string }> }
) {
  const { groupId, tmdbId } = await params;
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

    const movie = await prisma.groupMovie.findUnique({
      where: { groupId_tmdbId: { groupId, tmdbId } },
    });

    if (!movie) {
      return apiNotFound("Movie");
    }

    await prisma.groupMovie.delete({
      where: { groupId_tmdbId: { groupId, tmdbId } },
    });

    const body = await request.json().catch(() => null);
    const headerOpId = request.headers.get("x-op-id");
    const opId = typeof body?.opId === "string" ? body.opId : headerOpId ?? undefined;
    const group = await fetchGroupDetail(groupId, user);
    publishGroupEvent(groupId, { type: "group-updated", group: group ?? undefined }, opId);

    return apiNoContent();
  } catch (err) {
    console.error("/api/groups/[groupId]/movies/[tmdbId] DELETE error:", err);
    return apiInternalError();
  }
}
