import { formatDistanceToNowStrict, format } from "date-fns";
import type { SharedList } from "./types";
import type { UserProfile } from "@/lib/types";
import type { Group } from "@/app/groups/lib/types";

export function formatRelativeDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const distance = formatDistanceToNowStrict(parsed, { addSuffix: true });
  return distance === "0 seconds ago" ? "Just now" : distance;
}

export function formatExactDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "PPpp");
}

export function getSafeImageSrc(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function isListOwner(list: SharedList, userId: string | null): boolean {
  if (!userId) return false;
  return list.owner.id === userId;
}

export function canEditList(list: SharedList, userId: string | null): boolean {
  if (!userId) return false;
  return isListOwner(list, userId) || list.collaborators.some((c) => c.id === userId);
}

export function getVisibilityConfig(visibility: "public" | "private" | "group") {
  const config = {
    public: { label: "Public", color: "text-green-500" },
    private: { label: "Private", color: "text-amber-500" },
    group: { label: "Group", color: "text-blue-500" },
  };
  return config[visibility] || config.public;
}

export function findGroupById(groups: Group[], groupId: string | null): Group | null {
  if (!groupId) return null;
  return groups.find((g) => g.id === groupId) ?? null;
}

export function constructUserProfile(
  authenticatedUser: Pick<UserProfile, "id" | "email"> | null | undefined,
  lists: SharedList[]
): UserProfile | null {
  if (!authenticatedUser?.id) return null;

  const foundProfile =
    lists.find((list) => list.owner.id === authenticatedUser.id)?.owner ??
    lists.flatMap((list) => list.collaborators).find((c) => c.id === authenticatedUser.id);

  if (foundProfile) return foundProfile;

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
