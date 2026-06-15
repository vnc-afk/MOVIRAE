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
