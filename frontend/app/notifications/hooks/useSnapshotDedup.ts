"use client";

import { useMemo } from "react";
import { mergePages } from "../lib/utils";

/**
 * Deduplicates paginated snapshot pages by item id.
 *
 * This hook preserves memoization while merging page results into a single list.
 */
export function useSnapshotDedup<T extends { id: string }>(pages: T[][]) {
  return useMemo(() => mergePages(pages), [pages]);
}
