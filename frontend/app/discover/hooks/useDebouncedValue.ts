"use client";

import { useEffect, useState } from "react";

/**
 * Delays the latest value update so lightweight search inputs do not trigger a request on every keystroke.
 *
 * @param value - Current value that should be debounced.
 * @param delayMs - Time to wait before exposing the latest value.
 * @returns The most recent stable value after the debounce window.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}