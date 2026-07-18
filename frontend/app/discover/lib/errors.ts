
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

export class ValidationError extends DiscoverError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, "VALIDATION_ERROR", undefined, details);
    this.name = "ValidationError";
  }
}

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

export class PersistenceError extends DiscoverError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, "PERSISTENCE_ERROR", undefined, details);
    this.name = "PersistenceError";
  }
}

export class AbortedError extends DiscoverError {
  constructor(message: string = "Request was cancelled") {
    super(message, "ABORTED", undefined, { cancelled: true });
    this.name = "AbortedError";
  }
}

export class TimeoutError extends DiscoverError {
  constructor(message: string = "Request timed out") {
    super(message, "TIMEOUT", undefined, { timeout: true });
    this.name = "TimeoutError";
  }
}

export function isDiscoverError(error: unknown): error is DiscoverError {
  return error instanceof DiscoverError;
}

export function isAbortError(error: unknown): error is DOMException {
  return (
    error instanceof DOMException &&
    (error.code === DOMException.ABORT_ERR || error.name === "AbortError")
  );
}

export function isTimeoutError(error: unknown): error is DOMException {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.message.includes("timeout") || error.code === 20)
  );
}

export function normalizeError(error: unknown): DiscoverError {
  if (error instanceof DiscoverError) {
    return error;
  }

  if (isTimeoutError(error)) {
    return new TimeoutError("Request timed out");
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