import { format, formatDistanceToNowStrict } from "date-fns";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { NotificationItem } from "@/lib/types";
import prefetchHelpers from "@/lib/prefetchHelpers";

export const mergePages = <T extends { id: string }>(pages: T[][]): T[] => {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const page of pages) {
    for (const item of page) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
  }

  return merged;
};

export const formatRelativeDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const distance = formatDistanceToNowStrict(parsed, { addSuffix: true });
  return distance === "0 seconds ago" ? "Just now" : distance;
};

export const formatExactDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return format(parsed, "PPpp");
};

export async function prefetchNotificationTargets(
  queryClient: QueryClient,
  notification: NotificationItem
) {
  try {
    if (notification.user?.id) {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.profile.detail(notification.user.id),
        queryFn: async () => {
          const response = await fetch(`/api/users/${notification.user.id}`);
          const json = await response.json().catch(() => null);
          return json?.value ?? json;
        },
      });
    }

    if (notification.movieId) {
      await prefetchHelpers.scheduleMovieDetailPrefetch(
        queryClient,
        notification.movieId,
        `notif-movie-${notification.movieId}`
      );
    }

    if (notification.sharedListId) {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.sharedLists.detail(notification.sharedListId),
        queryFn: async () => {
          const response = await fetch(`/api/shared-lists/${notification.sharedListId}`);
          const json = await response.json().catch(() => null);
          return json?.value ?? json;
        },
      });
    }

    if (notification.groupId) {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.group.detail(notification.groupId),
        queryFn: async () => {
          const response = await fetch(`/api/groups/${notification.groupId}`);
          const json = await response.json().catch(() => null);
          return json?.value ?? json;
        },
      });
    }
  } catch (error) {
    console.debug("Notification prefetch failed", error);
  }
}
