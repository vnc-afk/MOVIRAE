import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "./api-utils";

/**
 * Marks all unread notifications as read for the authenticated user.
 */
export async function markAllNotificationsRead(
  currentUser: CurrentUser
): Promise<{ value: { ok: true } } | { error: "unauthorized" } | { error: "not-found" }> {
  if (!currentUser) return { error: "unauthorized" };

  await prisma.notification.updateMany({
    where: { recipientId: currentUser.id, read: false },
    data: { read: true },
  });

  return { value: { ok: true } };
}

/**
 * Marks a single notification read if the current user owns it.
 */
export async function markNotificationRead(
  notificationId: string,
  currentUser: CurrentUser
): Promise<{ value: any } | { error: "unauthorized" } | { error: "not-found" }> {
  if (!currentUser) return { error: "unauthorized" };

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) return { error: "not-found" };
  if (notification.recipientId !== currentUser.id) return { error: "unauthorized" };

  const updated = await prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
  return { value: updated };
}
