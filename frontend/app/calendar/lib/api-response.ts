import { NextResponse } from "next/server";

export type CalendarApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type CalendarApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function apiSuccess<T>(data: T, status = 200, meta?: Record<string, unknown>) {
  const response: CalendarApiSuccess<T> = { success: true, data };
  if (meta) response.meta = meta;
  return NextResponse.json(response, { status });
}

export function apiError(code: string, message: string, status = 500, details?: Record<string, unknown>) {
  const response: CalendarApiError = { success: false, error: { code, message } };
  if (details) response.error.details = details;
  return NextResponse.json(response, { status });
}

export const apiUnauthorized = (message = "Authentication required") => apiError("UNAUTHORIZED", message, 401);
export const apiValidationError = (message: string, details?: Record<string, unknown>) => apiError("VALIDATION_ERROR", message, 400, details);
export const apiInternalError = (message = "Internal server error") => apiError("INTERNAL_ERROR", message, 500);
