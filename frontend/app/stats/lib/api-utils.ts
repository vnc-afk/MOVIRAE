import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PrismaUser = Awaited<ReturnType<typeof prisma.user.findUnique>>;

export type CurrentUser = Pick<
    NonNullable<PrismaUser>,
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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
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
    },
  });
}

export async function requireAuth(request: Request): Promise<CurrentUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
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
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return user;
}
