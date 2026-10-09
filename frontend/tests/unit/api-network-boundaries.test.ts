import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

import {
  getCurrentUser,
  getOpId,
  parseRequestJson,
  requireAuth,
} from "@/app/movie/lib/api-utils";

const requestWithBody = (body: string, headers?: HeadersInit) =>
  new Request("https://example.test/api/resource", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

describe("API request boundary helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses valid JSON and converts invalid or empty bodies to null", async () => {
    await expect(parseRequestJson(requestWithBody('{"movieId":"123"}'))).resolves.toEqual({
      movieId: "123",
    });
    await expect(parseRequestJson(requestWithBody("{invalid"))).resolves.toBeNull();
    await expect(
      parseRequestJson(new Request("https://example.test/api/resource", { method: "POST" }))
    ).resolves.toBeNull();
  });

  it("prefers a valid body operation ID over the request header", () => {
    const request = requestWithBody('{"opId":"body-op"}', { "x-op-id": "header-op" });

    expect(getOpId(request, { opId: "body-op" })).toBe("body-op");
    expect(getOpId(request, { opId: 123 })).toBe("header-op");
    expect(getOpId(request, null)).toBe("header-op");
    expect(getOpId(new Request("https://example.test"), {})).toBeUndefined();
  });

  it("returns no current user when there is no authenticated email", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("looks up the current user using the session email and selected fields", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { email: "person@example.com" } });
    mocks.findUnique.mockResolvedValue({ id: "user-1", email: "person@example.com" });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "user-1",
      email: "person@example.com",
    });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "person@example.com" },
      select: expect.objectContaining({
        id: true,
        email: true,
        passwordHash: true,
      }),
    }));
  });

  it("rejects unauthenticated and missing-user authorization states", async () => {
    mocks.getServerSession.mockResolvedValueOnce({ user: {} });
    await expect(requireAuth(new Request("https://example.test"))).rejects.toThrow("UNAUTHORIZED");

    mocks.getServerSession.mockResolvedValueOnce({ user: { email: "missing@example.com" } });
    mocks.findUnique.mockResolvedValueOnce(null);
    await expect(requireAuth(new Request("https://example.test"))).rejects.toThrow("USER_NOT_FOUND");
  });

  it("returns the authenticated user from requireAuth", async () => {
    const user = { id: "user-1", email: "person@example.com" };
    mocks.getServerSession.mockResolvedValue({ user: { email: user.email } });
    mocks.findUnique.mockResolvedValue(user);

    await expect(requireAuth(new Request("https://example.test"))).resolves.toEqual(user);
  });
});
