import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
}

export function serializeCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getOperationId(request: Request, body?: unknown): string | undefined {
  if (body && typeof body === "object" && "opId" in body && typeof body.opId === "string") {
    return body.opId;
  }
  return request.headers.get("x-op-id") ?? undefined;
}
