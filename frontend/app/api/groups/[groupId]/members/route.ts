import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  buildLogContext,
} from "@/app/groups/lib/api-utils";
import {
  apiCreated,
  apiNoContent,
  apiNotFound,
  apiInternalError,
} from "@/app/groups/lib/api-response";

export const runtime = "nodejs";

/**
 * Adds the authenticated user to a group as a member.
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

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      return apiNotFound("Group");
    }

    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: user.id } },
      update: {},
      create: { groupId, userId: user.id },
    });

    return apiCreated({ joined: true });
  } catch (err) {
    console.error("/api/groups/[groupId]/members POST error:", err);
    return apiInternalError();
  }
}

/**
 * Removes the authenticated user from a group membership.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const logCtx = buildLogContext(request);

  try {
    const user = await requireAuth(request);
    logCtx.userId = user.id;

    // The delete is idempotent from the client's perspective, so a missing row is treated as success.
    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: user.id } },
    });

    return apiNoContent();
  } catch (err) {
    console.error("/api/groups/[groupId]/members DELETE error:", err);

    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2025") {
      return apiNoContent();
    }

    return apiInternalError();
  }
}