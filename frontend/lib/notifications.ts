import { NotificationItem } from "./types";

/**
 * Generate the navigation link for a notification based on its type and context
 */
export function getNotificationLink(notification: NotificationItem): string {
  switch (notification.type) {
    case "follow":
      // Link to the follower's profile
      return `/profile/${notification.user.id}`;

    case "review_like":
    case "review_reply":
      // Link to the movie's reviews section
      if (notification.movieId) {
        return `/movie/${notification.movieId}#reviews`;
      }
      // Fallback if no movieId
      return "/";

    case "discussion_created":
    case "discussion_like":
    case "discussion_reply":
      // Link to the group discussion
      if (notification.groupId && notification.discussionId) {
        return `/groups/${notification.groupId}?discussionId=${notification.discussionId}`;
      }
      if (notification.groupId) {
        return `/groups/${notification.groupId}#discussions`;
      }
      return "/";

    case "event_created":
      // Link to the group events section
      if (notification.groupId) {
        return `/groups/${notification.groupId}?tab=events`;
      }
      return "/";

    case "shared_list_like":
    case "shared_list_comment":
      // Link to the shared list
      if (notification.sharedListId) {
        return `/shared-lists?listId=${notification.sharedListId}`;
      }
      return "/";

    case "group_invite":
      // Link to the group
      if (notification.groupId) {
        return `/groups/${notification.groupId}`;
      }
      return "/";

    case "recommendation":
      // Link to the recommended movie
      if (notification.movieId) {
        return `/movie/${notification.movieId}`;
      }
      return "/";

    default:
      return "/";
  }
}
