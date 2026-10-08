import { afterEach, describe, expect, it, vi } from "vitest";

const originalRedisUrl = process.env.REDIS_URL;

describe("message websocket hub", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
      return;
    }

    process.env.REDIS_URL = originalRedisUrl;
  });

  it("falls back to local-only broadcast when REDIS_URL is invalid", async () => {
    process.env.REDIS_URL = "redis://[SENSITIVE]";
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(import("../../lib/features/messages/websocket")).resolves.toBeDefined();
    expect(warningSpy).toHaveBeenCalledWith("Message WebSocket Redis disabled:", expect.stringContaining("Invalid URL"));
  });
});