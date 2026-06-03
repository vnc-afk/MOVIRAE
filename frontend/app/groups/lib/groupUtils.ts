import { formatDistanceToNowStrict } from "date-fns";
import type { GroupRecord, Discussion, GroupEventRecord } from "./types";

/**
 * Generate avatar URL using dicebear API
 */
export function getAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

/**
 * Fetch JSON from API with error handling
 */
export async function fetchJsonValue<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`fetchJsonValue: ${url} returned ${response.status}: ${errText}`);
      return null;
    }

    const text = await response.text();
    if (!text.trim()) return null;

    return JSON.parse(text) as T;
  } catch (err) {
    console.error("fetchJsonValue error for", url, err);
    return null;
  }
}

/**
 * Apply membership change to group (join or leave)
 */
export function applyMembership(
  group: GroupRecord,
  currentUser: any,
  shouldJoin: boolean
): GroupRecord {
  if (!currentUser) return group;

  const alreadyMember = group.members.some((member) => member.id === currentUser.id);
  const members = shouldJoin
    ? alreadyMember
      ? group.members
      : [currentUser, ...group.members]
    : group.members.filter((member) => member.id !== currentUser.id);

  return {
    ...group,
    members,
    memberCount: members.length,
    joined: shouldJoin,
  };
}

/**
 * Sort discussions by type
 */
export function sortDiscussions(
  discussions: Discussion[],
  sortType: "latest" | "popular" | "oldest"
): Discussion[] {
  const items = [...discussions];

  switch (sortType) {
    case "popular":
      return items.sort((a, b) => b.likes - a.likes);
    case "oldest":
      return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    case "latest":
    default:
      return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

/**
 * Sort events by date/time (ascending - soonest first)
 */
export function sortEventsByDate(events: GroupEventRecord[]): GroupEventRecord[] {
  return [...events].sort((a, b) => {
    const aDate = new Date(`${a.startDate}T${a.startTime || "00:00"}`).getTime();
    const bDate = new Date(`${b.startDate}T${b.startTime || "00:00"}`).getTime();
    return aDate - bDate;
  });
}

/**
 * Format discussion date in relative format
 */
export function formatDiscussionDate(date: string): string {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;

  const distance = formatDistanceToNowStrict(parsedDate, { addSuffix: true });
  return distance === "0 seconds ago" ? "Just now" : distance;
}

/**
 * Generate temporary ID for optimistic updates
 */
export function makeOptimisticTempId(prefix = "temp"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if user is admin of group
 */
export function isGroupAdmin(currentUser: any, group: GroupRecord): boolean {
  if (!currentUser || !group) return false;
  return currentUser.id === group.creatorId;
}
