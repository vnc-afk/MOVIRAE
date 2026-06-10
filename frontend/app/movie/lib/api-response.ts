import { NextResponse } from "next/server";

const errorCodeToStatus: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
};

export function apiSuccess<T>(data: T, statusCode = 200) {
  return NextResponse.json({ success: true, data }, { status: statusCode });
}

export function apiCreated<T>(data: T) {
  return apiSuccess(data, 201);
}

export function apiError(code: string, message: string, statusCode?: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status: statusCode ?? errorCodeToStatus[code] ?? 500 });
}

export function apiBadRequest(message = "Invalid request") {
  return apiError("BAD_REQUEST", message, 400);
}

export function apiUnauthorized(message = "Authentication required") {
  return apiError("UNAUTHORIZED", message, 401);
}

export function apiForbidden(message = "You don't have permission") {
  return apiError("FORBIDDEN", message, 403);
}

export function apiNotFound(resource = "Resource") {
  return apiError("NOT_FOUND", `${resource} not found`, 404);
}

export function apiInternalError(message = "Internal server error") {
  return apiError("INTERNAL_ERROR", message, 500);
}
