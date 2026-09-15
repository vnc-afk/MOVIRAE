import { NextResponse } from "next/server";

export type SoundtrackApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type SoundtrackApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function apiSuccess<T>(
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): NextResponse<SoundtrackApiSuccess<T>> {
  const response: SoundtrackApiSuccess<T> = { success: true, data };
  if (meta) response.meta = meta;
  return NextResponse.json(response, { status: statusCode });
}

export function apiError(
  code: string,
  message: string,
  statusCode = 500,
  details?: Record<string, unknown>
): NextResponse<SoundtrackApiError> {
  const response: SoundtrackApiError = {
    success: false,
    error: { code, message },
  };
  if (details) response.error.details = details;
  return NextResponse.json(response, { status: statusCode });
}

export function apiValidationError(
  message: string,
  details?: Record<string, unknown>
) {
  return apiError("VALIDATION_ERROR", message, 400, details);
}

export function apiInternalError(message = "Internal server error") {
  return apiError("INTERNAL_ERROR", message, 500);
}
