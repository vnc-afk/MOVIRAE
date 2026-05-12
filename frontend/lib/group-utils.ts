import { prisma } from "@/lib/prisma";

/**
 * Check if a user is an admin of a group.
 * Admin = group creator OR has ≥5 engagement (likes/replies on discussions) OR joined >30 days ago
 */
export async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  // Check if user is group creator
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });

  if (!group) return false;
  if (group.creatorId === userId) return true;

  // Check if user is explicitly marked as admin
  const adminRecord = await prisma.groupAdmin.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });
  if (adminRecord) return true;

  // Check if user has high engagement (≥5 likes/replies on discussions)
  const discussionDocs = await prisma.groupDiscussion.findMany({
    where: { groupId, authorId: userId },
    select: { likes: true, replies: true },
  });

  const totalEngagement = discussionDocs.reduce((sum, doc) => sum + doc.likes + doc.replies, 0);
  if (totalEngagement >= 5) {
    // Auto-promote to admin
    await prisma.groupAdmin.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId },
    });
    return true;
  }

  // Check if user joined >30 days ago
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
    // Auto-promote to admin
    await prisma.groupAdmin.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId },
    });
    return true;
  }

  return false;
}
