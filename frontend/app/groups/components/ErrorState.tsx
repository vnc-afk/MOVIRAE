import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GroupsError } from "../hooks";

/**
 * Props for the groups error state component.
 */
interface ErrorStateProps {
  error: GroupsError;
  onRetry: () => void;
  isRetrying?: boolean;
}

/**
 * Renders a user-friendly error view for groups fetch and mutation failures.
 */
export function ErrorState({
  error,
  onRetry,
  isRetrying = false,
}: ErrorStateProps) {
  const getErrorTitle = (error: GroupsError): string => {
    switch (error.type) {
      case 'NETWORK':
        return 'Connection Error';
      case 'AUTH':
        return 'Authentication Required';
      case 'SERVER':
        return 'Something went wrong';
      case 'VALIDATION':
        return 'Invalid Request';
      default:
        return 'Error';
    }
  };

  const getErrorDescription = (error: GroupsError): string => {
    switch (error.type) {
      case 'NETWORK':
        return 'Please check your internet connection and try again.';
      case 'AUTH':
        return 'You need to sign in to access groups.';
      case 'SERVER':
        return 'The server encountered an error. Please try again later.';
      case 'VALIDATION':
        return 'Please check your input and try again.';
      default:
        return 'An unexpected error occurred.';
    }
  };

  return (
    <div 
      className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-8"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <AlertTriangle 
          className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-red-900 dark:text-red-100">
            {getErrorTitle(error)}
          </h2>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">
            {getErrorDescription(error)}
          </p>
          {error.message && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-2 font-mono break-words">
              {error.message}
            </p>
          )}
          
          <div className="flex gap-2 mt-4">
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              variant="default"
              size="sm"
              className="gap-2"
              aria-busy={isRetrying}
            >
              <RefreshCw 
                className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </Button>

            {error.type === 'AUTH' && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href="/login">
                  Sign In
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}