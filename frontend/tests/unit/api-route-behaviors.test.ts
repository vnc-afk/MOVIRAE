import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyTurnstileToken: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  watchlistFindMany: vi.fn(),
  watchlistCreate: vi.fn(),
  watchlistDeleteMany: vi.fn(),
  getServerSession: vi.fn(),
  requireAuth: vi.fn(),
  addReview: vi.fn(),
  bcryptHash: vi.fn(),
}));

vi.mock("@/lib/captcha", () => ({
  verifyTurnstileToken: mocks.verifyTurnstileToken,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
    },
    userWatchlistItem: {
      findMany: mocks.watchlistFindMany,
      create: mocks.watchlistCreate,
      deleteMany: mocks.watchlistDeleteMany,
    },
  },
}));

vi.mock("next-auth/next", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("bcrypt", () => ({
  default: { hash: mocks.bcryptHash },
}));

vi.mock("@/app/movie/lib/api-utils", () => ({
  requireAuth: mocks.requireAuth,
  parseRequestJson: async (request: Request) => request.json().catch(() => null),
  getOpId: (request: Request, body: unknown) => {
    if (typeof body === "object" && body !== null && "opId" in body) {
      return typeof (body as { opId?: unknown }).opId === "string" ? body.opId : undefined;
    }
    return request.headers.get("x-op-id") ?? undefined;
  },
}));

vi.mock("@/services/movies/movies.server", () => ({
  addReview: mocks.addReview,
}));

import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as getWatchlist, PUT as putWatchlist } from "@/app/api/watchlist/route";
import { POST as createReview } from "@/app/api/reviews/route";

const jsonRequest = (body: unknown, init?: RequestInit) =>
  new Request("http://localhost/api/test", {
    method: "POST",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
  });

const responseJson = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
});

describe("signup API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyTurnstileToken.mockResolvedValue(true);
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.bcryptHash.mockResolvedValue("hashed-password");
    mocks.userCreate.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      name: "Person",
      displayName: "Person",
    });
  });

  it("rejects malformed signup data before calling external dependencies", async () => {
    const response = await signup(jsonRequest({ email: "not-an-email", password: "short" }));

    await expect(responseJson(response)).resolves.toEqual({
      status: 400,
      body: { error: "Enter a valid email address." },
    });
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid CAPTCHA", async () => {
    mocks.verifyTurnstileToken.mockResolvedValue(false);

    const response = await signup(jsonRequest({
      email: "person@example.com",
      password: "long-enough-password",
      captchaToken: "bad-token",
    }));

    await expect(responseJson(response)).resolves.toEqual({
      status: 400,
      body: { error: "Please complete the CAPTCHA and try again." },
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("normalizes email and creates a user", async () => {
    const response = await signup(jsonRequest({
      name: "  Person ",
      email: " PERSON@Example.COM ",
      password: "long-enough-password",
      captchaToken: "valid-token",
    }, { headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" } }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      user: {
        id: "user-1",
        email: "person@example.com",
        name: "Person",
        displayName: "Person",
      },
    });
    expect(mocks.verifyTurnstileToken).toHaveBeenCalledWith("valid-token", "203.0.113.10");
    expect(mocks.userCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: "person@example.com",
        displayName: "Person",
        passwordHash: "hashed-password",
      }),
    }));
  });

  it("returns a conflict for an existing email", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "already-there" });

    const response = await signup(jsonRequest({
      email: "person@example.com",
      password: "long-enough-password",
    }));

    await expect(responseJson(response)).resolves.toEqual({
      status: 409,
      body: { error: "An account with that email already exists." },
    });
    expect(mocks.bcryptHash).not.toHaveBeenCalled();
  });
});

describe("watchlist API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(null);
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.watchlistFindMany.mockResolvedValue([]);
  });

  it("returns an empty watchlist when no user is selected", async () => {
    const response = await getWatchlist(new Request("http://localhost/api/watchlist"));

    await expect(responseJson(response)).resolves.toEqual({ status: 200, body: { value: [] } });
    expect(mocks.watchlistFindMany).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated updates", async () => {
    const response = await putWatchlist(jsonRequest({ movieId: "123", active: true }, { method: "PUT" }));

    await expect(responseJson(response)).resolves.toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("validates update payloads", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { email: "person@example.com" } });
    mocks.userFindUnique.mockResolvedValue({ id: "user-1" });

    const response = await putWatchlist(jsonRequest({ movieId: 123, active: "yes" }, { method: "PUT" }));

    await expect(responseJson(response)).resolves.toEqual({
      status: 400,
      body: { error: "Invalid payload" },
    });
    expect(mocks.watchlistCreate).not.toHaveBeenCalled();
  });

  it("adds and returns the current user's watchlist", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { email: "person@example.com" } });
    mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
    mocks.watchlistFindMany.mockResolvedValue([{ tmdbId: "123" }]);

    const response = await putWatchlist(jsonRequest({ movieId: "123", active: true }, { method: "PUT" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: ["123"] });
    expect(mocks.watchlistCreate).toHaveBeenCalledWith({ data: { userId: "user-1", tmdbId: "123" } });
  });
});

describe("review API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ id: "user-1", email: "person@example.com" });
  });

  it("returns 401 when authentication fails", async () => {
    mocks.requireAuth.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await createReview(jsonRequest({ tmdbId: "123", rating: 5 }, { method: "POST" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  });

  it("rejects invalid review input", async () => {
    const response = await createReview(jsonRequest({ tmdbId: "", rating: 6 }, { method: "POST" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
    expect(mocks.addReview).not.toHaveBeenCalled();
  });

  it("maps service conflicts and creates valid reviews", async () => {
    mocks.addReview
      .mockResolvedValueOnce({ error: "conflict" })
      .mockResolvedValueOnce({ value: { id: "review-1" }, opId: "operation-1" });

    const conflict = await createReview(jsonRequest({ tmdbId: "123", rating: 4 }, { method: "POST" }));
    expect(conflict.status).toBe(400);
    expect((await conflict.json()).error.message).toBe("You already reviewed this movie");

    const success = await createReview(jsonRequest(
      { tmdbId: "123", rating: 4, comment: "Great", opId: "operation-1" },
      { method: "POST" },
    ));
    expect(success.status).toBe(201);
    expect(await success.json()).toEqual({
      success: true,
      data: { value: { id: "review-1" }, opId: "operation-1" },
    });
  });

  it("maps service authorization and unexpected failures", async () => {
    mocks.addReview
      .mockResolvedValueOnce({ error: "unauthorized" })
      .mockRejectedValueOnce(new Error("database unavailable"));

    const unauthorized = await createReview(jsonRequest({ tmdbId: "123", rating: 4 }, { method: "POST" }));
    expect(unauthorized.status).toBe(401);
    expect((await unauthorized.json()).error.message).toBe("Mark the movie as watched before reviewing it");

    const failed = await createReview(jsonRequest({ tmdbId: "123", rating: 4 }, { method: "POST" }));
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Failed to create review",
    });
  });
});
