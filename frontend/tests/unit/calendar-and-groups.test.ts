import { afterEach, describe, expect, it, vi } from "vitest";

import { dedupeEvents, getEventsForDay, getMonthKey, getMonthParts, shiftMonth } from "@/app/calendar/lib/calendarUtils";
import {
  applyMembership,
  fetchJson,
  fetchJsonValue,
  formatDiscussionDate,
  getAvatarUrl,
  isEventPast,
  isEventUpcoming,
  makeOptimisticTempId,
  parseApiResponse,
  sortDiscussions,
  sortEventsByDate,
} from "@/app/groups/lib/groupUtils";

describe("calendar utilities", () => {
  it("handles month keys and event selection", () => {
    expect(getMonthKey(new Date(2025, 0, 5))).toBe("2025-01");
    expect(getMonthParts("2025-03")).toEqual({ year: 2025, month: 2 });
    expect(shiftMonth("2025-01", -1)).toBe("2024-12");
    const events = [
      { id: "1", date: "2025-03-04" },
      { id: "2", date: "2025-03-04" },
      { id: "3", date: "2025-03-05" },
    ] as any;
    expect(getEventsForDay(events, "2025-03", 4)).toHaveLength(2);
    expect(dedupeEvents([...events, events[0]]).map((event) => event.id)).toEqual(["1", "2", "3"]);
  });

  it("handles month rollover in both directions", () => {
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2025-01", -1)).toBe("2024-12");
    expect(getEventsForDay([], "2025-03", 9)).toEqual([]);
  });

  it("uses the current month for incomplete month keys", () => {
    const now = new Date();
    expect(getMonthParts("invalid")).toEqual({
      year: now.getFullYear(),
      month: now.getMonth(),
    });
  });
});

describe("group utilities", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sorts events and updates membership immutably", () => {
    const events = [
      { id: "late", startDate: "2025-01-02", startTime: "18:00" },
      { id: "early", startDate: "2025-01-01", startTime: "09:00" },
    ] as any;
    expect(sortEventsByDate(events).map((event) => event.id)).toEqual(["early", "late"]);

    const group = { members: [{ id: "existing" }], memberCount: 1, joined: false } as any;
    const joined = applyMembership(group, { id: "new" }, true);
    expect(joined.members.map((member: any) => member.id)).toEqual(["new", "existing"]);
    expect(joined.memberCount).toBe(2);
    expect(group.members).toHaveLength(1);
    expect(applyMembership(joined, { id: "new" }, false).members.map((member: any) => member.id)).toEqual(["existing"]);
  });

  it("keeps membership unchanged when there is no current user and avoids duplicate joins", () => {
    const group = { members: [{ id: "existing" }], memberCount: 1, joined: false } as any;

    expect(applyMembership(group, null, true)).toBe(group);
    const joinedAgain = applyMembership(group, { id: "existing" }, true);
    expect(joinedAgain.members).toBe(group.members);
    expect(joinedAgain.memberCount).toBe(1);
    expect(joinedAgain.joined).toBe(true);
  });

  it("classifies invalid and missing event times safely", () => {
    expect(isEventPast({ startDate: "not-a-date", startTime: "12:00" } as any)).toBe(false);
    expect(isEventUpcoming({ startDate: "not-a-date", startTime: "12:00" } as any)).toBe(true);
    expect(isEventPast({ startDate: "2099-01-01", startTime: "" } as any)).toBe(false);
    expect(isEventUpcoming({ startDate: "2020-01-01", startTime: "" } as any)).toBe(false);
  });

  it("formats discussion dates and preserves invalid input", () => {
    expect(formatDiscussionDate("not-a-date")).toBe("not-a-date");
    expect(formatDiscussionDate(new Date().toISOString())).toBe("Just now");
  });

  it("creates deterministic avatar URLs and structured optimistic IDs", () => {
    expect(getAvatarUrl("user-1")).toBe("https://api.dicebear.com/7.x/avataaars/svg?seed=user-1");
    vi.spyOn(Date, "now").mockReturnValue(123);
    vi.spyOn(Math, "random").mockReturnValue(0.123456);
    expect(makeOptimisticTempId("discussion")).toMatch(/^discussion-123-/);
  });

  it("returns typed results for successful and failed JSON requests", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "nope" }), { status: 500 })));

    await expect(fetchJson<{ ok: boolean }>("https://example.test/success")).resolves.toEqual({
      ok: true,
      status: 200,
      data: { ok: true },
    });
    await expect(fetchJson("https://example.test/failure")).resolves.toEqual({
      ok: false,
      status: 500,
      data: null,
    });
  });

  it("does not deduplicate non-GET requests", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      fetchJson("https://example.test/item", { method: "POST" }),
      fetchJson("https://example.test/item", { method: "POST" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toMatchObject({ ok: true, data: { id: 1 } });
    expect(second).toMatchObject({ ok: true, data: { id: 2 } });
  });

  it("deduplicates concurrent GET requests and clears completed requests", async () => {
    let resolveRequest!: (response: Response) => void;
    const requestPromise = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(requestPromise)
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = fetchJson<{ item: number }>("https://example.test/item");
    const second = fetchJson<{ item: number }>("https://example.test/item");
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveRequest(new Response(JSON.stringify({ item: 1 }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, status: 200, data: { item: 1 } },
      { ok: true, status: 200, data: { item: 1 } },
    ]);

    await expect(fetchJsonValue<{ saved: boolean }>("https://example.test/item")).resolves.toEqual({ saved: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a failure result for malformed JSON and network errors", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("{not-json", { status: 200 }))
      .mockRejectedValueOnce(new Error("offline")));

    await expect(fetchJson("https://example.test/malformed")).resolves.toEqual({
      ok: false,
      status: 0,
      data: null,
    });
    await expect(fetchJson("https://example.test/offline")).resolves.toEqual({
      ok: false,
      status: 0,
      data: null,
    });
  });

  it("unwraps successful API responses and exposes typed failures", async () => {
    await expect(parseApiResponse(new Response(JSON.stringify({ success: true, data: { id: 1 } }), { status: 200 }))).resolves.toEqual({ id: 1 });
    await expect(parseApiResponse(new Response(JSON.stringify({ error: { message: "No access", code: "FORBIDDEN" } }), { status: 403 }))).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 403,
      message: "No access",
      code: "FORBIDDEN",
    });
  });

  it("supports every successful response envelope and fallback error shape", async () => {
    await expect(parseApiResponse(new Response(JSON.stringify({ value: ["a"] }), { status: 200 }))).resolves.toEqual(["a"]);
    await expect(parseApiResponse(new Response(JSON.stringify({ data: { value: ["b"] } }), { status: 200 }))).resolves.toEqual(["b"]);
    await expect(parseApiResponse(new Response("plain text", { status: 200 }))).resolves.toBeNull();
    await expect(parseApiResponse(new Response("not-json", { status: 502 }))).rejects.toMatchObject({
      status: 502,
      message: "Request failed (502)",
    });
  });

  it("sorts discussions without mutating the original list", () => {
    const discussions = [
      { id: "new", date: "2025-03-02", likes: 1 },
      { id: "old", date: "2025-03-01", likes: 8 },
    ] as any;

    expect(sortDiscussions(discussions, "latest").map((item) => item.id)).toEqual(["new", "old"]);
    expect(sortDiscussions(discussions, "oldest").map((item) => item.id)).toEqual(["old", "new"]);
    expect(sortDiscussions(discussions, "popular").map((item) => item.id)).toEqual(["old", "new"]);
    expect(discussions.map((item: any) => item.id)).toEqual(["new", "old"]);
  });
});
