import { prisma } from "@/lib/prisma";

/**
 * Determines whether a user should be considered a group admin.
 *
 * Rules applied (in order):
 * - The group creator is always an admin.
 * - Explicit `groupAdmin` records grant admin privileges.
 * - Users with sufficient discussion engagement (likes + replies >= 5)
 *   are promoted to admin automatically and the record is persisted.
 * - Long-standing members (joined > 30 days ago) are also promoted and persisted.
 *
 * This function performs read checks and may persist an upserted admin
 * record as a side-effect when promotion conditions are met.
 */
export async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  // Fast path: load the group's creator and short-circuit if missing
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });

  if (!group) return false;
  if (group.creatorId === userId) return true; // Creator is always admin

  // Check explicit admin grant
  const adminRecord = await prisma.groupAdmin.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });
  if (adminRecord) return true;

  // Promotion: consider active contributors by summing likes+replies on their discussions
  const discussionDocs = await prisma.groupDiscussion.findMany({
    where: { groupId, authorId: userId },
    select: { likes: true, replies: true },
  });

  const totalEngagement = discussionDocs.reduce((sum, doc) => sum + doc.likes + doc.replies, 0);
  if (totalEngagement >= 5) {
    // Persist the admin grant for future fast-path checks
    await prisma.groupAdmin.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId },
    });
    return true;
  }

  // Check membership tenure: members present for more than 30 days get promoted
  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
    select: { joinedAt: true },
  });

  if (!member) return false;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (member.joinedAt <= thirtyDaysAgo) {
    // Persist the admin grant for long-tenured members
    await prisma.groupAdmin.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId },
    });
    return true;
  }

  return false;
}
