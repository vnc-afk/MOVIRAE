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
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string; eventId: string }> }
) {
  const { groupId, eventId } = await params;
  const logCtx = buildLogContext(request);

  try {
    const user = await requireAuth(request);
    logCtx.userId = user.id;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { groupId: true, createdBy: true },
    });

    if (!event || event.groupId !== groupId) {
      return apiNotFound("Event");
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { creatorId: true },
    });

    if (!group || (event.createdBy !== user.id && group.creatorId !== user.id)) {
      return apiForbidden("You can only delete this event");
    }

    await prisma.event.delete({
      where: { id: eventId },
    });

    const body = await request.json().catch(() => null);
    const headerOpId = request.headers.get("x-op-id");
    const opId = typeof body?.opId === "string" ? body.opId : headerOpId ?? undefined;

    publishGroupEvent(groupId, { type: "group-updated", action: "deleted", eventId }, opId);
    return apiNoContent();
  } catch (err) {
    console.error("/api/groups/[groupId]/events/[eventId] DELETE error:", err);
    return apiInternalError();
  }
}
