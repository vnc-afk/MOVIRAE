import { describe, expect, it } from "vitest";

import {
  apiBadRequest,
  apiCreated,
  apiError,
  apiNotFound,
  apiSuccess,
} from "@/app/wrapped/lib/api-response";
import { getClientIp } from "@/lib/rate-limit";

describe("API response contracts", () => {
  it("returns consistent success and error envelopes", async () => {
    const success = apiSuccess({ id: 1 }, 200, { page: 1 });
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({
      success: true,
      data: { id: 1 },
      meta: { page: 1 },
    });

    const created = apiCreated({ id: 2 });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ success: true, data: { id: 2 } });

    const notFound = apiNotFound("Movie", { id: "missing" });
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Movie not found",
        details: { id: "missing" },
      },
    });
  });

  it("maps error helpers to their documented status codes", async () => {
    expect(apiBadRequest().status).toBe(400);
    expect(apiError("SERVICE_UNAVAILABLE", "Try later").status).toBe(503);
    expect((await apiError("CUSTOM", "Broken").json()).error).toEqual({
      code: "CUSTOM",
      message: "Broken",
    });
  });
});

describe("client IP extraction", () => {
  it("uses the first forwarded address, then real IP, then unknown", () => {
    expect(getClientIp(new Request("https://example.test", {
      headers: { "x-forwarded-for": " 203.0.113.10, 10.0.0.1", "x-real-ip": "203.0.113.20" },
    }))).toBe("203.0.113.10");
    expect(getClientIp(new Request("https://example.test", {
      headers: { "x-real-ip": "203.0.113.20" },
    }))).toBe("203.0.113.20");
    expect(getClientIp(new Request("https://example.test"))).toBe("unknown");
  });
});
