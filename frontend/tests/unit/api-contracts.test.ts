import { describe, expect, it } from "vitest";

import {
  apiBadRequest,
  apiCreated,
  apiError,
  apiForbidden,
  apiInternalError,
  apiNotFound,
  apiNotImplemented,
  apiServiceUnavailable,
  apiSuccess,
  apiUnauthorized,
  apiValidationError,
  apiConflict,
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

  it("returns JSON content types and preserves falsy payloads", async () => {
    for (const payload of [null, false, 0, "", []]) {
      const response = apiSuccess(payload);
      expect(response.headers.get("content-type")).toContain("application/json");
      await expect(response.json()).resolves.toEqual({ success: true, data: payload });
    }

    const error = apiBadRequest("Invalid", { field: "rating" });
    expect(error.headers.get("content-type")).toContain("application/json");
    await expect(error.json()).resolves.toEqual({
      success: false,
      error: { code: "BAD_REQUEST", message: "Invalid", details: { field: "rating" } },
    });
  });

  it("maps every standard API helper to its contract status", () => {
    expect(apiUnauthorized().status).toBe(401);
    expect(apiForbidden().status).toBe(403);
    expect(apiConflict().status).toBe(409);
    expect(apiValidationError().status).toBe(400);
    expect(apiInternalError().status).toBe(500);
    expect(apiNotImplemented().status).toBe(501);
    expect(apiServiceUnavailable().status).toBe(503);
    expect(apiError("CUSTOM", "Unavailable", 418).status).toBe(418);
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
