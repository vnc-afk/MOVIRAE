"use client";

import { ReactNode, useMemo } from "react";
import { OptimisticContext, useOptimisticOpsStore } from "./useOptimisticOps";

export function OptimisticProvider({ children }: { children: ReactNode }) {
  const store = useOptimisticOpsStore();
  const memoizedStore = useMemo(() => store, [store]);

  return (
    <OptimisticContext.Provider value={memoizedStore}>
      {children}
    </OptimisticContext.Provider>
  );
}
