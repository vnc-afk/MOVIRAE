import { afterEach, describe, expect, it, vi } from "vitest";

import { dedupeEvents, getEventsForDay, getMonthKey, getMonthParts, shiftMonth } from "@/app/calendar/lib/calendarUtils";
import { applyMembership, fetchJson, parseApiResponse, sortEventsByDate } from "@/app/groups/lib/groupUtils";

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

  it("unwraps successful API responses and exposes typed failures", async () => {
    await expect(parseApiResponse(new Response(JSON.stringify({ success: true, data: { id: 1 } }), { status: 200 }))).resolves.toEqual({ id: 1 });
    await expect(parseApiResponse(new Response(JSON.stringify({ error: { message: "No access", code: "FORBIDDEN" } }), { status: 403 }))).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 403,
      message: "No access",
      code: "FORBIDDEN",
    });
  });
});
