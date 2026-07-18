"use client";

import { useCallback, useEffect, useState } from "react";
import type { FilterPreset, FilterState } from "../lib/types";
import { ValidationError, PersistenceError, normalizeError } from "../lib/errors";
import { STORAGE_KEYS, API_CONFIG } from "../lib/constants";

/**
 * Manages saved filter presets including load, save, and delete operations.
 */
export function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    // Retry transient preset fetch failures before falling back to an empty list.

    let lastError: Error | null = null;

    try {
      for (let attempt = 0; attempt <= API_CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
          const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
          const response = await fetch("/api/data/user-filter-presets", { signal });

          if (!response.ok) {
            throw new PersistenceError(
              `Failed to load presets: ${response.statusText}`,
              { statusCode: response.status }
            );
          }

          const data = await response.json();

          if (!Array.isArray(data.value)) {
            throw new ValidationError("Invalid presets format: expected array", {
              received: typeof data.value,
            });
          }

          const validPresets = data.value.filter((p: any) => {
            if (!p.id || typeof p.id !== "string") {
              console.warn("Skipping preset with invalid ID:", p);
              return false;
            }
            if (!p.name || typeof p.name !== "string") {
              console.warn("Skipping preset with invalid name:", p);
              return false;
            }
            return true;
          });

          setPresets(validPresets);
          return; 
        } catch (err) {
          lastError = err as Error;
          const error = normalizeError(err);

          if (error.code === "TIMEOUT" || error.code === "NETWORK_ERROR") {
            if (attempt < API_CONFIG.RETRY_ATTEMPTS) {
              console.warn(`Attempt ${attempt + 1} failed, retrying...`, error);              await new Promise((resolve) =>
                setTimeout(resolve, API_CONFIG.RETRY_DELAY_MS * (attempt + 1))
              );
              continue; 
            }
          }

          throw error;
        }
      }

      if (lastError) {
        throw normalizeError(lastError);
      }
    } catch (err) {
      const error = normalizeError(err);
      setError(error);
      console.error("Failed to load presets:", error);
      setPresets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function validatePresetName(name: string): string {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new ValidationError("Preset name cannot be empty");
    }

    if (trimmed.length > 50) {
      throw new ValidationError("Preset name must be 50 characters or less", {
        length: trimmed.length,
      });
    }

    if (presets.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new ValidationError(`Preset "${trimmed}" already exists`);
    }

    return trimmed;
  }

  const save = useCallback(
    async (name: string, filters: FilterState): Promise<boolean> => {
      // Create and persist a new preset using the backend storage API.
      setError(null);
      setIsSaving(true);

      try {
        const validName = validatePresetName(name);

        const newPreset: FilterPreset = {
          id: `fp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: validName,
          filters: {
            genreId: filters.genreId,
            minRuntime: filters.runtimeRange[0],
            maxRuntime: filters.runtimeRange[1],
          },
        };

        const nextPresets = [...presets, newPreset];

        const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
        const response = await fetch("/api/data/user-filter-presets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextPresets),
          signal,
        });

        if (!response.ok) {
          throw new PersistenceError(
            `Failed to save preset: ${response.statusText}`,
            { statusCode: response.status }
          );
        }

        setPresets(nextPresets);
        return true;
      } catch (err) {
        const error = normalizeError(err);
        setError(error);
        console.error("Failed to save preset:", error);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [presets]
  );

  const remove = useCallback(
    async (presetId: string): Promise<boolean> => {
      // Delete a preset and sync the remaining list with backend storage.
      setError(null);

      try {
        const nextPresets = presets.filter((p) => p.id !== presetId);
        
        const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
        const response = await fetch("/api/data/user-filter-presets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextPresets),
          signal,
        });

        if (!response.ok) {
          throw new PersistenceError(
            `Failed to delete preset: ${response.statusText}`,
            { statusCode: response.status }
          );
        }

        setPresets(nextPresets);
        return true;
      } catch (err) {
        const error = normalizeError(err);
        setError(error);
        console.error("Failed to delete preset:", error);
        return false;
      }
    },
    [presets]
  );

  return {
    presets,
    isLoading,
    isSaving,
    error,
    save,
    remove,
    reload: loadPresets,
  };
}