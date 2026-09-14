import { formatDistanceToNowStrict } from "date-fns";
import type { GroupRecord, Discussion, GroupEventRecord } from "./types";
import { isGroupAdmin } from "@/services/groups/admin.server";

const inFlightJsonRequests = new Map<string, Promise<FetchResult<unknown>>>();

/**
 * Builds a deterministic avatar URL for a user or group seed.
 */
export function getAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

export type FetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: null };

/**
 * Performs a JSON fetch and returns a typed result object with status information.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const shouldDedupe = method === "GET";
  const requestKey = shouldDedupe ? `${method}:${url}` : null;

  if (requestKey) {
    const existingRequest = inFlightJsonRequests.get(requestKey);
    if (existingRequest) {
      return existingRequest as Promise<FetchResult<T>>;
    }
  }

  const request = (async (): Promise<FetchResult<T>> => {
    try {
      const response = await fetch(url, init);
      const text = await response.text();
      const data = text.trim() ? (JSON.parse(text) as T) : (null as unknown as T);

      if (!response.ok) {
        console.error(`fetchJson: ${url} returned ${response.status}`);
        return { ok: false, status: response.status, data: null };
      }

      return { ok: true, status: response.status, data };
    } catch (err) {
      console.error("fetchJson error for", url, err);
      return { ok: false, status: 0, data: null };
    } finally {
      if (requestKey) {
        inFlightJsonRequests.delete(requestKey);
      }
    }
  })();

  if (requestKey) {
    inFlightJsonRequests.set(requestKey, request);
  }

  return request;
}

/**
 * Returns the parsed JSON value for a successful request, or null on failure.
 */
export async function fetchJsonValue<T>(url: string): Promise<T | null> {
  const result = await fetchJson<T>(url);
  return result.ok ? result.data : null;
}

/**
 * Represents a request failure with a parsed HTTP status and optional details.
 */
export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Parses the API payload and throws a typed error for unsuccessful responses.
 */
export async function parseApiResponse<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  let json: any = null;

  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const message =
      json?.error?.message ||
      (typeof json?.error === "string" ? json.error : null) ||
      json?.message ||
      `Request failed (${response.status})`;

    throw new ApiRequestError(message, response.status, json?.error?.code, json?.error?.details);
  }

  if (json && typeof json === "object") {
    if ("success" in json && json.success === true) {
      return json.data as T;
    }
    if ("value" in json) {
      return json.value as T;
    }
    if (json.data && typeof json.data === "object" && "value" in json.data) {
      return json.data.value as T;
    }
  }

  return json as T;
}

/**
 * Applies a join or leave change to a group's membership list and counters.
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

  return { ...group, members, memberCount: members.length, joined: shouldJoin };
}

/**
 * Sorts discussions according to the selected view mode.
 */
export function sortDiscussions(discussions: Discussion[], sortType: "latest" | "popular" | "oldest"): Discussion[] {
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
 * Orders events chronologically by combining their date and time fields.
 */
export function sortEventsByDate(events: GroupEventRecord[]): GroupEventRecord[] {
  return [...events].sort((a, b) => {
    const aDate = new Date(`${a.startDate}T${a.startTime || "00:00"}`).getTime();
    const bDate = new Date(`${b.startDate}T${b.startTime || "00:00"}`).getTime();
    return aDate - bDate;
  });
}

/**
 * Formats a discussion timestamp into a human-readable relative string.
 */
export function formatDiscussionDate(date: string): string {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  const distance = formatDistanceToNowStrict(parsedDate, { addSuffix: true });
  return distance === "0 seconds ago" ? "Just now" : distance;
}

/**
 * Creates a temporary identifier for optimistic UI updates.
 */
export function makeOptimisticTempId(prefix = "temp"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Re-export from utils.ts for backward compatibility
export { isGroupAdmin, isGroupAdminByStatus, checkAndPromoteGroupAdmin } from "@/services/groups/admin.server";

