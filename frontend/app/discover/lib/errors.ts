
/**
 * Base error type for discover-feature failures that need structured metadata.
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
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }

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
 * Wraps TMDB API failures so the discover UI can surface provider-specific error details.
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
 * Represents invalid user input or malformed filter data in the discover flow.
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
 * Captures transport-level failures when a discover request cannot reach the backend.
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
 * Signals a failed save or restore operation for discover-side persisted state.
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
 * Marks a request that was intentionally cancelled during a newer discover fetch.
 */
export class AbortedError extends DiscoverError {
  constructor(message: string = "Request was cancelled") {
    super(message, "ABORTED", undefined, { cancelled: true });
    this.name = "AbortedError";
  }
}

/**
 * Represents a discover request that exceeded the allowed timeout budget.
 */
export class TimeoutError extends DiscoverError {
  constructor(message: string = "Request timed out") {
    super(message, "TIMEOUT", undefined, { timeout: true });
    this.name = "TimeoutError";
  }
}

/**
 * Type-guards whether an unknown value is a discover-domain error instance.
 */
export function isDiscoverError(error: unknown): error is DiscoverError {
  return error instanceof DiscoverError;
}

/**
 * Identifies cancellation-style errors that should be treated as request aborts.
 */
export function isAbortError(error: unknown): error is DOMException {
  return (
    error instanceof DOMException &&
    (error.code === DOMException.ABORT_ERR || error.name === "AbortError")
  );
}

/**
 * Detects timeout-aware errors so timeout handling can be normalized consistently.
 */
export function isTimeoutError(error: unknown): error is DOMException {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.message.includes("timeout") || error.code === 20)
  );
}

/**
 * Converts an unknown thrown value into a consistent discover error object.
 *
 * @param error - The raw thrown value from a request or validation path.
 * @returns A discover-specific error with stable messaging and codes.
 */
export function normalizeError(error: unknown): DiscoverError {
  if (error instanceof DiscoverError) {
    return error;
  }

  if (isAbortError(error)) {
    return new AbortedError();
  }

  if (isTimeoutError(error)) {
    return new TimeoutError("Request timed out");
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