import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  publishSharedListEvent,
  subscribeToSharedListEvents,
} from "@/app/shared-lists/lib/events";

describe("shared-list events", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("publishes an event to the matching list and global subscribers", () => {
    const listListener = vi.fn();
    const globalListener = vi.fn();
    const unsubscribeList = subscribeToSharedListEvents("list-1", listListener);
    const unsubscribeGlobal = subscribeToSharedListEvents(globalListener);

    publishSharedListEvent("list-1", "updated", "operation-1");

    expect(listListener).toHaveBeenCalledOnce();
    expect(globalListener).toHaveBeenCalledOnce();
    expect(listListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "updated",
        listId: "list-1",
        opId: "operation-1",
        timestamp: expect.any(String),
      })
    );

    unsubscribeList();
    unsubscribeGlobal();
  });

  it("does not notify subscribers for another list", () => {
    const listListener = vi.fn();
    const unsubscribe = subscribeToSharedListEvents("list-1", listListener);

    publishSharedListEvent("list-2", "created");

    expect(listListener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("removes subscriptions when the unsubscribe function is called", () => {
    const listListener = vi.fn();
    const globalListener = vi.fn();
    const unsubscribeList = subscribeToSharedListEvents("list-1", listListener);
    const unsubscribeGlobal = subscribeToSharedListEvents(globalListener);

    unsubscribeList();
    unsubscribeGlobal();
    publishSharedListEvent("list-1", "deleted");

    expect(listListener).not.toHaveBeenCalled();
    expect(globalListener).not.toHaveBeenCalled();
  });
});
