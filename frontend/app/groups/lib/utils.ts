import { prisma } from "@/lib/prisma";

/**
 * Query-only check for admin status (creator or explicit admin record).
 * Does not perform promotion logic.
 */
export async function isGroupAdminByStatus(userId: string, groupId: string): Promise<boolean> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });

  if (!group) return false;
  if (group.creatorId === userId) return true;

  const adminRecord = await prisma.groupAdmin.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });

  return !!adminRecord;
}

/**
 * Check promotion criteria: engagement or tenure.
 * Persists admin grant if promotion conditions are met.
 * Returns true if the user should be promoted to admin.
 */
export async function checkAndPromoteGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  // Check engagement: sum of likes + replies on user's discussions >= 5
  const discussions = await prisma.groupDiscussion.findMany({
    where: { groupId, authorId: userId },
    select: { likes: true, replies: true },
  });

  const totalEngagement = discussions.reduce((sum, doc) => sum + doc.likes + doc.replies, 0);
  if (totalEngagement >= 5) {
    await prisma.groupAdmin.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId },
    });
    return true;
  }

  // Check tenure: member for > 30 days
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { joinedAt: true },
  });

  if (!member) return false;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (member.joinedAt <= thirtyDaysAgo) {
    await prisma.groupAdmin.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId },
    });
    return true;
  }

  return false;
}

/**
 * Complete admin status check: queries explicit status and checks promotion criteria.
 * May have side-effect of persisting admin grants when promotion conditions are met.
 */
export async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  const hasStatus = await isGroupAdminByStatus(userId, groupId);
  if (hasStatus) return true;
  return checkAndPromoteGroupAdmin(userId, groupId);
}
