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
  | "emailVerified"
  | "passwordHash"
>;

const USER_SELECT = {
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

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: USER_SELECT,
  });
}

export async function requireAuth(request: Request): Promise<CurrentUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new AuthError("UNAUTHORIZED", "Authentication required");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: USER_SELECT,
  });

  if (!user) {
    throw new AuthError("USER_NOT_FOUND", "User not found");
  }

  return user;
}
