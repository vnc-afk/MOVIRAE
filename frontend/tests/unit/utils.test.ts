import { describe, expect, it } from "vitest";

import { isEventPast, isEventUpcoming } from "../../app/groups/lib/groupUtils";
import { cn } from "../../lib/utils";

describe("cn", () => {
  it("merges conditional and conflicting Tailwind classes", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4");
  });
});

describe("group event date helpers", () => {
  it("marks past events as done and keeps upcoming events active", () => {
    const pastEvent = { id: "past", startDate: "2020-01-01", startTime: "18:00" } as any;
    const upcomingEvent = { id: "future", startDate: "2099-01-01", startTime: "18:00" } as any;

    expect(isEventPast(pastEvent)).toBe(true);
    expect(isEventPast(upcomingEvent)).toBe(false);
    expect(isEventUpcoming(pastEvent)).toBe(false);
    expect(isEventUpcoming(upcomingEvent)).toBe(true);
  });
});