import { formatDistanceToNowStrict, format } from "date-fns";
import { Group, SharedList, UserProfile } from "@/lib/types";

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const distance = formatDistanceToNowStrict(parsed, { addSuffix: true });
  return distance === "0 seconds ago" ? "Just now" : distance;
}

/**
 * Format a date as exact timestamp (e.g., "June 1, 2025, 2:30 PM")
 */
export function formatExactDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "PPpp");
}

/**
 * Safely handle image URLs, trim and validate
 */
export function getSafeImageSrc(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

/**
 * Check if current user owns a list
 */
export function isListOwner(list: SharedList, userId: string | null): boolean {
  if (!userId) return false;
  return list.owner.id === userId;
}

/**
 * Check if current user can edit a list (owner or collaborator)
 */
export function canEditList(list: SharedList, userId: string | null): boolean {
  if (!userId) return false;
  return isListOwner(list, userId) || list.collaborators.some((c) => c.id === userId);
}

/**
 * Get visibility label and icon config
 */
export function getVisibilityConfig(visibility: "public" | "private" | "group") {
  const config = {
    public: { label: "Public", color: "text-green-500" },
    private: { label: "Private", color: "text-amber-500" },
    group: { label: "Group", color: "text-blue-500" },
  };
  return config[visibility] || config.public;
}

/**
 * Find group by ID
 */
export function findGroupById(groups: Group[], groupId: string | null): Group | null {
  if (!groupId) return null;
  return groups.find((g) => g.id === groupId) ?? null;
}

/**
 * Construct user profile from minimal auth data and fallback to existing profiles
 */
export function constructUserProfile(
  authenticatedUser: Pick<UserProfile, "id" | "email"> | null | undefined,
  lists: SharedList[]
): UserProfile | null {
  if (!authenticatedUser?.id) return null;

  // Try to find complete profile from lists
  const foundProfile =
    lists.find((list) => list.owner.id === authenticatedUser.id)?.owner ??
    lists.flatMap((list) => list.collaborators).find((c) => c.id === authenticatedUser.id);

  if (foundProfile) return foundProfile;

  // Create minimal profile from auth data
  const username = authenticatedUser.email?.split("@")[0] ?? "user";
  return {
    id: authenticatedUser.id,
    email: authenticatedUser.email,
    username,
    displayName: username,
    avatar: "",
    bio: "",
    followers: 0,
    following: 0,
    reviewCount: 0,
    watchlistCount: 0,
    favoriteMovies: [],
  };
}

/**
 * Recursively append a reply to nested comment structure
 */
export function appendReplyToComments(
  comments: NonNullable<SharedList["commentItems"]>[],
  parentId: string,
  reply: NonNullable<SharedList["commentItems"]>[number]
): NonNullable<SharedList["commentItems"]>[] {
  return comments.map((comment: any) => {
    if (comment.id === parentId) {
      return {
        ...comment,
        replies: [...comment.replies, reply],
      };
    }

    return {
      ...comment,
      replies: appendReplyToComments(comment.replies, parentId, reply),
    };
  });
}
