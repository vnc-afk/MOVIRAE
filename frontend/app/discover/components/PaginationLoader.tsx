"use client";

import { memo, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { PAGINATION_CONFIG } from "../lib/constants";

interface PaginationLoaderProps {
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

/**
 * Infinite-scroll pagination loader using an intersection observer sentinel.
 */
export const PaginationLoader = memo(function PaginationLoader({
  isLoading,
  hasMore,
  onLoadMore,
}: PaginationLoaderProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!isLoading) {
      requestedRef.current = false;
    }
  }, [isLoading]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            !requestedRef.current &&
            !isLoading &&
            hasMore
          ) {
            requestedRef.current = true;
            onLoadMore();
          }
        }
      },
      { rootMargin: PAGINATION_CONFIG.INTERSECTION_OBSERVER_MARGIN }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div className="mt-8 flex min-h-24 flex-col items-center gap-4">
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {isLoading ? (
        <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading more...</span>
        </div>
      ) : hasMore ? (
        <button
          onClick={onLoadMore}
          className="h-10 rounded-md border border-primary/30 bg-primary/10 px-4 text-sm text-primary transition-colors hover:border-primary/50 hover:bg-primary/20"
        >
          Load more
        </button>
      ) : (
        <div className="flex h-10 items-center text-sm text-muted-foreground">
          End of results
        </div>
      )}
    </div>
  );
});
