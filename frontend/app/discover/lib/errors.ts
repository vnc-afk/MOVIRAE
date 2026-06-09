/**
 * Custom error types for the Discover feature
 * Allows better error handling, logging, and user-facing messages
 */

/**
 * Base error class for all Discover-related errors
 */
export class DiscoverError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DiscoverError";
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Errors from TMDB API
 */
export class TMDBError extends DiscoverError {
  constructor(
    message: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message, "TMDB_ERROR", statusCode, details);
    this.name = "TMDBError";
  }
}

/**
 * Validation errors for input parameters
 */
export class ValidationError extends DiscoverError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, "VALIDATION_ERROR", undefined, details);
    this.name = "ValidationError";
  }
}

/**
 * Network-related errors (timeout, connection)
 */
export class NetworkError extends DiscoverError {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message, "NETWORK_ERROR", undefined, {
      originalMessage: originalError?.message,
    });
    this.name = "NetworkError";
  }
}

/**
 * Errors related to local storage or persistence
 */
export class PersistenceError extends DiscoverError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, "PERSISTENCE_ERROR", undefined, details);
    this.name = "PersistenceError";
  }
}

/**
 * Request was cancelled (user navigated away, new request started)
 */
export class AbortedError extends DiscoverError {
  constructor(message: string = "Request was cancelled") {
    super(message, "ABORTED", undefined, { cancelled: true });
    this.name = "AbortedError";
  }
}

/**
 * Type guard to check if error is a DiscoverError
 */
export function isDiscoverError(error: unknown): error is DiscoverError {
  return error instanceof DiscoverError;
}

/**
 * Type guard for abort errors
 */
export function isAbortError(error: unknown): error is DOMException {
  return (
    error instanceof DOMException &&
    (error.code === DOMException.ABORT_ERR || error.name === "AbortError")
  );
}

/**
 * Normalize any error into a DiscoverError for consistent handling
 */
export function normalizeError(error: unknown): DiscoverError {
  if (error instanceof DiscoverError) {
    return error;
  }

  if (isAbortError(error)) {
    return new AbortedError();
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new NetworkError("Network request failed", error as Error);
  }

  if (error instanceof Error) {
    return new DiscoverError(error.message, "UNKNOWN_ERROR", undefined, {
      originalName: error.name,
    });
  }

  return new DiscoverError(
    String(error),
    "UNKNOWN_ERROR",
    undefined,
    { raw: error }
  );
}