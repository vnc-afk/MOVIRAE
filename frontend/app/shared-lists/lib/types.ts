import type { Group, Movie, SharedList, UserProfile } from "@/lib/types";

/**
 * Snapshot of shared lists data loaded from server
 */
export type SharedListsSnapshot = {
  lists: SharedList[];
  groups: Group[];
  currentUser: UserProfile | null;
};

/**
 * API response for shared lists
 */
export type SharedListsResponse = {
  value?: SharedList[];
  currentUser?: Pick<UserProfile, "id" | "email"> | null;
  error?: string;
};

/**
 * A single comment or reply in a shared list
 */
export type SharedListComment = NonNullable<SharedList["commentItems"]>[number];

/**
 * Movie search result with metadata
 */
export type MovieSearchState = {
  query: string;
  results: Movie[];
  isLoading: boolean;
  error: string | null;
};

/**
 * UI state for dialog management
 */
export type ListDialogState = {
  createOpen: boolean;
  selectedListId: string | null;
  replyForId: string | null;
};

/**
 * Form input state for creating new list
 */
export type NewListFormState = {
  name: string;
  description: string;
  visibility: "public" | "private" | "group";
  groupId: string;
};

/**
 * In-flight operation tracking
 */
export type MovieOperationState = {
  addingToListId: string | null;
  removingFromListId: string | null;
};
