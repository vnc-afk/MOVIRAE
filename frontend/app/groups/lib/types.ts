import type { Group, UserProfile, Movie } from "@/lib/types";

// ============================================================================
// Groups List Page Types
// ============================================================================

/**
 * Extended group record with membership flag
 * Includes tracking whether the current user has joined
 */
export interface GroupRecord extends Group {
  /** Whether the current user is a member of this group */
  joined?: boolean;
}

/**
 * Snapshot of groups data with current user
 * Used as single source of truth in queryClient cache
 */
export interface GroupsSnapshot {
  groups: GroupRecord[];
  currentUser: UserProfile | null;
}

/**
 * API response structure for groups list
 */
export interface GroupsResponse {
  value?: GroupRecord[];
  currentUser?: UserProfile | null;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Groups Detail Page Types
// ============================================================================

/**
 * A reply to a discussion thread
 */
export interface DiscussionReply {
  id: string;
  /** Temporary ID for optimistic updates before server confirmation */
  tempId?: string;
  author: UserProfile;
  body: string;
  date: string;
  /** Original post ID (if this is a reply) */
  opId?: string;
}

/**
 * A discussion thread within a group
 */
export interface Discussion {
  id: string;
  /** Temporary ID for optimistic updates */
  tempId?: string;
  author: UserProfile;
  title: string;
  body: string;
  date: string;
  likes: number;
  replies: number;
  /** Whether current user has liked this discussion */
  likedByMe?: boolean;
  replyItems?: DiscussionReply[];
  /** Whether this discussion is pinned */
  pinned?: boolean;
  /** Associated movie ID (if discussion is about a specific movie) */
  movieId?: string;
  /** Original post ID (if this is a reply) */
  opId?: string;
}

/**
 * Extended group record for detail page with discussions
 */
export interface GroupDetailRecord extends GroupRecord {
  discussions?: Discussion[];
}

/**
 * API response structure for group detail
 */
export interface GroupDetailResponse {
  value?: GroupDetailRecord | null;
  currentUser?: UserProfile | null;
}

// ============================================================================
// Events Types
// ============================================================================

/**
 * Event within a group (watch parties, meetups, etc.)
 */
export interface GroupEventRecord {
  id: string;
  /** Temporary ID for optimistic updates */
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
  /** Original post ID (if this is a reply) */
  opId?: string;
}

// ============================================================================
// Enums & Unions
// ============================================================================

/** Type for sorting discussions */
export type DiscussionSortType = 'latest' | 'popular' | 'oldest';

/** State of async loading operations */
export type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/** Tab types for group detail page */
export type TabType = 'discussions' | 'watchlist' | 'members' | 'events';

// ============================================================================
// Form & Validation Types
// ============================================================================

/**
 * Form validation result
 * Maps field names to error messages
 */
export type FormErrors<T extends Record<string, unknown>> = Partial<
  Record<keyof T, string>
>;

/**
 * Create group form data
 */
export interface CreateGroupFormData {
  name: string;
  description: string;
}

/**
 * Create discussion form data
 */
export interface CreateDiscussionFormData {
  title: string;
  body: string;
  movieId?: string;
}

/**
 * Create event form data
 */
export interface CreateEventFormData {
  title: string;
  description?: string;
  startDate: string;
  startTime: string;
  location?: string;
}

// ============================================================================
// Error & Status Types
// ============================================================================

/**
 * HTTP error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Result type for operations that can fail
 * Discriminated union for type-safe error handling
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

// ============================================================================
// Pagination & List Types
// ============================================================================

/**
 * Paginated list response
 * Useful for infinite scroll or pagination
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}