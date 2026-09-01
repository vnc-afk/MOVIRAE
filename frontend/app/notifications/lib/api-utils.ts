import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export type CurrentUser = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "username"
  | "displayName"
  | "avatar"
  | "image"
  | "bio"
>;

export const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  username: true,
  displayName: true,
  avatar: true,
  image: true,
  bio: true,
  emailVerified: true,
  passwordHash: true,
} as const;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: USER_SELECT,
  });
}

export async function requireAuth(request: Request): Promise<CurrentUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: USER_SELECT,
  });

  if (!user) {
    throw new ApiError("USER_NOT_FOUND", "User not found", 404);
  }

  return user;
}

export function getOpId(request: Request, body: unknown): string | undefined {
  const headerOpId = request.headers.get("x-op-id");
  const bodyOpId =
    typeof body === "object" && body !== null && "opId" in body && typeof (body as any).opId === "string"
      ? (body as any).opId
      : undefined;

  return typeof bodyOpId === "string" ? bodyOpId : headerOpId ?? undefined;
}

export async function parseRequestJson<T = any>(request: Request): Promise<T | null> {
  return await request.json().catch(() => null);
}
