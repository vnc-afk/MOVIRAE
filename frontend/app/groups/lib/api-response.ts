/**
 * lib/api-response.ts
 * 
 * Standardized API response formatting
 * Ensures all endpoints return consistent response structure
 */

import { NextResponse } from "next/server";

// ============================================================================
// Response Types
// ============================================================================

export type ApiResponseSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiResponseError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

// ============================================================================
// Success Responses
// ============================================================================

/**
 * Return a successful response with data
 * 
 * @example
 * return apiSuccess(group, 200);
 * return apiSuccess({ items: groups, pagination: {...} }, 200, { cached: true });
 */
export function apiSuccess<T>(
  data: T,
  statusCode: number = 200,
  meta?: Record<string, unknown>
): NextResponse<ApiResponseSuccess<T>> {
  const response: ApiResponseSuccess<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Return 201 Created response (for POST requests)
 */
export function apiCreated<T>(
  data: T,
  meta?: Record<string, unknown>
): NextResponse<ApiResponseSuccess<T>> {
  return apiSuccess(data, 201, meta);
}

/**
 * Return 204 No Content response (for DELETE requests)
 */
export function apiNoContent(): NextResponse<null> {
  return new NextResponse(null, { status: 204 });
}

// ============================================================================
// Error Responses
// ============================================================================

type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED"
  | "SERVICE_UNAVAILABLE"
  | string; // Allow custom error codes

/**
 * Map error codes to HTTP status codes
 */
const errorCodeToStatus: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Return an error response
 * 
 * @example
 * return apiError("NOT_FOUND", "Group not found");
 * return apiError("VALIDATION_ERROR", "Invalid input", 400, { fields: {...} });
 */
export function apiError(
  code: ErrorCode,
  message: string,
  statusCode?: number,
  details?: Record<string, unknown>
): NextResponse<ApiResponseError> {
  const status = statusCode || errorCodeToStatus[code] || 500;

  const response: ApiResponseError = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return NextResponse.json(response, { status });
}

// ============================================================================
// Convenience Wrappers for Common Errors
// ============================================================================

export function apiBadRequest(message: string = "Bad request") {
  return apiError("BAD_REQUEST", message, 400);
}

export function apiUnauthorized(message: string = "Unauthorized") {
  return apiError("UNAUTHORIZED", message, 401);
}

export function apiForbidden(message: string = "Forbidden") {
  return apiError("FORBIDDEN", message, 403);
}

export function apiNotFound(message: string = "Not found") {
  return apiError("NOT_FOUND", message, 404);
}

export function apiConflict(message: string = "Conflict") {
  return apiError("CONFLICT", message, 409);
}

export function apiValidationError(message: string = "Validation error", details?: Record<string, unknown>) {
  return apiError("VALIDATION_ERROR", message, 400, details);
}

export function apiNotImplemented(message: string = "Not implemented") {
  return apiError("NOT_IMPLEMENTED", message, 501);
}

export function apiServiceUnavailable(message: string = "Service unavailable") {
  return apiError("SERVICE_UNAVAILABLE", message, 503);
}

export function apiInternalError(message: string = "Internal server error") {
  return apiError("INTERNAL_ERROR", message, 500);
}

// ============================================================================
// Response with Metadata (for pagination, etc.)
// ============================================================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

/**
 * Return paginated list response
 */
export function apiPaginated<T>(
  items: T[],
  pagination: PaginationMeta
): NextResponse<ApiResponseSuccess<T[]>> {
  return apiSuccess(items, 200, { pagination });
}

// ============================================================================
// Error Handling Wrapper
// ============================================================================

/**
 * Wrapper for async route handlers with automatic error handling
 * 
 * @example
 * export const POST = handleApiRoute(async (req, params) => {
 *   const user = await requireAuth(req);
 *   const result = await createGroup(user, data);
 *   return apiSuccess(result, 201);
 * });
 */
export function handleApiRoute<P extends Record<string, unknown>>(
  handler: (
    request: Request,
    params: P
  ) => Promise<NextResponse>
) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      const params = await context.params;
      return await handler(request, params);
    } catch (error) {
      // Log error
      if (error instanceof Error) {
        console.error("[API Error]", error.message, error.stack);
      } else {
        console.error("[API Error]", error);
      }

      // Return appropriate error response
      if (error instanceof Error && "statusCode" in error) {
        const typedError = error as unknown as { code: string; statusCode: number; message: string };
        return apiError(
          typedError.code,
          typedError.message,
          typedError.statusCode
        );
      }

      return apiInternalError();
    }
  };
}

