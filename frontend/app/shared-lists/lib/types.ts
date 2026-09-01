import type { Movie, UserProfile } from "@/lib/types";
import type { Group } from "@/app/groups/lib/types";

/*
  Shared types used by the shared-lists UI layer.
  - Keep these lightweight and focused on the client-side snapshot + small pieces of UI state.
  - `SharedListsSnapshot` represents the shape stored in the react-query cache.
*/

export interface SharedList {
  id: string;
  name: string;
  description: string;
  visibility: "public" | "private" | "group";
  owner: UserProfile;
  collaborators: UserProfile[];
  movies: Movie[];
  likes: number;
  likedByMe?: boolean;
  comments: number;
  commentItems?: SharedListComment[];
  createdAt: string;
  groupId?: string;
  groupName?: string;
}

export interface SharedListComment {
  id: string;
  user: UserProfile;
  body: string;
  date: string;
  parentId?: string | null;
  replies: SharedListComment[];
}

export type SharedListsSnapshot = {
  lists: SharedList[];
  groups: Group[];
  currentUser: UserProfile | null;
  page: number;
  hasMore: boolean;
};

export type SharedListsResponse = {
  value?: SharedList[];
  currentUser?: Pick<UserProfile, "id" | "email"> | null;
  error?: string;
  hasMore?: boolean;
  nextPage?: number | null;
};

export type MovieSearchState = {
  query: string;
  results: Movie[];
  isLoading: boolean;
  error: string | null;
};

export type ListDialogState = {
  createOpen: boolean;
  selectedListId: string | null;
  replyForId: string | null;
};

export type NewListFormState = {
  name: string;
  description: string;
  visibility: "public" | "private" | "group";
  groupId: string;
};

export type MovieOperationState = {
  addingToListId: string | null;
  removingFromListId: string | null;
};

/* Notes:
 - `ListDialogState` and `NewListFormState` model ephemeral UI forms and dialogs.
 - Keep these types in sync with the components that consume them.
*/