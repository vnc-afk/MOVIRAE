"use client";

import Link from "next/link";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
        void queryClient.prefetchQuery({
          queryKey: ["movie", "detail", movieId],
          queryFn: async () => {
            const response = await fetch(`/api/tmdb/movie/${movieId}`);
            if (!response.ok) return null;
            return response.json();
          },
        });
      }}
      onMouseLeave={onMouseLeave}
    />
  );
}
