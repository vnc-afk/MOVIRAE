import { NotificationItem } from "@/lib/types";

export function getNotificationLink(notification: NotificationItem): string {
  const userId = notification.user?.id;

  switch (notification.type) {
    case "follow":
      return userId ? `/profile/${userId}` : "/";

    case "review_like":
    case "review_reply":
      if (notification.movieId) {
        return `/movie/${notification.movieId}#reviews`;
      }
      return "/";

    case "discussion_created":
    case "discussion_like":
    case "discussion_reply":
      if (notification.groupId && notification.discussionId) {
        return `/groups/${notification.groupId}?discussionId=${notification.discussionId}`;
      }
      if (notification.groupId) {
        return `/groups/${notification.groupId}#discussions`;
      }
      return "/";

    case "event_created":
      if (notification.groupId) {
        return `/groups/${notification.groupId}?tab=events`;
      }
      return "/";

    case "shared_list_like":
    case "shared_list_comment":
      if (notification.sharedListId) {
        return `/shared-lists?listId=${notification.sharedListId}`;
      }
      return "/";

    case "group_invite":
      if (notification.groupId) {
        return `/groups/${notification.groupId}`;
      }
      return "/";

    case "recommendation":
      if (notification.movieId) {
        return `/movie/${notification.movieId}`;
      }
      return "/";

    default:
      return "/";
  }
}
