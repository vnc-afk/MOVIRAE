export type OpType = "create" | "like" | "update" | "delete";

export interface OptimisticOp {
  opId: string;
  type: OpType;
  tempId?: string;
  itemId?: string; // canonical id when known
  payload?: any;
  ts: number; // timestamp
}

export function generateOpId(prefix = "op") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeTempId(prefix = "tmp") {
  return `temp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function attachOpToBody(body: any, op: OptimisticOp) {
  // If body is an object, attach opId field
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return { ...body, opId: op.opId };
  }
  return { body, opId: op.opId };
}

export function attachOpToHeaders(headers: Record<string, string> | undefined, op: OptimisticOp) {
  return { ...(headers ?? {}), "x-op-id": op.opId } as Record<string, string>;
}

// Lightweight list-updater: apply optimistic update to an array immutably
export function applyOptimisticToList<T>(
  list: T[],
  matcher: (item: T) => boolean,
  updater: (item: T) => T
) {
  return list.map((item) => (matcher(item) ? updater(item) : item));
}

// Replace a temp item (matched by tempId or opId on item) with server item, dedupe by server id
export function reconcileTempItem<T extends { id?: string; tempId?: string; opId?: string }>(
  list: T[],
  op: OptimisticOp,
  serverItem: T
) {
  // prefer matching by op.tempId -> serverItem.tempId or opId
  const byOpMatch = (it: T) => (op.tempId ? it.tempId === op.tempId : op.opId ? it.opId === op.opId : false);

  // remove any item with same server id
  const filtered = list.filter((it) => !(serverItem.id && it.id === serverItem.id));

  // find index of temp
  const idx = filtered.findIndex(byOpMatch);
  if (idx === -1) {
    // prepend server item to list (or append depending on semantics) - we will append
    return [...filtered, serverItem];
  }

  const next = [...filtered.slice(0, idx), serverItem, ...filtered.slice(idx + 1)];
  return next;
}

// Rollback helper: remove temp item by op/temp id or revert by providing previous list
export function rollbackRemoveTemp<T extends { tempId?: string; opId?: string }>(
  list: T[],
  op: OptimisticOp
) {
  const byOpMatch = (it: T) => (op.tempId ? it.tempId === op.tempId : op.opId ? it.opId === op.opId : false);
  return list.filter((it) => !byOpMatch(it));
}

// Last-action-wins comparator by timestamp
export function isLater(opA: OptimisticOp, opB: OptimisticOp) {
  return opA.ts > opB.ts;
}
