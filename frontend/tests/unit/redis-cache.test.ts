import { describe, expect, it, vi } from "vitest";

describe("redis cache helper", () => {
  it("should expose a cache key builder and safe no-op behavior without redis config", async () => {
    const { getRedisCacheKey, getRedisCached, setRedisCached } = await import("../../lib/redis-cache");

    expect(getRedisCacheKey("tmdb", "movie:123")).toBe("movirae:cache:tmdb:movie:123");
    await expect(getRedisCached("movirae:cache:test")).resolves.toBeNull();
    await expect(setRedisCached("movirae:cache:test", { ok: true }, 60)).resolves.toBeUndefined();
  });

  it("should wrap a factory with a cached value and ttl when redis is configured", async () => {
    const { withRedisCached } = await import("../../lib/redis-cache");

    const factory = vi.fn(async () => ({ ok: true, value: 42 }));
    const result = await withRedisCached("recommendations", "snapshot:anon", factory, 60);

    expect(result).toEqual({ ok: true, value: 42 });
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
