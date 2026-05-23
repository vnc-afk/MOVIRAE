"use client";

import Link from "next/link";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { scheduleMovieDetailPrefetch, cancelScheduledPrefetch } from "@/lib/prefetchHelpers";

type MoviePrefetchLinkProps = React.ComponentPropsWithoutRef<typeof Link> & {
  movieId: string;
  prefetchDelayMs?: number;
};

export function MoviePrefetchLink({ movieId, prefetchDelayMs = 150, onMouseEnter, onMouseLeave, ...props }: MoviePrefetchLinkProps) {
  const queryClient = useQueryClient();
  const tokenRef = useRef(`movie-link:${movieId}:${Math.random().toString(36).slice(2)}`);

  return (
    <Link
      {...props}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        scheduleMovieDetailPrefetch(queryClient, movieId, tokenRef.current, prefetchDelayMs);
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        cancelScheduledPrefetch(tokenRef.current);
      }}
    />
  );
}
