"use client";

import { createContext, useContext, useState, useCallback } from "react";

export interface InFlightOp {
  opId: string;
  type: "like" | "reply" | "post" | "comment" | "delete" | "update" | "create";
  itemId?: string;
  parentId?: string;
  payload?: Record<string, any>;
  createdAt: number;
  surface: "review" | "shared-list" | "group" | "movie" | "calendar";
}

export interface OptimisticContextType {
  inFlightOps: Map<string, InFlightOp>;
  addInFlightOp: (
    opId: string,
    op: Omit<InFlightOp, "createdAt" | "opId"> & Partial<Pick<InFlightOp, "opId">>
  ) => void;
  removeInFlightOp: (opId: string) => void;
  getInFlightOp: (opId: string) => InFlightOp | undefined;
  isInFlight: (opId: string) => boolean;
  getInFlightByItemId: (itemId: string) => InFlightOp[];
  getAllInFlight: () => InFlightOp[];
  clearInFlightOp: (opId: string) => void;
}

export const OptimisticContext = createContext<OptimisticContextType | null>(null);

export function useOptimisticOpsStore(): OptimisticContextType {
  const [inFlightOps, setInFlightOps] = useState<Map<string, InFlightOp>>(new Map());

  const addInFlightOp = useCallback((
    opId: string,
    op: Omit<InFlightOp, "createdAt" | "opId"> & Partial<Pick<InFlightOp, "opId">>
  ) => {
    setInFlightOps((prev) => {
      const next = new Map(prev);
      next.set(opId, {
        ...op,
        opId,
        createdAt: Date.now(),
      });
      return next;
    });
  }, []);

  const removeInFlightOp = useCallback((opId: string) => {
    setInFlightOps((prev) => {
      const next = new Map(prev);
      next.delete(opId);
      return next;
    });
  }, []);

  const getInFlightOp = useCallback((opId: string) => {
    return inFlightOps.get(opId);
  }, [inFlightOps]);

  const isInFlight = useCallback((opId: string) => {
    return inFlightOps.has(opId);
  }, [inFlightOps]);

  const getInFlightByItemId = useCallback((itemId: string) => {
    return Array.from(inFlightOps.values()).filter((op) => op.itemId === itemId);
  }, [inFlightOps]);

  const getAllInFlight = useCallback(() => {
    return Array.from(inFlightOps.values());
  }, [inFlightOps]);

  const clearInFlightOp = useCallback((opId: string) => {
    removeInFlightOp(opId);
  }, [removeInFlightOp]);

  return {
    inFlightOps,
    addInFlightOp,
    removeInFlightOp,
    getInFlightOp,
    isInFlight,
    getInFlightByItemId,
    getAllInFlight,
    clearInFlightOp,
  };
}

export function useOptimisticOps(): OptimisticContextType {
  const context = useContext(OptimisticContext);
  if (!context) {
    throw new Error("useOptimisticOps must be used within OptimisticProvider");
  }
  return context;
}
