import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";

export interface MovieVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
  published_at?: string;
}

/**
 * Loads a movie's video assets from TMDB for the trailer modal.
 * Uses prefetch-aware React Query to avoid unnecessary loading when the
 * movie id is not yet available or the modal is closed.
 */
export function useMovieVideos(movieId: string, enabled = true) {
  return usePrefetchAwareQuery<MovieVideo[]>({
    queryKey: queryKeys.movie.videos(movieId),
    queryFn: async () => {
      const res = await fetch(`/api/tmdb/videos/${movieId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data as MovieVideo[] : [];
    },
    enabled: enabled && Boolean(movieId),
  });
}
