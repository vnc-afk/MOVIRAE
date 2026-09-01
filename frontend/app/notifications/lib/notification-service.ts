import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "./api-utils";
import { ApiError } from "./api-utils";

/**
 * Marks all unread notifications as read for the authenticated user.
 */
export async function markAllNotificationsRead(currentUser: CurrentUser): Promise<{ ok: true }> {
  if (!currentUser) {
    throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  }

  await prisma.notification.updateMany({
    where: { recipientId: currentUser.id, read: false },
    data: { read: true },
  });

  return { ok: true };
}

/**
 * Marks a single notification read if the current user owns it.
 */
export async function markNotificationRead(notificationId: string, currentUser: CurrentUser): Promise<any> {
  if (!currentUser) {
    throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  }

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) {
    throw new ApiError("NOT_FOUND", "Notification not found", 404);
  }

  if (notification.recipientId !== currentUser.id) {
    throw new ApiError("FORBIDDEN", "You don't have permission to access this notification", 403);
  }

  return await prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
}
