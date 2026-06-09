"use client";

import React, { ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { isDiscoverError } from "../lib/errors";
import type { DiscoverError } from "../lib/errors";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  hasError: boolean;
}

/**
 * Error boundary for Discover feature
 * Catches React errors and displays a user-friendly error UI
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      error: null,
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      error,
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  retry = () => {
    this.setState({
      error: null,
      hasError: false,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return <DefaultErrorUI error={this.state.error} onRetry={this.retry} />;
    }

    return this.props.children;
  }
}

/**
 * Default error UI component
 */
function DefaultErrorUI({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const isDiscoverErr = isDiscoverError(error);
  const code = isDiscoverErr ? (error as DiscoverError).code : "UNKNOWN_ERROR";

  return (
    <div className="container py-8">
      <div className="max-w-md mx-auto p-6 border border-destructive/20 bg-destructive/5 rounded-lg space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            {process.env.NODE_ENV === "development" && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Debug info
                </summary>
                <pre className="mt-2 p-2 bg-secondary rounded overflow-auto max-h-48">
                  {JSON.stringify(
                    {
                      code,
                      message: error.message,
                      stack: error.stack?.split("\n").slice(0, 5),
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <RotateCw className="h-4 w-4" />
            Try again
          </button>
          <button
            onClick={() => window.location.href = "/discover"}
            className="flex-1 px-3 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Error display component for non-fatal errors (shows banner, not boundary)
 */
export function ErrorAlert({
  error,
  onDismiss,
  retryable = true,
  onRetry,
}: {
  error: Error | null;
  onDismiss?: () => void;
  retryable?: boolean;
  onRetry?: () => void;
}) {
  if (!error) return null;

  return (
    <div className="mb-4 p-4 border border-destructive/20 bg-destructive/5 rounded-lg space-y-2 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {error.message}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        {retryable && onRetry && (
          <button
            onClick={onRetry}
            className="text-xs px-2.5 py-1 rounded hover:bg-destructive/10 text-destructive font-medium transition-colors"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs px-2.5 py-1 rounded hover:bg-secondary text-muted-foreground font-medium transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}