/**
 * lib/api-utils.ts
 * 
 * Shared utilities for all API routes
 * - User/profile building
 * - Auth helpers
 * - Data serialization
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";

export { buildUserProfile } from "@/lib/features/profiles/service";

// ============================================================================
// Shared Prisma Selects
// ============================================================================

/**
 * Standard user fields for profile selection
 * Used across discussions, events, and group member serialization
 */
export const USER_SELECT_PROFILE = {
  id: true,
  email: true,
  name: true,
  username: true,
  displayName: true,
  avatar: true,
  image: true,
  bio: true,
} as const;

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      displayName: true,
      avatar: true,
      image: true,
      bio: true,
    },
  });
}

/**
 * Require authentication and return user
 * Throws error if not authenticated
 */
export async function requireAuth(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      displayName: true,
      avatar: true,
      image: true,
      bio: true,
    },
  });

  if (!user) {
    throw new ApiError("USER_NOT_FOUND", "User not found", 404);
  }

  return user;
}

// ============================================================================
// Data Serialization
// ============================================================================

/**
 * Serialize a date to YYYY-MM-DD format
 */
export function serializeDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Check if user is an admin of a group
 */
export async function isGroupAdminUser(userId: string, groupId: string): Promise<boolean> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });

  if (!group) return false;
  if (group.creatorId === userId) return true;

  const adminRecord = await prisma.groupAdmin.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });

  return !!adminRecord;
}

/**
 * Generic serializer for events with Date fields
 */
export function serializeEvent<T extends { startDate: Date }>(event: T): Omit<T, "startDate"> & { startDate: string } {
  return {
    ...event,
    startDate: serializeDate(event.startDate),
  };
}

// ============================================================================
// Error Handling
// ============================================================================

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Format error for API response
 */
export function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: error.message,
      statusCode: 500,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    statusCode: 500,
  };
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Parse pagination params from URL search params
 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Build pagination metadata
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Parse sort params from URL
 */
export function parseSort(
  searchParams: URLSearchParams,
  allowedFields: string[] = []
) {
  const sortBy = searchParams.get("sort") || "createdAt";
  const order = (searchParams.get("order") || "desc") as "asc" | "desc";

  // Validate sort field if allowed fields specified
  if (allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
    return { sortBy: "createdAt", order: "desc" as const };
  }

  return { sortBy, order };
}

// ============================================================================
// Logging Context
// ============================================================================

/**
 * Build logging context for an API request
 */
export function buildLogContext(request: Request, userId?: string) {
  return {
    method: request.method,
    url: new URL(request.url).pathname,
    userId,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for") || "unknown",
  };
}