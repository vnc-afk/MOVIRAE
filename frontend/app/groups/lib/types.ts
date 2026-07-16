import type { Group, UserProfile, Movie } from "@/lib/types";

export interface GroupRecord extends Group {
  joined?: boolean;
}

export interface GroupsSnapshot {
  groups: GroupRecord[];
  currentUser: UserProfile | null;
  page: number;
  hasMore: boolean;
}

export interface GroupsResponse {
  value?: GroupRecord[];
  currentUser?: UserProfile | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    hasPrevious: boolean;
  };
  error?: { code: string; message: string };
}

export interface DiscussionReply {
  id: string;
  tempId?: string;
  author: UserProfile;
  body: string;
  date: string;
  opId?: string;
}

export interface Discussion {
  id: string;
  tempId?: string;
  author: UserProfile;
  title: string;
  body: string;
  date: string;
  likes: number;
  replies: number;
  likedByMe?: boolean;
  replyItems?: DiscussionReply[];
  pinned?: boolean;
  movieId?: string;
  opId?: string;
}

export interface GroupDetailRecord extends GroupRecord {
  discussions?: Discussion[];
}

export interface GroupDetailResponse {
  value?: GroupDetailRecord | null;
  currentUser?: UserProfile | null;
}

export interface GroupEventRecord {
  id: string;
  tempId?: string;
  title: string;
  description?: string | null;
  startDate: string;
  startTime: string;
  location?: string | null;
  creator?: {
    id: string;
    displayName?: string | null;
    username?: string | null;
    avatar?: string | null;
  } | null;
  attendees?: Array<{
    user?: {
      id: string;
      displayName?: string | null;
      username?: string | null;
      avatar?: string | null;
    } | null;
    rsvpStatus?: 'yes' | 'no' | 'maybe' | 'pending' | 'attending' | 'not-attending';
  }>;
  opId?: string;
}

export type DiscussionSortType = 'latest' | 'popular' | 'oldest';

export type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

export type TabType = 'discussions' | 'watchlist' | 'members' | 'events';

export type FormErrors<T extends Record<string, unknown>> = Partial<
  Record<keyof T, string>
>;

export interface CreateGroupFormData {
  name: string;
  description: string;
}

export interface CreateDiscussionFormData {
  title: string;
  body: string;
  movieId?: string;
}

export interface CreateEventFormData {
  title: string;
  description?: string;
  startDate: string;
  startTime: string;
  location?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}