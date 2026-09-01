import { NextResponse } from "next/server";

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

const errorCodeToStatus: Record<string, number> = {
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

export function apiSuccess<T>(data: T, statusCode = 200, meta?: Record<string, unknown>) {
  const response: ApiResponseSuccess<T> = { success: true, data };
  if (meta) {
    response.meta = meta;
  }
  return NextResponse.json(response, { status: statusCode });
}

export function apiCreated<T>(data: T, meta?: Record<string, unknown>) {
  return apiSuccess(data, 201, meta);
}

export function apiError(
  code: string,
  message: string,
  statusCode?: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status: statusCode ?? errorCodeToStatus[code] ?? 500 }
  );
}

// ============================================================================
// Convenience Wrappers for Common Errors
// ============================================================================

export function apiBadRequest(message = "Bad request") {
  return apiError("BAD_REQUEST", message, 400);
}

export function apiUnauthorized(message = "Unauthorized") {
  return apiError("UNAUTHORIZED", message, 401);
}

export function apiForbidden(message = "Forbidden") {
  return apiError("FORBIDDEN", message, 403);
}

export function apiNotFound(message = "Not found") {
  return apiError("NOT_FOUND", message, 404);
}

export function apiConflict(message = "Conflict") {
  return apiError("CONFLICT", message, 409);
}

export function apiValidationError(message = "Validation error", details?: Record<string, unknown>) {
  return apiError("VALIDATION_ERROR", message, 400, details);
}

export function apiNotImplemented(message = "Not implemented") {
  return apiError("NOT_IMPLEMENTED", message, 501);
}

export function apiServiceUnavailable(message = "Service unavailable") {
  return apiError("SERVICE_UNAVAILABLE", message, 503);
}

export function apiInternalError(message = "Internal server error") {
  return apiError("INTERNAL_ERROR", message, 500);
}
