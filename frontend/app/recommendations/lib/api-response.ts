import { NextResponse } from "next/server";

/**
 * Maps recommendation API error codes to their corresponding HTTP status values.
 */
const errorCodeToStatus: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
};

/**
 * Returns a normalized success payload for recommendations API routes.
 */
export function apiSuccess<T>(data: T, statusCode = 200) {
  return NextResponse.json({ success: true, data }, { status: statusCode });
}

/**
 * Returns a created-success payload for POST-style recommendation endpoints.
 */
export function apiCreated<T>(data: T) {
  return apiSuccess(data, 201);
}

/**
 * Returns a normalized error payload for recommendations API routes.
 */
export function apiError(code: string, message: string, statusCode?: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: statusCode ?? errorCodeToStatus[code] ?? 500 }
  );
}

/**
 * Builds a 400 response for malformed recommendation requests.
 */
export function apiBadRequest(message = "Invalid request") {
  return apiError("BAD_REQUEST", message, 400);
}

/**
 * Builds a 401 response when the caller is not authenticated.
 */
export function apiUnauthorized(message = "Authentication required") {
  return apiError("UNAUTHORIZED", message, 401);
}

/**
 * Builds a 403 response when the caller lacks access to a recommendation resource.
 */
export function apiForbidden(message = "You don't have permission") {
  return apiError("FORBIDDEN", message, 403);
}

/**
 * Builds a 404 response when the requested recommendation resource cannot be found.
 */
export function apiNotFound(resource = "Resource") {
  return apiError("NOT_FOUND", `${resource} not found`, 404);
}

/**
 * Builds a 500 response for unexpected recommendation server failures.
 */
export function apiInternalError(message = "Internal server error") {
  return apiError("INTERNAL_ERROR", message, 500);
}
