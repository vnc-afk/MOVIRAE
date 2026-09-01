import { format, formatDistanceToNowStrict } from "date-fns";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { NotificationItem } from "@/lib/types";

/**
 * Merges paginated results into a single deduplicated list.
 *
 * This helper preserves the first occurrence of each id while avoiding
 * duplicates across pages.
 */
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

/**
 * Prefetches data related to a notification so the target page loads faster.
 */
export async function prefetchNotificationTargets(queryClient: QueryClient, notification: NotificationItem) {
  const tasks: Promise<unknown>[] = [];
  const userId = notification.user?.id;

  if (userId) {
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.profile.detail(userId),
        queryFn: async () => {
          const response = await fetch(`/api/users/${userId}`);
          const json = await response.json().catch(() => null);
          return json?.value ?? json;
        },
      })
    );
  }

  if (notification.movieId) {
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.movie.detail(notification.movieId),
        queryFn: async () => {
          const response = await fetch(`/api/tmdb/movie/${notification.movieId}`);
          if (!response.ok) return null;
          return response.json();
        },
      })
    );
  }

  if (notification.sharedListId) {
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.sharedLists.detail(notification.sharedListId),
        queryFn: async () => {
          const response = await fetch(`/api/shared-lists/${notification.sharedListId}`);
          const json = await response.json().catch(() => null);
          return json?.value ?? json;
        },
      })
    );
  }

  if (notification.groupId) {
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.group.detail(notification.groupId),
        queryFn: async () => {
          const response = await fetch(`/api/groups/${notification.groupId}`);
          const json = await response.json().catch(() => null);
          return json?.value ?? json;
        },
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.debug("Notification prefetch: some targets failed", failed);
  }
}