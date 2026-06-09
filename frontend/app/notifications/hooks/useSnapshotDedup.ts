"use client";

import { useMemo } from "react";
import { mergePages } from "../lib/utils";

export function useSnapshotDedup<T extends { id: string }>(pages: T[][]) {
  return useMemo(() => mergePages(pages), [pages]);
}
