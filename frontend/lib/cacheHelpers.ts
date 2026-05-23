import { QueryClient } from "@tanstack/react-query";

export function applyEntityUpdate<T = any>(
  client: QueryClient,
  keys: readonly (readonly unknown[])[],
  updater: (current: T | undefined) => T | undefined
) {
  for (const key of keys) {
    client.setQueryData(key as any, (current: T | undefined) => {
      try {
        return updater(current);
      } catch (e) {
        console.error("applyEntityUpdate failed", e);
        return current as any;
      }
    });
  }
}

export function insertIntoList<T = any>(
  client: QueryClient,
  listKey: readonly unknown[],
  item: T,
  opts?: { atStart?: boolean }
) {
  client.setQueryData(listKey as any, (current: T[] | undefined) => {
    const next = (current ?? []).slice();
    if (opts?.atStart) next.unshift(item);
    else next.push(item);
    return next;
  });
}

export function mergeEntities<T extends Record<string, any>>(a: T, b: Partial<T>): T {
  return { ...a, ...b } as T;
}

export default {
  applyEntityUpdate,
  insertIntoList,
  mergeEntities,
};
