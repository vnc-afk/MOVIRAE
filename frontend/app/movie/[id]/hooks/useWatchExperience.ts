
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { WatchExperience } from "@/lib/types";
import * as movieApi from "../lib/movieApi";

export interface UseWatchExperienceResult {
  watchExperience: WatchExperience | null;
  isSaving: boolean;
  error: string | null;
  setInitialValue: (value: WatchExperience | null) => void;
  saveWatchExperience: (experience: WatchExperience) => Promise<boolean>;
}

/**
 * Tracks the user's watch experience for a movie and persists it to the server.
 * Invalidates dependent caches after a successful save.
 */
export function useWatchExperience(movieId: string): UseWatchExperienceResult {
  const queryClient = useQueryClient();
  const [watchExperience, setWatchExperience] = useState<WatchExperience | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setInitialValue = useCallback((value: WatchExperience | null) => {
    setWatchExperience(value);
  }, []);

  const saveWatchExperience = useCallback(
    async (experience: WatchExperience): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const result = await movieApi.saveWatchExperience(movieId, experience);

        if (!result.success) {
          setError(result.error || "Failed to save watch experience");
          return false;
        }

        setWatchExperience(result.value ?? experience);

        // Invalidate stats caches
        queryClient.invalidateQueries({ queryKey: queryKeys.stats.current() });
        queryClient.invalidateQueries({ queryKey: queryKeys.wrapped.current() });

        return true;
      } finally {
        setIsSaving(false);
      }
    },
    [movieId, queryClient]
  );

  return {
    watchExperience,
    isSaving,
    error,
    setInitialValue,
    saveWatchExperience,
  };
}
