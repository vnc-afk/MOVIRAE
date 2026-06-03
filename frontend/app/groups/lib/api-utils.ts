/**
 * lib/api-utils.ts
 * 
 * Shared utilities for all API routes
 * - User/profile building
 * - Auth helpers
 * - Data serialization
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserProfile } from "@/lib/types";

// ============================================================================
// User Profile Building
// ============================================================================

/**
 * Build a UserProfile from raw user data
 * Handles missing fields with sensible defaults
 */
export function buildUserProfile(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  displayName?: string | null;
  username?: string | null;
  avatar?: string | null;
  image?: string | null;
  bio?: string | null;
} | null): UserProfile | null {
  if (!user) return null;

  const displayName =
    user.displayName ||
    user.name ||
    user.email?.split("@")[0] ||
    "Movie Lover";

  const username =
    user.username ||
    displayName.toLowerCase().replace(/\s+/g, "_");

  return {
    id: user.id,
    email: user.email || undefined,
    username,
    displayName,
    avatar: user.avatar || user.image || "",
    bio: user.bio || "",
    followers: 0,
    following: 0,
    reviewCount: 0,
    watchlistCount: 0,
    favoriteMovies: [],
  };
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Get current user from session
 * Returns null if not authenticated
 */
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
      displayName: true,
      avatar: true,
      image: true,
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
// Validation Helpers
// ============================================================================

/**
 * Validate a string field
 */
export function validateStringField(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): { valid: boolean; error?: string } {
  const {
    required = true,
    minLength,
    maxLength,
    pattern,
  } = options;

  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();

  if (required && !trimmed) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (!required && !trimmed) {
    return { valid: true };
  }

  if (minLength && trimmed.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`,
    };
  }

  if (maxLength && trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be less than ${maxLength} characters`,
    };
  }

  if (pattern && !pattern.test(trimmed)) {
    return { valid: false, error: `${fieldName} has invalid format` };
  }

  return { valid: true };
}

/**
 * Validate a date field
 */
export function validateDateField(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minDate?: Date;
    maxDate?: Date;
  } = {}
): { valid: boolean; error?: string; date?: Date } {
  const { required = true, minDate, maxDate } = options;

  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  if (!value && !required) {
    return { valid: true };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} must be a valid date` };
  }

  if (minDate && date < minDate) {
    return {
      valid: false,
      error: `${fieldName} must be on or after ${minDate.toISOString().split('T')[0]}`,
    };
  }

  if (maxDate && date > maxDate) {
    return {
      valid: false,
      error: `${fieldName} must be on or before ${maxDate.toISOString().split('T')[0]}`,
    };
  }

  return { valid: true, date };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if user is a group admin
 */
export async function isGroupAdminUser(
  userId: string,
  groupId: string
): Promise<boolean> {
  const admin = await prisma.groupAdmin.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });

  return !!admin;
}

/**
 * Check if user is a group member
 */
export async function isGroupMemberUser(
  userId: string,
  groupId: string
): Promise<boolean> {
  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });

  return !!member;
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