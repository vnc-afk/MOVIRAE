"use client";

import { useCallback, useEffect, useState } from "react";
import type { FilterPreset, FilterState } from "../lib/types";
import { ValidationError, PersistenceError, normalizeError } from "../lib/errors";
import { STORAGE_KEYS, API_CONFIG } from "../lib/constants";

/**
 * Hook: Manage user filter presets with persistence
 *
 * Responsibilities:
 * - Load presets from API
 * - Create new presets with validation
 * - Persist presets to API
 * - Delete presets
 * - Handle errors gracefully
 *
 * Usage:
 *   const presets = useFilterPresets();
 *   presets.save(name, currentFilters);
 *   presets.apply(preset);
 *   if (presets.error) return <Error />;
 */
export function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let lastError: Error | null = null;

    try {
      // Retry logic for timeout and network errors
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

          // Validate presets array
          if (!Array.isArray(data.value)) {
            throw new ValidationError("Invalid presets format: expected array", {
              received: typeof data.value,
            });
          }

          // Validate each preset
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
          return; // Success, exit retry loop
        } catch (err) {
          lastError = err as Error;
          const error = normalizeError(err);

          // Retry only on timeout or network errors
          if (error.code === "TIMEOUT" || error.code === "NETWORK_ERROR") {
            if (attempt < API_CONFIG.RETRY_ATTEMPTS) {
              console.warn(`Attempt ${attempt + 1} failed, retrying...`, error);
              // Wait before retry
              await new Promise((resolve) =>
                setTimeout(resolve, API_CONFIG.RETRY_DELAY_MS * (attempt + 1))
              );
              continue; // Try again
            }
          }

          // Don't retry on validation or persistence errors
          throw error;
        }
      }

      // If we get here, all retries failed
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

  /**
   * Validate preset name
   * @throws ValidationError if invalid
   */
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

  /**
   * Create and save a new preset
   * @returns true if successful, false otherwise
   */
  const save = useCallback(
    async (name: string, filters: FilterState): Promise<boolean> => {
      setError(null);
      setIsSaving(true);

      try {
        // Validate name
        const validName = validatePresetName(name);

        // Create preset
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

        // Persist to API
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

  /**
   * Delete a preset by ID
   * @returns true if successful, false otherwise
   */
  const remove = useCallback(
    async (presetId: string): Promise<boolean> => {
      setError(null);

      try {
        const nextPresets = presets.filter((p) => p.id !== presetId);

        // Persist to API
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